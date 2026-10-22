"""Generates a placeholder building image for the "Психология" sphere card.

This is NOT painted into the master island artwork (life-city.webp / city-wide.webp) —
it is only a standalone illustration used for the sphere's district/goal-cover card,
in the same slot `sphere-buildings/*.jpg` fills for the other nine spheres. It is a
simple generated placeholder, not photographic, and is meant to be replaced with real
artwork matching the other buildings once that is commissioned.
"""
import math
import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(7)
W = H = 1280
img = Image.new('RGB', (W, H), '#2a2250')
draw = ImageDraw.Draw(img)

# Soft vertical gradient sky: deep indigo -> warm lilac near the horizon.
top = (26, 20, 56)
bottom = (120, 101, 196)
for y in range(H):
    t = y / H
    r = int(top[0] + (bottom[0] - top[0]) * t)
    g = int(top[1] + (bottom[1] - top[1]) * t)
    b = int(top[2] + (bottom[2] - top[2]) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Soft glow behind the building.
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([W * 0.5 - 420, H * 0.62 - 420, W * 0.5 + 420, H * 0.62 + 420], fill=(255, 224, 170, 90))
glow = glow.filter(ImageFilter.GaussianBlur(90))
img.paste(Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB'))

# Ground.
ground_y = int(H * 0.74)
draw.rectangle([0, ground_y, W, H], fill=(58, 46, 94))
for i in range(0, W, 46):
    draw.line([(i, ground_y), (i - 30, H)], fill=(66, 53, 106), width=6)

cx = W * 0.5
base_y = ground_y + 10
roof_w, wall_w = 520, 460
wall_h = 300
roof_h = 170

# Pavilion-style single-storey building, a calm "garden room".
wall_top = base_y - wall_h
draw.rounded_rectangle([cx - wall_w / 2, wall_top, cx + wall_w / 2, base_y], radius=18, fill=(245, 240, 232))
# Roof (soft triangular hip roof).
draw.polygon([
    (cx - roof_w / 2, wall_top + 14),
    (cx, wall_top - roof_h),
    (cx + roof_w / 2, wall_top + 14),
], fill=(106, 79, 214))
draw.polygon([
    (cx - roof_w / 2 - 20, wall_top + 26),
    (cx, wall_top - roof_h + 16),
    (cx + roof_w / 2 + 20, wall_top + 26),
    (cx + roof_w / 2, wall_top + 14),
    (cx - roof_w / 2, wall_top + 14),
], fill=(90, 66, 186))

# Door, glowing warmly.
door_w, door_h = 120, 190
draw.rounded_rectangle([cx - door_w / 2, base_y - door_h, cx + door_w / 2, base_y], radius=14, fill=(138, 114, 214))
draw.ellipse([cx - door_w / 2 + 14, base_y - door_h + 10, cx + door_w / 2 - 14, base_y - door_h + 10 + 160], fill=(255, 224, 170))

# Side windows.
for sign in (-1, 1):
    wx = cx + sign * 170
    draw.rounded_rectangle([wx - 55, base_y - 150, wx + 55, base_y - 40], radius=16, fill=(255, 224, 170))
    draw.line([(wx, base_y - 150), (wx, base_y - 40)], fill=(106, 79, 214), width=6)
    draw.line([(wx - 55, base_y - 95), (wx + 55, base_y - 95)], fill=(106, 79, 214), width=6)

# A simple potted plant on each side for warmth.
for sign in (-1, 1):
    px = cx + sign * (wall_w / 2 + 60)
    py = base_y
    draw.ellipse([px - 26, py - 70, px + 26, py - 18], fill=(143, 174, 138))
    draw.ellipse([px - 34, py - 55, px + 34, py - 3], fill=(122, 154, 118))
    draw.polygon([(px - 24, py), (px + 24, py), (px + 16, py + 34), (px - 16, py + 34)], fill=(176, 122, 74))

# Soft mind/leaf emblem above the roof, echoing the sphere icon.
ex, ey, er = cx, wall_top - roof_h - 70, 46
draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(255, 255, 255, 255), outline=None)
for i in range(5):
    a0 = -math.pi * 0.6 + i * 0.32
    draw.arc([ex - er + 10, ey - er + 10, ex + er - 10, ey + er - 10], math.degrees(a0), math.degrees(a0 + 1.0), fill=(106, 79, 214), width=4)

img = img.filter(ImageFilter.SMOOTH)
out_jpg = 'src/assets/sphere-buildings/psychology-building.jpg'
img.save(out_jpg, quality=90)
print('saved', out_jpg, img.size)
