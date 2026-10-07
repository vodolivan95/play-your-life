"""Воспроизводимые вырезки только из master-карты. Запуск: python3 scripts/build-city-assets.py (Pillow)."""
from pathlib import Path
import math
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / 'src/assets'
source = Image.open(assets / 'coastal-city.jpg').convert('RGB')
assert source.size == (1005, 1280)
buildings = {
    'health': (369, 82, 646, 281),
    'sport': (132, 154, 384, 338),
    'self-development': (675, 166, 1005, 368),
    'english': (689, 412, 1005, 618),
    'finance': (55, 373, 337, 573),
    'joint-tasks': (572, 622, 975, 835),
    'driving': (94, 606, 419, 811),
    'tasks': (390, 802, 678, 981),
    'leisure': (714, 869, 1005, 1091),
}
(assets / 'buildings').mkdir(exist_ok=True)
(assets / 'quest-covers').mkdir(exist_ok=True)
for name, bounds in buildings.items():
    tile = source.crop(bounds)
    tile.thumbnail((480, 320))
    tile.save(assets / f'buildings/{name}.webp', 'WEBP', lossless=True, method=6)
    # Larger photographic composition for a quest, never upscaled from the card tile.
    left, top, right, bottom = bounds
    width = min(600, (right-left)*2)
    height = round(width*0.625)
    x = max(0, min(source.width-width, (left+right-width)//2))
    y = max(0, min(source.height-height, (top+bottom-height)//2))
    source.crop((x,y,x+width,y+height)).save(assets / f'quest-covers/{name}.webp', 'WEBP', lossless=True, method=6)
preview = source.copy()
preview.save(assets / 'city-preview.webp', 'WEBP', lossless=True, method=6)
source.crop((0, 0, 1005, 380)).save(assets / 'city-skyline.webp', 'WEBP', quality=88, method=6)
# Математическое вращение фактуры исходного декоративного глобуса.
# Невидимое полушарие продолжено зеркально, это не новая географическая карта.
size = 80
atlas = Image.new('RGBA', (size * 32, size))
for frame in range(32):
    tile = Image.new('RGBA', (size, size))
    output = tile.load()
    angle = frame * 2 * math.pi / 32
    for y in range(size):
        ny = (y - (size - 1) / 2) / (size / 2 - 1)
        for x in range(size):
            nx = (x - (size - 1) / 2) / (size / 2 - 1)
            if nx * nx + ny * ny > 1:
                continue
            nz = math.sqrt(max(0, 1 - nx * nx - ny * ny))
            rx = nx * math.cos(angle) + nz * math.sin(angle)
            color = source.getpixel((round(502 + rx * 35), round(499 + ny * 35)))
            shade = .83 + .17 * nz
            output[x, y] = tuple(round(c * shade) for c in color) + (255,)
    atlas.paste(tile, (frame * size, 0))
atlas.save(assets / 'city-globe.webp', 'WEBP', quality=88, method=6)
print('Девять фотографий, превью, панорама и декоративный глобус обновлены из master-карты.')
