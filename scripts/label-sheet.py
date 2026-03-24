"""Create a labeled copy of the raw sheet with row numbers and sprite indices
sorted LEFT-TO-RIGHT within each row."""
from PIL import Image, ImageDraw
import json

img = Image.open("public/assets/fighter-kirby-raw.png").convert("RGBA")
img = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
draw = ImageDraw.Draw(img)

with open("scripts/sprite-data.json") as f:
    data = json.load(f)

# Sort sprites within each row by x position
sorted_rows = []
for row in data["rows"]:
    sorted_rows.append(sorted(row, key=lambda s: s["x"]))

# Also save the sorted data so build-game-sheet can use it
with open("scripts/sprite-data-sorted.json", "w") as f:
    json.dump({"rows": sorted_rows}, f, indent=2)

for row_idx, row in enumerate(sorted_rows):
    if not row:
        continue

    min_y = min(s["y"] for s in row) * 2

    # Row label
    draw.text((2, min_y), f"R{row_idx}", fill=(255, 255, 0, 255))
    draw.line([(0, min_y - 1), (img.width, min_y - 1)], fill=(255, 255, 0, 80), width=1)

    # Number each sprite L-R
    for sprite_idx, s in enumerate(row):
        sx = s["x"] * 2
        sy = s["y"] * 2
        sw = s["w"] * 2
        sh = s["h"] * 2
        draw.rectangle([(sx, sy), (sx + sw, sy + sh)], outline=(0, 255, 0, 120), width=1)
        draw.text((sx + 1, sy + 1), str(sprite_idx), fill=(255, 255, 0, 255))

img.save("scripts/labeled-sheet.png")
print(f"Saved labeled sheet (sorted L-R): scripts/labeled-sheet.png")
