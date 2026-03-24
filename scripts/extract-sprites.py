"""
Scan the raw Fighter Kirby spritesheet, find all individual sprite bounding boxes,
and output their coordinates. The background is cyan (0, 160, 224) or similar.
"""
from PIL import Image
import json

img = Image.open("public/assets/fighter-kirby-raw.png").convert("RGBA")
pixels = img.load()
w, h = img.size

# Find the background color (most common color = cyan background)
# Sample the top-left corner
bg = pixels[0, 0]
print(f"Background color: {bg}")

# Create a binary mask: True = sprite pixel, False = background
# Allow some tolerance for anti-aliased edges
def is_sprite(px):
    if px[3] < 128:
        return False
    r, g, b, a = px
    # Background is (32, 176, 216) — use tolerance
    dr, dg, db = abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2])
    if dr < 30 and dg < 30 and db < 30:
        return False
    return True

mask = [[False] * w for _ in range(h)]
for y in range(h):
    for x in range(w):
        mask[y][x] = is_sprite(pixels[x, y])

# Flood-fill to find connected components (sprites)
visited = [[False] * w for _ in range(h)]
sprites = []

def flood_fill(sx, sy):
    """BFS flood fill, returns bounding box (x, y, w, h)"""
    stack = [(sx, sy)]
    min_x, min_y = sx, sy
    max_x, max_y = sx, sy
    pixel_count = 0

    while stack:
        x, y = stack.pop()
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        if visited[y][x] or not mask[y][x]:
            continue
        visited[y][x] = True
        pixel_count += 1
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x)
        max_y = max(max_y, y)

        # 4-connected neighbors + diagonals for better grouping
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                stack.append((x + dx, y + dy))

    return min_x, min_y, max_x - min_x + 1, max_y - min_y + 1, pixel_count

# Allow a small gap (2px) between connected parts of the same sprite
# by dilating the mask first
import sys
sys.setrecursionlimit(100000)

for y in range(h):
    for x in range(w):
        if mask[y][x] and not visited[y][x]:
            bx, by, bw, bh, count = flood_fill(x, y)
            # Filter out tiny noise (less than 20 pixels) and the text labels
            if count >= 20 and bw >= 8 and bh >= 8:
                sprites.append({
                    "x": bx, "y": by, "w": bw, "h": bh,
                    "pixels": count
                })

# Sort by y then x (top-to-bottom, left-to-right)
sprites.sort(key=lambda s: (s["y"], s["x"]))

print(f"\nFound {len(sprites)} sprites\n")

# Group by rows (sprites within 8px vertical distance = same row)
rows = []
current_row = []
last_y = -100
for s in sprites:
    if abs(s["y"] - last_y) > 12:
        if current_row:
            rows.append(current_row)
        current_row = []
    current_row.append(s)
    last_y = s["y"]
if current_row:
    rows.append(current_row)

for i, row in enumerate(rows):
    sizes = [f"{s['w']}x{s['h']}" for s in row]
    y_range = f"y={row[0]['y']}-{row[0]['y']+max(s['h'] for s in row)}"
    print(f"Row {i:2d} ({y_range:12s}): {len(row):2d} sprites  sizes: {', '.join(sizes[:8])}{'...' if len(sizes) > 8 else ''}")

# Output full data as JSON
with open("scripts/sprite-data.json", "w") as f:
    json.dump({"rows": [[s for s in row] for row in rows]}, f, indent=2)

print(f"\nFull data written to scripts/sprite-data.json")
