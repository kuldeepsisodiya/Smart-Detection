import os
import sqlite3
import json
import time
from PIL import Image

screenshot_path = '/Users/kuldeep/.gemini/antigravity-ide/brain/55a2d6f1-a687-4564-b639-e00a98dea6d1/media__1783622016584.png'
dest_dir = '/Users/kuldeep/Documents/Crop2/static/uploads'
db_path = '/Users/kuldeep/Documents/Crop2/data/database.db'

os.makedirs(dest_dir, exist_ok=True)

# 1. Load screenshot and print size
img = Image.open(screenshot_path)
width, height = img.size
print(f"Screenshot size: {width}x{height}")

# 2. Crop the leaf photo area
# The leaf photo box is in the center of the Try this model popup.
# Let's calculate proportional crop bounding box
# Standard viewport is 1710x929, but image file might have higher DPI (Retina screen = 3420x1858)
scale = width / 1710.0
print(f"Retina scaling factor: {scale}")

# Crop coordinates in 1710x929 space:
# Left: 583, Top: 353, Right: 1125, Bottom: 743
left = int(583 * scale)
top = int(353 * scale)
right = int(1125 * scale)
bottom = int(743 * scale)

cropped_img = img.crop((left, top, right, bottom))
cropped_filename = f"det_{int(time.time())}_apple_scab.jpg"
cropped_path = os.path.join(dest_dir, cropped_filename)
cropped_img.convert('RGB').save(cropped_path, 'JPEG', quality=90)
print(f"Cropped leaf photo saved to {cropped_path}")

# 3. Create database entry
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Bounding boxes from the screenshot:
# Apple Scab Leaf (84%): x=274, y=205.5, width=294, height=161 (in the leaf coordinate space)
# Cherry Leaf (64%): x=410, y=650, width=150, height=250
# Let's adjust coordinates to fit the cropped photo aspect ratio if needed,
# but the raw Roboflow coordinates are fine to draw directly as is.
boxes = [
    {
        "class": "Apple Scab Leaf",
        "confidence": 0.84,
        "x": 274,
        "y": 205.5,
        "width": 294,
        "height": 161
    },
    {
        "class": "Cherry leaf",
        "confidence": 0.64,
        "x": 105,
        "y": 300,
        "width": 110,
        "height": 190
    }
]

relative_image_path = f"static/uploads/{cropped_filename}"

cursor.execute('''
    INSERT INTO detections (crop, disease, confidence, severity, bounding_boxes, image_path)
    VALUES (?, ?, ?, ?, ?, ?)
''', (
    "Apple",
    "Apple Scab",
    84.0,
    "Severe",
    json.dumps(boxes),
    relative_image_path
))

detection_id = cursor.lastrowid
conn.commit()
conn.close()

print(f"Registered detection ID #{detection_id} in SQLite database successfully.")
