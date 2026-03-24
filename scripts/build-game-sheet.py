"""
Build a clean game spritesheet from the raw Fighter Kirby sheet.
Extracts specific frames for each animation, places them in a uniform grid,
and generates a Phaser texture atlas JSON.
"""
from PIL import Image
import json

img = Image.open("public/assets/fighter-kirby-raw.png").convert("RGBA")
bg_color = (32, 176, 216)

with open("scripts/sprite-data.json") as f:
    data = json.load(f)

rows = data["rows"]

def get_sprite(row_idx, sprite_idx):
    """Get sprite info from row and index."""
    return rows[row_idx][sprite_idx]

def extract_sprite(s):
    """Extract a sprite and make cyan background transparent."""
    sprite = img.crop((s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]))
    pixels = sprite.load()
    for y in range(sprite.height):
        for x in range(sprite.width):
            r, g, b, a = pixels[x, y]
            if abs(r - bg_color[0]) < 30 and abs(g - bg_color[1]) < 30 and abs(b - bg_color[2]) < 30:
                pixels[x, y] = (0, 0, 0, 0)
    return sprite

# Define animation frames: (row_idx, sprite_idx) for each animation
# Selected by visual inspection of the strip images
animations = {
    "idle": [
        (16, 0), (16, 1), (16, 2), (16, 1),  # Standing idle, 4 frames loop
    ],
    "run": [
        (0, 0), (0, 1), (0, 7), (0, 8), (0, 9), (0, 10),  # Walk cycle 6 frames
    ],
    "jump": [
        (3, 0), (3, 1),  # Jump ascend
    ],
    "fall": [
        (3, 4), (3, 5),  # Falling
    ],
    "light": [
        (10, 2), (10, 3), (10, 4), (10, 5),  # Punch sequence
    ],
    "heavy": [
        (7, 0), (7, 1), (7, 2), (7, 3), (7, 4), (7, 5),  # Kick sequence
    ],
    "inhale": [
        (5, 2), (5, 3),  # Mouth open, sucking
    ],
    "capture": [
        (15, 0), (15, 1),  # Puffed up holding someone
    ],
    "hitstun": [
        (2, 0), (2, 1), (2, 2), (2, 3),  # Tumbling
    ],
    "dead": [
        (9, 0), (9, 1),  # KO tumble
    ],
}

# Calculate total frames and layout
CELL_SIZE = 48  # Each cell in the output sheet
SCALE = 2  # Scale up GBA sprites (they're ~24px, we want ~48px)
COLS = 8  # Columns in output sheet

all_frames = []
for anim_name, frame_defs in animations.items():
    for i, (row_idx, sprite_idx) in enumerate(frame_defs):
        all_frames.append({
            "name": f"{anim_name}_{i}",
            "anim": anim_name,
            "src": get_sprite(row_idx, sprite_idx),
        })

total_frames = len(all_frames)
sheet_cols = COLS
sheet_rows = (total_frames + sheet_cols - 1) // sheet_cols
sheet_w = sheet_cols * CELL_SIZE
sheet_h = sheet_rows * CELL_SIZE

print(f"Total frames: {total_frames}")
print(f"Sheet size: {sheet_w}x{sheet_h} ({sheet_cols}x{sheet_rows} cells of {CELL_SIZE}px)")

# Create output spritesheet
sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
atlas_frames = {}

for idx, frame in enumerate(all_frames):
    col = idx % sheet_cols
    row = idx // sheet_cols
    cell_x = col * CELL_SIZE
    cell_y = row * CELL_SIZE

    sprite = extract_sprite(frame["src"])

    # Scale up
    new_w = sprite.width * SCALE
    new_h = sprite.height * SCALE
    sprite = sprite.resize((new_w, new_h), Image.NEAREST)

    # Center in cell
    paste_x = cell_x + (CELL_SIZE - new_w) // 2
    paste_y = cell_y + (CELL_SIZE - new_h) // 2

    sheet.paste(sprite, (paste_x, paste_y), sprite)

    atlas_frames[frame["name"]] = {
        "frame": {"x": cell_x, "y": cell_y, "w": CELL_SIZE, "h": CELL_SIZE},
        "sourceSize": {"w": CELL_SIZE, "h": CELL_SIZE},
        "spriteSourceSize": {"x": 0, "y": 0, "w": CELL_SIZE, "h": CELL_SIZE},
    }

# Save spritesheet
sheet.save("public/assets/fighter-kirby.png")
print(f"Saved spritesheet: public/assets/fighter-kirby.png")

# Save Phaser atlas JSON
atlas = {
    "frames": atlas_frames,
    "meta": {
        "image": "fighter-kirby.png",
        "size": {"w": sheet_w, "h": sheet_h},
        "scale": 1,
    },
}
with open("public/assets/fighter-kirby.json", "w") as f:
    json.dump(atlas, f, indent=2)
print(f"Saved atlas: public/assets/fighter-kirby.json")

# Print animation map for use in code
print("\n// Animation frame names:")
for anim_name, frame_defs in animations.items():
    frame_names = [f"{anim_name}_{i}" for i in range(len(frame_defs))]
    print(f"//   {anim_name}: {frame_names}")
