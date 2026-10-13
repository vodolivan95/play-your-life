#!/usr/bin/env python3
"""Проверка непрозрачности спрайтов жителей: доля «дыр» (alpha < 250) внутри силуэта, сжатого на 2 px.

Пишет scripts/city-people-metrics.json; его читает tests/alive-city.test.ts.
Запуск: python3 scripts/measure-city-people.py
"""
import glob, json
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
out = {}
for f in sorted(glob.glob(str(ROOT / 'src/assets/city-people/*.webp'))):
    a = np.array(Image.open(f).convert('RGBA'))[..., 3]
    c = a.shape[1] // 8
    worst, mean_alpha, cells, body = 0.0, [], 0, []
    for r in range(8):
        for k in range(8):
            cell = a[r * c:(r + 1) * c, k * c:(k + 1) * c]
            inner = cv2.erode((cell > 128).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2)
            if not inner.sum():
                continue
            cells += 1
            worst = max(worst, float(((cell < 250) & (inner > 0)).sum() / inner.sum()))
            mean_alpha.append(float(cell[inner > 0].mean() / 255))
            body.append(int(inner.sum()))
    out[Path(f).name] = {'cells': cells, 'worstHoleShare': round(worst, 4),
                         'meanInteriorAlpha': round(float(np.mean(mean_alpha)), 4), 'minInteriorPixels': min(body)}
(ROOT / 'scripts/city-people-metrics.json').write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(out, indent=2))
