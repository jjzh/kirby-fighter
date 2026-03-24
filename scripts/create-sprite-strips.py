"""
Extract individual sprites from the raw sheet and save row strips
so we can visually identify which animations are which.
"""
from PIL import Image
import json
import os

img = Image.open("public/assets/fighter-kirby-raw.png").convert("RGBA")
bg_color = (32, 176, 216, 255)

with open("scripts/sprite-data.json") as f:
    data = json.load(f)

os.makedirs("scripts/sprite-strips", exist_ok=True)

# For each row, create a strip image showing all sprites side by side
# with a uniform cell height and some padding
for row_idx, row in enumerate(data["rows"]):
    if not row:
        continue

    max_h = max(s["h"] for s in row)
    max_w = max(s["w"] for s in row)
    cell_w = max_w + 4
    cell_h = max_h + 4
    strip_w = cell_w * len(row)
    strip_h = cell_h

    strip = Image.new("RGBA", (strip_w, strip_h), (40, 40, 40, 255))

    for i, s in enumerate(row):
        # Crop sprite from source
        sprite = img.crop((s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]))

        # Make background transparent
        pixels = sprite.load()
        for y in range(sprite.height):
            for x in range(sprite.width):
                r, g, b, a = pixels[x, y]
                dr = abs(r - bg_color[0])
                dg = abs(g - bg_color[1])
                db = abs(b - bg_color[2])
                if dr < 30 and dg < 30 and db < 30:
                    pixels[x, y] = (0, 0, 0, 0)

        # Center in cell
        cx = i * cell_w + (cell_w - s["w"]) // 2
        cy = (cell_h - s["h"]) // 2
        strip.paste(sprite, (cx, cy), sprite)

    strip.save(f"scripts/sprite-strips/row_{row_idx:02d}.png")
    print(f"Row {row_idx:2d}: {len(row)} sprites, cell {cell_w}x{cell_h}")

print("\nStrips saved to scripts/sprite-strips/")
