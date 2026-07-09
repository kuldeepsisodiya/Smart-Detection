import os
import sqlite3
import glob

db_path = '/Users/kuldeep/Documents/Crop2/data/database.db'
uploads_dir = '/Users/kuldeep/Documents/Crop2/static/uploads'
backups_dir = '/Users/kuldeep/Documents/Crop2/data/backups'
env_path = '/Users/kuldeep/Documents/Crop2/.env'

# 1. Reset database tables
if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Clear logs
        cursor.execute("DELETE FROM detections")
        cursor.execute("DELETE FROM irrigation_log")
        
        # Reset settings
        cursor.execute("UPDATE settings SET value = '' WHERE key = 'roboflow_api_key'")
        cursor.execute("UPDATE settings SET value = '' WHERE key = 'smtp_password'")
        cursor.execute("UPDATE settings SET value = '' WHERE key = 'smtp_sender'")
        cursor.execute("UPDATE settings SET value = '' WHERE key = 'smtp_receiver'")
        
        conn.commit()
        conn.close()
        print("Database tables cleared and configurations reset.")
    except Exception as e:
        print(f"Error resetting database: {e}")
else:
    print("No database file found to clear.")

# 2. Clear uploaded files
if os.path.exists(uploads_dir):
    files = glob.glob(os.path.join(uploads_dir, '*'))
    for f in files:
        if os.path.basename(f) != '.gitkeep':
            try:
                os.remove(f)
            except Exception as e:
                print(f"Error deleting file {f}: {e}")
    
    # Ensure .gitkeep exists so Git tracks the directory
    gitkeep_path = os.path.join(uploads_dir, '.gitkeep')
    with open(gitkeep_path, 'w') as gk:
        pass
    print("Static uploads cleared.")

# 3. Clear backups
if os.path.exists(backups_dir):
    backups = glob.glob(os.path.join(backups_dir, '*'))
    for b in backups:
        try:
            os.remove(b)
        except Exception as e:
            print(f"Error deleting backup {b}: {e}")
    print("Database backups cleared.")

# 4. Overwrite .env with template
try:
    with open(env_path, 'w') as f:
        f.write("# Roboflow API configuration\nROBOFLOW_API_KEY=\n")
    print(".env file reset to template.")
except Exception as e:
    print(f"Error resetting .env: {e}")

print("Repository cleanup completed successfully.")
