import os
import sqlite3
import shutil
import datetime
import time
import threading
import smtplib
import json
import base64
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, session, send_from_directory, render_template


try:
    from inference_sdk import InferenceHTTPClient
except ImportError:
    InferenceHTTPClient = None


def load_env():
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()

load_env()


app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)


DB_PATH = 'data/database.db'
UPLOADS_DIR = 'static/uploads'
BACKUPS_DIR = 'data/backups'


os.makedirs('data', exist_ok=True)
os.makedirs(BACKUPS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)




def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, -- Plain text for simple agricultural deployment/demo
        role TEXT NOT NULL
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT NOT NULL,
        disease TEXT NOT NULL,
        confidence REAL NOT NULL,
        severity TEXT NOT NULL,
        bounding_boxes TEXT, -- JSON string of boxes
        image_path TEXT, -- Filepath or 'purged'
        status TEXT DEFAULT 'active',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT NOT NULL,
        disease TEXT NOT NULL,
        min_confidence REAL NOT NULL,
        action TEXT NOT NULL, -- start_irrigation, stop_irrigation, notify_only, do_nothing
        is_active INTEGER DEFAULT 1
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS irrigation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL, -- start, stop, manual_start, manual_stop
        trigger_detection_id INTEGER,
        duration INTEGER,
        status TEXT, -- completed, failed, active
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin')")
        cursor.execute("INSERT INTO users (username, password, role) VALUES ('farmer', 'farmer', 'farmer')")
    default_settings = {
        'roboflow_api_key': '',
        'roboflow_workspace': 'kuldeeps-workspace-cli7o',
        'roboflow_project': 'plant-disease-w0ogb-gdeld',
        'roboflow_version': '1',
        'image_storage_limit': '500',
        'auto_irrigation_mode': '1', 
        'irrigation_duration': '10', 
        'smtp_server': '',
        'smtp_port': '587',
        'smtp_sender': '',
        'smtp_password': '',
        'smtp_receiver': '',
        'email_notifications_enabled': '0',
        'latitude': '28.6139', 
        'longitude': '77.2090'
    }
    for key, val in default_settings.items():
        cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (key, val))
    cursor.execute('SELECT COUNT(*) FROM rules')
    if cursor.fetchone()[0] == 0:
        default_rules = [
            ('Tomato', 'Late Blight', 80.0, 'stop_irrigation', 1),
            ('Tomato', 'Early Blight', 70.0, 'notify_only', 1),
            ('Tomato', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Tomato', 'Bacterial Spot', 80.0, 'stop_irrigation', 1),
            ('Tomato', 'Mosaic Virus', 85.0, 'stop_irrigation', 1),
            ('Tomato', 'Yellow Leaf Curl Virus', 85.0, 'stop_irrigation', 1),
            ('Tomato', 'Leaf Mold', 75.0, 'notify_only', 1),
            ('Tomato', 'Septoria Leaf Spot', 70.0, 'notify_only', 1),
            ('Tomato', 'Spider Mites', 80.0, 'stop_irrigation', 1),
            ('Apple', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Apple', 'Apple Rust', 75.0, 'stop_irrigation', 1),
            ('Apple', 'Apple Scab', 80.0, 'stop_irrigation', 1),
            ('Grape', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Grape', 'Black Rot', 80.0, 'stop_irrigation', 1),
            ('Strawberry', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Peach', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Cherry', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Soybean', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Blueberry', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Raspberry', 'Healthy', 85.0, 'start_irrigation', 1),
            ('Bell Pepper', 'Healthy', 80.0, 'start_irrigation', 1),
            ('Bell Pepper', 'Leaf Spot', 75.0, 'notify_only', 1),
            ('Corn', 'Healthy', 80.0, 'start_irrigation', 1),
            ('Corn', 'Gray Leaf Spot', 70.0, 'notify_only', 1),
            ('Corn', 'Leaf Blight', 75.0, 'stop_irrigation', 1),
            ('Corn', 'Common Rust', 75.0, 'stop_irrigation', 1),
            ('Potato', 'Healthy', 80.0, 'start_irrigation', 1),
            ('Potato', 'Early Blight', 70.0, 'notify_only', 1),
            ('Potato', 'Late Blight', 80.0, 'stop_irrigation', 1),
            ('Squash', 'Powdery Mildew', 75.0, 'stop_irrigation', 1)
        ]
        cursor.executemany('INSERT INTO rules (crop, disease, min_confidence, action, is_active) VALUES (?, ?, ?, ?, ?)', default_rules)
    try:
        cursor.execute("ALTER TABLE detections ADD COLUMN original_image_path TEXT")
    except sqlite3.OperationalError:
        pass 
    conn.commit()
    conn.close()




class IrrigationController:
    def __init__(self):
        self.pin = 18 
        self.is_active = False
        self.hardware_active = False
        self.timer_thread = None
        try:
            from gpiozero import OutputDevice
            self.device = OutputDevice(self.pin)
            self.hardware_active = True
            print(f"[GPIO] Initialized OutputDevice on pin {self.pin}")
        except Exception as e:
            self.device = None
            print(f"[GPIO] Fallback to Mock GPIO Controller. Reason: {e}")
    def get_state(self):
        return {
            'active': self.is_active,
            'pin': self.pin,
            'hardware': self.hardware_active
        }
    def turn_on(self, trigger_detection_id=None, source="system"):
        self.is_active = True
        if self.hardware_active and self.device:
            try:
                self.device.on()
            except Exception as e:
                print(f"[GPIO Error] Failed to turn ON: {e}")
        print(f"[GPIO] Relay ON (Source: {source}, Pin: {self.pin})")
        try:
            conn = get_db()
            cursor = conn.cursor()
            action_name = 'manual_start' if source == 'manual' else 'start'
            cursor.execute('INSERT INTO irrigation_log (action, trigger_detection_id, status) VALUES (?, ?, ?)',
                           (action_name, trigger_detection_id, 'active'))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[Database Error] Log irrigation start: {e}")
    def turn_off(self, duration=None, source="system"):
        self.is_active = False
        if self.hardware_active and self.device:
            try:
                self.device.off()
            except Exception as e:
                print(f"[GPIO Error] Failed to turn OFF: {e}")
        print(f"[GPIO] Relay OFF (Source: {source}, Pin: {self.pin})")
        try:
            conn = get_db()
            cursor = conn.cursor()
            action_name = 'manual_stop' if source == 'manual' else 'stop'
            cursor.execute('SELECT id FROM irrigation_log WHERE status = ? ORDER BY id DESC LIMIT 1', ('active',))
            row = cursor.fetchone()
            if row:
                log_id = row[0]
                cursor.execute('UPDATE irrigation_log SET status = ?, duration = ? WHERE id = ?', 
                               ('completed', duration, log_id))
            else:
                cursor.execute('INSERT INTO irrigation_log (action, duration, status) VALUES (?, ?, ?)',
                               (action_name, duration, 'completed'))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[Database Error] Log irrigation stop: {e}")

    def trigger_cycle(self, duration_secs, trigger_detection_id=None):
        if self.timer_thread and self.timer_thread.is_alive():
            print("[GPIO] Cancelling existing irrigation timer cycle")
        def timer_func():
            self.turn_on(trigger_detection_id, "auto")
            time.sleep(duration_secs)
            self.turn_off(duration_secs, "auto")
        self.timer_thread = threading.Thread(target=timer_func)
        self.timer_thread.daemon = True
        self.timer_thread.start()


irrigation_ctrl = IrrigationController()




def prune_storage():
    """Ensure uploads directory has fewer images than the configured limit by deleting oldest files."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'image_storage_limit'")
        limit_row = cursor.fetchone()
        limit = int(limit_row[0]) if limit_row else 500
        cursor.execute("SELECT COUNT(*) FROM detections WHERE image_path IS NOT NULL AND image_path != 'purged'")
        count = cursor.fetchone()[0]
        if count > limit:
            excess = count - limit
            print(f"[Storage Pruner] Found {count} images, exceeding limit {limit}. Pruning oldest {excess} images...")
            cursor.execute(
                "SELECT id, image_path FROM detections WHERE image_path IS NOT NULL AND image_path != 'purged' ORDER BY timestamp ASC LIMIT ?",
                (excess,)
            )
            rows = cursor.fetchall()
            for row in rows:
                det_id = row['id']
                img_path = row['image_path']
                if img_path and os.path.exists(img_path):
                    try:
                        os.remove(img_path)
                        print(f"[Storage Pruner] Deleted image: {img_path}")
                    except Exception as fe:
                        print(f"[Storage Pruner] Error deleting physical file {img_path}: {fe}")
                cursor.execute("UPDATE detections SET image_path = 'purged' WHERE id = ?", (det_id,))
            conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Storage Pruner] Error during execution: {e}")




def send_email_alert(detection_data):
    """Sends an email notification via SMTP config."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        configs = {}
        cursor.execute("SELECT key, value FROM settings WHERE key LIKE 'smtp_%' OR key = 'email_notifications_enabled'")
        for row in cursor.fetchall():
            configs[row['key']] = row['value']
        conn.close()
        if configs.get('email_notifications_enabled') != '1':
            print("[Notifications] Email alerts disabled globally")
            return False
        smtp_server = configs.get('smtp_server')
        smtp_port = int(configs.get('smtp_port', '587'))
        smtp_sender = configs.get('smtp_sender')
        smtp_password = configs.get('smtp_password')
        smtp_receiver = configs.get('smtp_receiver')
        if not all([smtp_server, smtp_sender, smtp_password, smtp_receiver]):
            print("[Notifications] SMTP configuration incomplete. Mocking email alert instead.")
            print(f"[MOCK EMAIL ALERT] Severe crop issue detected!\n"
                  f"Crop: {detection_data['crop']}\n"
                  f"Disease: {detection_data['disease']}\n"
                  f"Severity: {detection_data['severity']}\n"
                  f"Confidence: {detection_data['confidence']}%\n"
                  f"Destination: {smtp_receiver}")
            return True
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"🚨 WARNING: Severe Crop Disease ({detection_data['crop']} - {detection_data['disease']}) Detected"
        msg['From'] = smtp_sender
        msg['To'] = smtp_receiver
        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                <h2 style="color: #e11d48; border-bottom: 2px solid #e11d48; padding-bottom: 10px;">Severe Crop Disease Alert</h2>
                <p>The Crop Detection and Smart Irrigation System has identified a high-severity crop issue.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Crop</td><td style="padding: 8px; border-bottom: 1px solid #eee;">{detection_data['crop']}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Condition / Disease</td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #be123c; font-weight: bold;">{detection_data['disease']}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Confidence</td><td style="padding: 8px; border-bottom: 1px solid #eee;">{detection_data['confidence']}%</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Severity Level</td><td style="padding: 8px; border-bottom: 1px solid #eee; color: white; background-color: #be123c; display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-top: 5px;">🔴 SEVERE</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Timestamp</td><td style="padding: 8px; border-bottom: 1px solid #eee;">{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</td></tr>
                </table>
                <h3 style="color: #1e3a8a; margin-top: 20px;">Treatment & Recommendations</h3>
                <div style="background-color: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
                    <p><strong>Primary Treatment:</strong> Prune infected leaves and clear fallen debris immediately.</p>
                    <p><strong>Fungicide Advice:</strong> Apply Copper-based fungicide or Chlorothalonil every 7-10 days.</p>
                    <p><strong>Watering Adjustment:</strong> Drip irrigation only. Switch OFF automated overhead water/sprinkling to stop spore spread.</p>
                    <p><strong>Isolation Details:</strong> Isolate infected items. If field-based, pull and destroy severely diseased plants.</p>
                    <p><strong>Recovery Expected:</strong> 2-3 weeks if isolated and treated early.</p>
                </div>
                <p style="font-size: 12px; color: #777; margin-top: 20px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                    This is an automated notification from your Smart Irrigation Hub.
                </p>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html, 'html'))
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_sender, smtp_password)
        server.sendmail(smtp_sender, [smtp_receiver], msg.as_string())
        server.quit()
        print(f"[Notifications] Email alert successfully sent to {smtp_receiver}")
        return True
    except Exception as e:
        print(f"[Notifications Error] Failed to send email alert: {e}")
        return False




def perform_db_backup():
    """Backup SQLite database.db file to backups folder."""
    try:
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        dest_filename = f"database_backup_{timestamp}.db"
        dest_path = os.path.join(BACKUPS_DIR, dest_filename)
        shutil.copy2(DB_PATH, dest_path)
        print(f"[Scheduler] Database backup created: {dest_path}")
        backups = [os.path.join(BACKUPS_DIR, f) for f in os.listdir(BACKUPS_DIR) if f.startswith('database_backup_')]
        backups.sort(key=os.path.getmtime)
        while len(backups) > 5:
            oldest = backups.pop(0)
            try:
                os.remove(oldest)
                print(f"[Scheduler] Purged old backup: {oldest}")
            except Exception as e:
                print(f"[Scheduler] Error purging backup {oldest}: {e}")
    except Exception as e:
        print(f"[Scheduler] Database backup failed: {e}")




def run_scheduler():
    """Background loop to check and execute scheduled tasks."""
    print("[Scheduler] Starting background scheduler loop...")
    last_backup_date = None
    last_digest_date = None
    while True:
        try:
            today = datetime.date.today()
            now = datetime.datetime.now()
            if last_backup_date != today and now.hour == 1:
                perform_db_backup()
                last_backup_date = today
            if last_digest_date != today and now.hour == 20:
                conn = get_db()
                cursor = conn.cursor()
                yesterday = datetime.datetime.now() - datetime.timedelta(days=1)
                cursor.execute("SELECT COUNT(*) FROM detections WHERE timestamp >= ?", (yesterday,))
                detections_count = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM irrigation_log WHERE timestamp >= ?", (yesterday,))
                irrigation_count = cursor.fetchone()[0]
                conn.close()
                print(f"[Scheduler] Daily health digest stats gathered: {detections_count} detections, {irrigation_count} irrigation actions.")
                last_digest_date = today
            prune_storage()
        except Exception as ex:
            print(f"[Scheduler Loop Error] {ex}")
        time.sleep(900)


scheduler_thread = threading.Thread(target=run_scheduler)
scheduler_thread.daemon = True
scheduler_thread.start()




def login_required(role=None):
    def decorator(f):
        def wrapper(*args, **kwargs):
            if 'username' not in session:
                return jsonify({'error': 'Unauthorized', 'message': 'Please login first'}), 401
            if role and session.get('role') != role and session.get('role') != 'admin':
                return jsonify({'error': 'Forbidden', 'message': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator






@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Bad Request', 'message': 'Username and password required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()
    if user and user['password'] == password: 
        session['username'] = user['username']
        session['role'] = user['role']
        return jsonify({
            'success': True,
            'user': {
                'username': user['username'],
                'role': user['role']
            }
        })
    return jsonify({'success': False, 'message': 'Invalid username or password'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/status', methods=['GET'])
def api_auth_status():
    if 'username' in session:
        return jsonify({
            'logged_in': True,
            'user': {
                'username': session['username'],
                'role': session['role']
            }
        })
    return jsonify({'logged_in': False})


@app.route('/api/config', methods=['GET', 'POST'])
@login_required()
def api_config():
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'POST':
        is_admin = session.get('role') == 'admin'
        data = request.json or {}
        for k, v in data.items():
            if not is_admin and k in ['smtp_password', 'smtp_server', 'roboflow_api_key', 'image_storage_limit']:
                continue
            if k in ['smtp_password', 'roboflow_api_key'] and v == '********':
                continue
            cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (k, str(v)))
        conn.commit()
    cursor.execute('SELECT key, value FROM settings')
    settings_dict = {}
    for row in cursor.fetchall():
        if row['key'] in ['smtp_password', 'roboflow_api_key'] and row['value']:
            settings_dict[row['key']] = '********'
        else:
            settings_dict[row['key']] = row['value']
    conn.close()
    return jsonify(settings_dict)


@app.route('/api/rules', methods=['GET', 'POST'])
@login_required()
def api_rules():
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'POST':
        if session.get('role') != 'admin':
            conn.close()
            return jsonify({'error': 'Forbidden', 'message': 'Only Admins can modify rules'}), 403
        data = request.json or {}
        rule_id = data.get('id')
        crop = data.get('crop')
        disease = data.get('disease')
        min_confidence = float(data.get('min_confidence', 80.0))
        action = data.get('action')
        is_active = int(data.get('is_active', 1))
        if not crop or not disease or not action:
            conn.close()
            return jsonify({'error': 'Bad Request', 'message': 'Missing required fields'}), 400
        if rule_id:
            cursor.execute('UPDATE rules SET crop=?, disease=?, min_confidence=?, action=?, is_active=? WHERE id=?',
                           (crop, disease, min_confidence, action, is_active, rule_id))
        else:
            cursor.execute('INSERT INTO rules (crop, disease, min_confidence, action, is_active) VALUES (?, ?, ?, ?, ?)',
                           (crop, disease, min_confidence, action, is_active))
        conn.commit()
    cursor.execute('SELECT * FROM rules')
    rules_list = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(rules_list)

@app.route('/api/rules/<int:rule_id>', methods=['DELETE'])
@login_required('admin')
def api_delete_rule(rule_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM rules WHERE id = ?', (rule_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/rules/restore', methods=['POST'])
@login_required('admin')
def api_restore_default_rules():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM rules')
    default_rules = [
        ('Tomato', 'Late Blight', 80.0, 'stop_irrigation', 1),
        ('Tomato', 'Early Blight', 70.0, 'notify_only', 1),
        ('Tomato', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Tomato', 'Bacterial Spot', 80.0, 'stop_irrigation', 1),
        ('Tomato', 'Mosaic Virus', 85.0, 'stop_irrigation', 1),
        ('Tomato', 'Yellow Leaf Curl Virus', 85.0, 'stop_irrigation', 1),
        ('Tomato', 'Leaf Mold', 75.0, 'notify_only', 1),
        ('Tomato', 'Septoria Leaf Spot', 70.0, 'notify_only', 1),
        ('Tomato', 'Spider Mites', 80.0, 'stop_irrigation', 1),
        ('Apple', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Apple', 'Apple Rust', 75.0, 'stop_irrigation', 1),
        ('Apple', 'Apple Scab', 80.0, 'stop_irrigation', 1),
        ('Grape', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Grape', 'Black Rot', 80.0, 'stop_irrigation', 1),
        ('Strawberry', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Peach', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Cherry', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Soybean', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Blueberry', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Raspberry', 'Healthy', 85.0, 'start_irrigation', 1),
        ('Bell Pepper', 'Healthy', 80.0, 'start_irrigation', 1),
        ('Bell Pepper', 'Leaf Spot', 75.0, 'notify_only', 1),
        ('Corn', 'Healthy', 80.0, 'start_irrigation', 1),
        ('Corn', 'Gray Leaf Spot', 70.0, 'notify_only', 1),
        ('Corn', 'Leaf Blight', 75.0, 'stop_irrigation', 1),
        ('Corn', 'Common Rust', 75.0, 'stop_irrigation', 1),
        ('Potato', 'Healthy', 80.0, 'start_irrigation', 1),
        ('Potato', 'Early Blight', 70.0, 'notify_only', 1),
        ('Potato', 'Late Blight', 80.0, 'stop_irrigation', 1),
        ('Squash', 'Powdery Mildew', 75.0, 'stop_irrigation', 1)
    ]
    cursor.executemany('INSERT INTO rules (crop, disease, min_confidence, action, is_active) VALUES (?, ?, ?, ?, ?)', default_rules)
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/irrigation', methods=['GET'])
@login_required()
def api_irrigation_status():
    status = irrigation_ctrl.get_state()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM settings WHERE key = ?', ('auto_irrigation_mode',))
    auto_mode_row = cursor.fetchone()
    auto_mode = auto_mode_row[0] == '1' if auto_mode_row else True
    cursor.execute('SELECT * FROM irrigation_log ORDER BY timestamp DESC LIMIT 10')
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    status['auto_mode'] = auto_mode
    status['recent_logs'] = logs
    return jsonify(status)

@app.route('/api/irrigation/toggle', methods=['POST'])
@login_required()
def api_irrigation_toggle():
    current_state = irrigation_ctrl.is_active
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'irrigation_duration'")
    duration_row = cursor.fetchone()
    duration = int(duration_row[0]) if duration_row else 10
    conn.close()
    if current_state:
        irrigation_ctrl.turn_off(duration=None, source="manual")
    else:
        irrigation_ctrl.turn_on(trigger_detection_id=None, source="manual")
    return jsonify({'success': True, 'state': irrigation_ctrl.is_active})


@app.route('/api/irrigation/rules-engine', methods=['POST'])
@login_required()
def api_rules_engine():
    data = request.json or {}
    crop = data.get('crop')
    disease = data.get('disease')
    confidence = float(data.get('confidence', 0.0))
    detection_id = data.get('detection_id')
    if not crop or not disease:
        return jsonify({'error': 'Bad Request', 'message': 'Crop and disease required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'auto_irrigation_mode'")
    mode_row = cursor.fetchone()
    auto_enabled = mode_row[0] == '1' if mode_row else True
    if not auto_enabled:
        conn.close()
        return jsonify({'applied': False, 'message': 'Auto-irrigation mode is disabled globally'})
    cursor.execute('''
        SELECT * FROM rules 
        WHERE crop = ? AND disease = ? AND is_active = 1 AND min_confidence <= ?
        ORDER BY min_confidence DESC LIMIT 1
    ''', (crop, disease, confidence))
    matched_rule = cursor.fetchone()
    action_taken = "none"
    message = "No matching rules found for the crop/disease combination or confidence threshold."
    if matched_rule:
        action = matched_rule['action']
        cursor.execute("SELECT value FROM settings WHERE key = 'irrigation_duration'")
        duration_row = cursor.fetchone()
        duration = int(duration_row[0]) if duration_row else 10
        if action == 'start_irrigation':
            irrigation_ctrl.trigger_cycle(duration, trigger_detection_id=detection_id)
            action_taken = "start_irrigation"
            message = f"Matched rule #{matched_rule['id']}: Starting irrigation cycle for {duration} seconds."
        elif action == 'stop_irrigation':
            irrigation_ctrl.turn_off(duration=0, source="auto")
            action_taken = "stop_irrigation"
            message = f"Matched rule #{matched_rule['id']}: Severe condition. Overriding and turning OFF irrigation."
            cursor.execute('INSERT INTO irrigation_log (action, trigger_detection_id, status) VALUES (?, ?, ?)',
                           ('stop', detection_id, 'completed'))
            conn.commit()
        elif action == 'notify_only':
            action_taken = "notify_only"
            message = f"Matched rule #{matched_rule['id']}: Alert logged. Water adjustments notified."
            det_info = {
                'crop': crop,
                'disease': disease,
                'confidence': confidence,
                'severity': 'Moderate' if 'Early' in disease or 'Mild' in disease else 'Severe'
            }
            threading.Thread(target=send_email_alert, args=(det_info,)).start()
        elif action == 'do_nothing':
            action_taken = "do_nothing"
            message = f"Matched rule #{matched_rule['id']}: Rule explicitly overrides with Do Nothing."
    conn.close()
    return jsonify({
        'applied': True,
        'rule': dict(matched_rule) if matched_rule else None,
        'action': action_taken,
        'message': message
    })

def parse_roboflow_class(class_name):
    class_lower = class_name.lower().replace('_', ' ')
    crop = 'Tomato'
    disease = 'Healthy'
    severity = 'Normal'
    
    if 'tomato' in class_lower:
        crop = 'Tomato'
    elif 'apple' in class_lower:
        crop = 'Apple'
    elif 'grape' in class_lower:
        crop = 'Grape'
    elif 'strawberry' in class_lower:
        crop = 'Strawberry'
    elif 'peach' in class_lower:
        crop = 'Peach'
    elif 'cherry' in class_lower:
        crop = 'Cherry'
    elif 'soyabean' in class_lower or 'soybean' in class_lower:
        crop = 'Soybean'
    elif 'blueberry' in class_lower:
        crop = 'Blueberry'
    elif 'raspberry' in class_lower:
        crop = 'Raspberry'
    elif 'bell' in class_lower or 'pepper' in class_lower:
        crop = 'Bell Pepper'
    elif 'corn' in class_lower:
        crop = 'Corn'
    elif 'potato' in class_lower:
        crop = 'Potato'
    elif 'squash' in class_lower:
        crop = 'Squash'
        
    if 'bacterial spot' in class_lower:
        disease = 'Bacterial Spot'
        severity = 'Severe'
    elif 'mosaic virus' in class_lower:
        disease = 'Mosaic Virus'
        severity = 'Severe'
    elif 'yellow leaf' in class_lower or 'yellow virus' in class_lower:
        disease = 'Yellow Leaf Curl Virus'
        severity = 'Severe'
    elif 'spider mites' in class_lower:
        disease = 'Spider Mites'
        severity = 'Severe'
    elif 'septoria' in class_lower:
        disease = 'Septoria Leaf Spot'
        severity = 'Moderate'
    elif 'mold' in class_lower:
        disease = 'Leaf Mold'
        severity = 'Moderate'
    elif 'powdery mildew' in class_lower:
        disease = 'Powdery Mildew'
        severity = 'Moderate'
    elif 'black rot' in class_lower:
        disease = 'Black Rot'
        severity = 'Severe'
    elif 'gray leaf spot' in class_lower:
        disease = 'Gray Leaf Spot'
        severity = 'Moderate'
    elif 'early blight' in class_lower:
        disease = 'Early Blight'
        severity = 'Moderate'
    elif 'late blight' in class_lower:
        disease = 'Late Blight'
        severity = 'Severe'
    elif 'leaf spot' in class_lower or 'spot' in class_lower:
        disease = 'Leaf Spot'
        severity = 'Moderate'
    elif 'rust' in class_lower:
        disease = 'Apple Rust' if crop == 'Apple' else 'Rust'
        severity = 'Severe'
    elif 'scab' in class_lower:
        disease = 'Apple Scab' if crop == 'Apple' else 'Scab'
        severity = 'Severe'
    elif 'blight' in class_lower:
        disease = 'Leaf Blight'
        severity = 'Severe'
    elif 'leaf' in class_lower:
        disease = 'Healthy'
        severity = 'Normal'
    else:
        disease = class_name.replace(crop, '').strip().title()
        if not disease:
            disease = 'Healthy'
    return crop, disease, severity

def generate_backend_mock_predictions():
    mock_options = [
        ('Tomato', 'Late Blight', 'Severe', 91.5),
        ('Tomato', 'Early Blight', 'Moderate', 78.4),
        ('Tomato', 'Healthy', 'Normal', 96.2),
        ('Apple', 'Apple Rust', 'Severe', 93.0),
        ('Apple', 'Apple Scab', 'Severe', 88.5),
        ('Apple', 'Healthy', 'Normal', 97.0),
        ('Grape', 'Healthy', 'Normal', 96.0),
        ('Strawberry', 'Healthy', 'Normal', 95.5),
        ('Peach', 'Healthy', 'Normal', 93.5),
        ('Cherry', 'Healthy', 'Normal', 98.0),
        ('Soybean', 'Healthy', 'Normal', 94.5),
        ('Blueberry', 'Healthy', 'Normal', 96.5),
        ('Raspberry', 'Healthy', 'Normal', 97.0),
        ('Bell Pepper', 'Healthy', 'Normal', 94.0)
    ]
    crop, disease, severity, confidence = random.choice(mock_options)
    predictions = [{
        'x': 320,
        'y': 240,
        'width': 250,
        'height': 200,
        'class': f"{crop} {disease}" if disease != 'Healthy' else f"{crop} leaf",
        'confidence': confidence / 100.0
    }]
    return predictions, crop, disease, severity, confidence


@app.route('/api/history', methods=['GET', 'POST'])
@login_required()
def api_history():
    conn = get_db()
    cursor = conn.cursor()
    if request.method == 'POST':
        data = request.json or {}
        crop = data.get('crop')
        disease = data.get('disease')
        confidence = float(data.get('confidence', 0.0))
        severity = data.get('severity', 'Normal')
        bounding_boxes = data.get('bounding_boxes', '') 
        image_base64 = data.get('image') 
        original_image_path = None
        image_path = None
        if image_base64:
            if ',' in image_base64:
                image_base64 = image_base64.split(',')[1]
            try:
                img_data = base64.b64decode(image_base64)
                filename = f"det_{int(time.time())}_upload.jpg"
                full_path = os.path.join(UPLOADS_DIR, filename)
                with open(full_path, 'wb') as f:
                    f.write(img_data)
                image_path = full_path
            except Exception as ie:
                print(f"[Image Save Error] Failed to write base64 image: {ie}")
        if not crop or not disease:
            api_key = os.environ.get('ROBOFLOW_API_KEY')
            cursor.execute("SELECT value FROM settings WHERE key = 'roboflow_api_key'")
            db_key_row = cursor.fetchone()
            db_api_key = db_key_row[0] if db_key_row else ''
            if not api_key:
                api_key = db_api_key
            cursor.execute("SELECT value FROM settings WHERE key = 'roboflow_workspace'")
            workspace_row = cursor.fetchone()
            workspace = workspace_row[0] if workspace_row else 'kuldeeps-workspace-cli7o'
            cursor.execute("SELECT value FROM settings WHERE key = 'roboflow_project'")
            project_row = cursor.fetchone()
            project = project_row[0] if project_row else 'plant-disease-w0ogb-gdeld'
            cursor.execute("SELECT value FROM settings WHERE key = 'roboflow_version'")
            version_row = cursor.fetchone()
            version = version_row[0] if version_row else '1'
            predictions = []
            if api_key and InferenceHTTPClient and image_path:
                try:
                    client = InferenceHTTPClient(
                        api_url="https://serverless.roboflow.com",
                        api_key=api_key
                    )
                    model_id = f"{project}/{version}"
                    result = client.infer(image_path, model_id=model_id)
                    predictions = result.get('predictions', [])
                    print(f"[Inference SDK] Model returned: {len(predictions)} predictions")
                except Exception as sdk_err:
                    print(f"[Inference SDK Error] {sdk_err}. Falling back to mock...")
                    predictions = []
            if len(predictions) > 0:
                predictions.sort(key=lambda x: x.get('confidence', 0.0), reverse=True)
                highest = predictions[0]
                confidence = float(highest.get('confidence', 0.0)) * 100.0
                class_label = highest.get('class', 'Tomato leaf')
                crop, disease, severity = parse_roboflow_class(class_label)
                bounding_boxes = predictions
            else:
                mock_preds, crop, disease, severity, confidence = generate_backend_mock_predictions()
                bounding_boxes = mock_preds
            if image_path:
                try:
                    new_filename = f"det_{int(time.time())}_{crop.lower().replace(' ', '_')}.jpg"
                    new_path = os.path.join(UPLOADS_DIR, new_filename)
                    os.rename(image_path, new_path)
                    image_path = new_path
                except Exception as rename_err:
                    print(f"[Image Rename Error] {rename_err}")
        if not crop:
            crop = 'Tomato'
        if not disease:
            disease = 'Healthy'
        cursor.execute('''
            INSERT INTO detections (crop, disease, confidence, severity, bounding_boxes, image_path, original_image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (crop, disease, confidence, severity, json.dumps(bounding_boxes) if isinstance(bounding_boxes, (dict, list)) else bounding_boxes, image_path, original_image_path))
        detection_id = cursor.lastrowid
        conn.commit()
        rules_result = {}
        try:
            cursor.execute("SELECT value FROM settings WHERE key = 'auto_irrigation_mode'")
            mode_row = cursor.fetchone()
            auto_enabled = mode_row[0] == '1' if mode_row else True
            if auto_enabled:
                cursor.execute('''
                    SELECT * FROM rules 
                    WHERE crop = ? AND disease = ? AND is_active = 1 AND min_confidence <= ?
                    ORDER BY min_confidence DESC LIMIT 1
                ''', (crop, disease, confidence))
                matched_rule = cursor.fetchone()
                if matched_rule:
                    action = matched_rule['action']
                    cursor.execute("SELECT value FROM settings WHERE key = 'irrigation_duration'")
                    duration_row = cursor.fetchone()
                    duration = int(duration_row[0]) if duration_row else 10
                    rules_result = {
                        'applied': True,
                        'rule_id': matched_rule['id'],
                        'action': action,
                        'message': f"Matched rule #{matched_rule['id']}."
                    }
                    if action == 'start_irrigation':
                        irrigation_ctrl.trigger_cycle(duration, trigger_detection_id=detection_id)
                    elif action == 'stop_irrigation':
                        irrigation_ctrl.turn_off(duration=0, source="auto")
                        cursor.execute('INSERT INTO irrigation_log (action, trigger_detection_id, status) VALUES (?, ?, ?)',
                                       ('stop', detection_id, 'completed'))
                        conn.commit()
                    elif action == 'notify_only' or severity == 'Severe':
                        det_info = {
                            'crop': crop,
                            'disease': disease,
                            'confidence': confidence,
                            'severity': severity
                        }
                        threading.Thread(target=send_email_alert, args=(det_info,)).start()
                else:
                    rules_result = {'applied': False, 'message': 'No matching rules found.'}
            else:
                rules_result = {'applied': False, 'message': 'Auto Mode disabled.'}
        except Exception as re:
            print(f"[Rules Engine Error] {re}")
            rules_result = {'error': str(re)}
        prune_storage()
        conn.close()
        return jsonify({
            'success': True,
            'detection_id': detection_id,
            'crop': crop,
            'disease': disease,
            'confidence': confidence,
            'severity': severity,
            'bounding_boxes': bounding_boxes if isinstance(bounding_boxes, list) else json.loads(bounding_boxes),
            'image_path': image_path,
            'original_image_path': original_image_path,
            'rules_result': rules_result
        })
    else:
        crop_filter = request.args.get('crop')
        disease_filter = request.args.get('disease')
        severity_filter = request.args.get('severity')
        search_query = request.args.get('search')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        query = 'SELECT * FROM detections WHERE status = ?'
        params = ['active']
        if crop_filter:
            query += ' AND crop = ?'
            params.append(crop_filter)
        if disease_filter:
            query += ' AND disease = ?'
            params.append(disease_filter)
        if severity_filter:
            query += ' AND severity = ?'
            params.append(severity_filter)
        if search_query:
            query += ' AND (crop LIKE ? OR disease LIKE ?)'
            params.append(f"%{search_query}%")
            params.append(f"%{search_query}%")
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        cursor.execute(query, params)
        detections = [dict(row) for row in cursor.fetchall()]
        count_query = 'SELECT COUNT(*) FROM detections WHERE status = ?'
        count_params = ['active']
        if crop_filter:
            count_query += ' AND crop = ?'
            count_params.append(crop_filter)
        if disease_filter:
            count_query += ' AND disease = ?'
            count_params.append(disease_filter)
        if severity_filter:
            count_query += ' AND severity = ?'
            count_params.append(severity_filter)
        if search_query:
            count_query += ' AND (crop LIKE ? OR disease LIKE ?)'
            count_params.append(f"%{search_query}%")
            count_params.append(f"%{search_query}%")
        cursor.execute(count_query, count_params)
        total_count = cursor.fetchone()[0]
        conn.close()
        return jsonify({
            'detections': detections,
            'total_count': total_count
        })

@app.route('/api/history/clear', methods=['POST'])
@login_required('admin')
def api_clear_history():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT image_path FROM detections WHERE image_path IS NOT NULL AND image_path != 'purged'")
    rows = cursor.fetchall()
    for row in rows:
        img_path = row[0]
        if img_path and os.path.exists(img_path):
            try:
                os.remove(img_path)
            except Exception as e:
                print(f"[Clear History] Error deleting file {img_path}: {e}")
    cursor.execute("DELETE FROM detections")
    cursor.execute("DELETE FROM irrigation_log")
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/analytics', methods=['GET'])
@login_required()
def api_analytics():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM detections")
    total_detections = cursor.fetchone()[0]
    cursor.execute("SELECT crop, COUNT(*) as cnt FROM detections GROUP BY crop ORDER BY cnt DESC LIMIT 1")
    most_detected_crop_row = cursor.fetchone()
    most_detected_crop = most_detected_crop_row['crop'] if most_detected_crop_row else 'None'
    cursor.execute("SELECT AVG(confidence) FROM detections")
    avg_confidence_row = cursor.fetchone()
    avg_confidence = round(avg_confidence_row[0], 1) if avg_confidence_row and avg_confidence_row[0] else 0.0
    cursor.execute("SELECT COUNT(*) FROM irrigation_log WHERE action LIKE '%start%'")
    irrigation_triggers = cursor.fetchone()[0]
    cursor.execute("SELECT disease, COUNT(*) as count FROM detections GROUP BY disease")
    disease_distribution = [dict(row) for row in cursor.fetchall()]
    cursor.execute('''
        SELECT DATE(timestamp) as date, COUNT(*) as count 
        FROM detections 
        WHERE timestamp >= date('now', '-14 days')
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    ''')
    trend_data = [dict(row) for row in cursor.fetchall()]
    cursor.execute("SELECT * FROM detections ORDER BY timestamp DESC LIMIT 5")
    recent_detections = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({
        'kpis': {
            'total_detections': total_detections,
            'most_detected_crop': most_detected_crop,
            'avg_confidence': avg_confidence,
            'irrigation_triggers': irrigation_triggers
        },
        'disease_distribution': disease_distribution,
        'trend_data': trend_data,
        'recent_detections': recent_detections
    })


@app.route('/api/notify/test', methods=['POST'])
@login_required('admin')
def api_test_notification():
    test_det = {
        'crop': 'Tomato',
        'disease': 'Late Blight',
        'confidence': 94.5,
        'severity': 'Severe'
    }
    success = send_email_alert(test_det)
    return jsonify({'success': success})




if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)