#!/usr/bin/env python3
"""Делает атлас машин `src/assets/city-cars.webp` чётче: кадры 64 → 128 px.

Исходных 3D-моделей (Kenney Car Kit) в репозитории нет, поэтому каждый кадр растягивается вдвое (Lanczos по
предумноженной альфе), цвет подчёркивается нерезкой маской, край альфы выпрямляется (smoothstep).
Скрипт одноразовый: работает только с атласом 1024 px шириной (16 кадров × 64 px) и не трогает уже обработанный.
Запуск: python3 scripts/sharpen-city-cars.py
"""
import sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

PATH = Path(__file__).resolve().parent.parent / 'src/assets/city-cars.webp'
SRC, DST = 64, 128


def up(cell):
    a = cell.astype(np.float32)
    pre = a.copy(); pre[..., :3] *= a[..., 3:] / 255
    big = cv2.resize(pre, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
    al = np.clip(big[..., 3], 0, 255) / 255
    rgb = np.clip(big[..., :3] / np.maximum(al[..., None], 1e-3), 0, 255)
    rgb = np.clip(rgb + 1.1 * (rgb - cv2.GaussianBlur(rgb, (0, 0), 1.2)), 0, 255)
    t = np.clip((al - .3) / .4, 0, 1)
    return np.dstack([rgb, t * t * (3 - 2 * t) * 255]).astype(np.uint8)


def main():
    im = np.array(Image.open(PATH).convert('RGBA'))
    if im.shape[1] != 16 * SRC:
        sys.exit('Атлас уже обработан или имеет другой размер: %s' % (im.shape,))
    rows = im.shape[0] // SRC
    out = np.zeros((rows * DST, 16 * DST, 4), np.uint8)
    for r in range(rows):
        for c in range(16):
            out[r * DST:(r + 1) * DST, c * DST:(c + 1) * DST] = up(im[r * SRC:(r + 1) * SRC, c * SRC:(c + 1) * SRC])
    Image.fromarray(out, 'RGBA').save(PATH, quality=92, method=6)
    print('записано', out.shape, PATH.stat().st_size // 1024, 'КБ')


if __name__ == '__main__':
    main()
