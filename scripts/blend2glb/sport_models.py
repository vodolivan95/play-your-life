"""Авторские 3D-модели спортзала (CC0, PLAY YOUR LIFE).

Запуск: python3 scripts/blend2glb/sport_models.py → public/models/sport/*.glb
Метры, ось Y вверх, основание на y=0, модель по центру своей клетки.
Длинная сторона: вдоль X для коврика, скамьи, стойки; вдоль Z для дорожки и велотренажёра.
Пользователь может заменить любой файл своей GLB-моделью с тем же именем.
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from procedural import Scene, lathe, box, torus, bumpy_sphere, write_glb, rot

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'sport')
I3 = np.eye(3, dtype=np.float32)


def at(x, y, z):
    return np.array([x, y, z], np.float32)


def put_box(s, mat, size, center, R=I3):
    s.add(*box(*size), mat, (R, at(*center)))


def cyl(s, mat, r, h, center, axis='y', seg=28, caps=True):
    """Цилиндр с отдельными крышками (резкий край, правильные нормали)."""
    R = I3 if axis == 'y' else rot('z', 90) if axis == 'x' else rot('x', 90)
    s.add(*lathe([(r, -h / 2), (r, h / 2)], seg), mat, (R, at(*center)))
    if caps:
        s.add(*lathe([(r, h / 2), (0, h / 2)], seg), mat, (R, at(*center)))
        s.add(*lathe([(0, -h / 2), (r, -h / 2)], seg), mat, (R, at(*center)))


def tube(s, mat, a, b, r=0.02, seg=14):
    """Труба между двумя точками."""
    a, b = at(*a), at(*b)
    d = b - a; L = float(np.linalg.norm(d)); y = d / L
    x = np.cross(y, [0, 0, 1]) if abs(y[2]) < 0.9 else np.cross(y, [1, 0, 0])
    x /= np.linalg.norm(x); z = np.cross(x, y)
    R = np.stack([x, y, z], 1).astype(np.float32)
    s.add(*lathe([(r, -L / 2), (r, L / 2)], seg), mat, (R, (a + b) / 2))


def sphere(s, mat, r, center, seg=32):
    p, n, uv, idx = bumpy_sphere(r, seg, seg // 2, 0.0)
    s.add(p, n, uv, idx, mat, (I3, at(*center)))


def palette(s):
    return dict(
        steel=s.material('steel', (0.62, 0.65, 0.7), 0.3, 1.0),
        black=s.material('black-metal', (0.08, 0.09, 0.1), 0.45, 0.6),
        rubber=s.material('rubber', (0.05, 0.05, 0.06), 0.85),
        accent=s.material('accent', (0.13, 0.55, 0.95), 0.4, 0.2),
        red=s.material('red', (0.85, 0.12, 0.14), 0.5),
        leather=s.material('leather', (0.65, 0.08, 0.1), 0.55),
        pad=s.material('pad', (0.1, 0.11, 0.13), 0.7),
        screen=s.material('screen', (0.02, 0.1, 0.15), 0.2, 0, emissive=(0.1, 0.65, 0.9)),
        gold=s.material('gold', (0.95, 0.72, 0.25), 0.25, 1.0),
    )


def treadmill():
    s = Scene(); m = palette(s)
    put_box(s, m['black'], (0.86, 0.16, 2.1), (0, 0.13, 0.1))
    put_box(s, m['rubber'], (0.62, 0.025, 1.85), (0, 0.22, 0.12))
    for z in (-0.82, 1.06):
        cyl(s, m['steel'], 0.05, 0.64, (0, 0.17, z), 'x')
    put_box(s, m['accent'], (0.88, 0.2, 0.35), (0, 0.18, -0.95))  # кожух мотора
    for x in (-0.42, 0.42):
        put_box(s, m['rubber'], (0.06, 0.04, 2.05), (x, 0.235, 0.1))  # боковые площадки
        tube(s, m['black'], (x, 0.2, -0.95), (x, 1.25, -1.2), 0.035)  # стойки
        tube(s, m['steel'], (x, 1.0, -1.05), (x, 1.0, -0.35), 0.025)  # поручни
    put_box(s, m['black'], (0.92, 0.34, 0.16), (0, 1.3, -1.18), rot('x', -28))
    put_box(s, m['screen'], (0.62, 0.22, 0.02), (0, 1.33, -1.1), rot('x', -28))
    for x in (-0.42, 0.42):
        for z in (-1.0, 1.1):
            put_box(s, m['rubber'], (0.12, 0.06, 0.14), (x, 0.03, z))
    return s


def exercise_bike():
    s = Scene(); m = palette(s)
    put_box(s, m['black'], (0.5, 0.06, 0.12), (0, 0.04, -0.62))
    put_box(s, m['black'], (0.5, 0.06, 0.12), (0, 0.04, 0.62))
    put_box(s, m['black'], (0.1, 0.08, 1.24), (0, 0.08, 0))
    cyl(s, m['steel'], 0.25, 0.07, (0, 0.38, -0.42), 'x', 40)  # маховик
    cyl(s, m['accent'], 0.18, 0.08, (0, 0.38, -0.42), 'x', 40, caps=True)
    put_box(s, m['accent'], (0.14, 0.62, 0.12), (0, 0.42, -0.08), rot('x', 18))
    tube(s, m['black'], (0, 0.12, 0.3), (0, 0.78, 0.2), 0.035)
    put_box(s, m['pad'], (0.24, 0.07, 0.3), (0, 0.84, 0.2))  # седло
    tube(s, m['black'], (0, 0.5, -0.32), (0, 1.08, -0.42), 0.035)
    tube(s, m['steel'], (-0.25, 1.1, -0.45), (0.25, 1.1, -0.45), 0.022)
    put_box(s, m['screen'], (0.2, 0.12, 0.03), (0, 1.2, -0.4), rot('x', -30))
    for x in (-0.13, 0.13):
        put_box(s, m['rubber'], (0.12, 0.03, 0.06), (x, 0.38, -0.12))  # педали
    return s


def boxing_bag():
    s = Scene(); m = palette(s)
    cyl(s, m['black'], 0.42, 0.06, (0, 0.03, 0), seg=40)
    for k in range(3):
        cyl(s, m['steel'], 0.3 - k * 0.03, 0.04, (0, 0.08 + k * 0.045, 0), seg=40)
    tube(s, m['black'], (0, 0.06, 0.3), (0, 2.2, 0.3), 0.045)
    tube(s, m['black'], (0, 2.15, 0.3), (0, 2.15, -0.05), 0.035)
    tube(s, m['steel'], (0, 2.13, -0.05), (0, 1.75, -0.05), 0.008)
    cyl(s, m['leather'], 0.18, 0.95, (0, 1.22, -0.05), seg=36)
    cyl(s, m['black'], 0.182, 0.06, (0, 1.68, -0.05), seg=36)
    cyl(s, m['black'], 0.182, 0.06, (0, 0.77, -0.05), seg=36)
    return s


def dumbbell(s, m, x, y, z, size, plate_mat):
    cyl(s, m['steel'], 0.018, 0.34 + size * 0.1, (x, y, z), 'x', 12)
    for side in (-1, 1):
        cyl(s, plate_mat, 0.05 + size * 0.025, 0.06 + size * 0.02, (x + side * (0.12 + size * 0.04), y, z), 'x', 20)


def dumbbell_rack():
    s = Scene(); m = palette(s)
    colors = [s.material(f'plate{k}', c, 0.6) for k, c in enumerate([(0.85, 0.15, 0.2), (0.1, 0.45, 0.9), (0.95, 0.75, 0.15), (0.2, 0.7, 0.35), (0.12, 0.12, 0.14)])]
    for x in (-0.85, 0.85):
        put_box(s, m['black'], (0.06, 0.06, 0.6), (x, 0.03, 0))
        tube(s, m['black'], (x, 0.05, 0.22), (x, 0.72, 0.0), 0.03)
        tube(s, m['black'], (x, 0.05, -0.22), (x, 0.72, 0.0), 0.03)
    for y, z in ((0.42, 0.12), (0.66, -0.06)):
        put_box(s, m['black'], (1.76, 0.03, 0.2), (0, y, z), rot('x', 12))
    for i in range(5):
        dumbbell(s, m, -0.66 + i * 0.33, 0.47, 0.12, 4 - i, colors[i])
        dumbbell(s, m, -0.66 + i * 0.33, 0.71, -0.06, 2 - i * 0.3, colors[(i + 2) % 5])
    return s


def power_rack():
    s = Scene(); m = palette(s)
    for x in (-0.6, 0.6):
        for z in (-0.6, 0.6):
            put_box(s, m['black'], (0.07, 2.2, 0.07), (x, 1.1, z))
        put_box(s, m['black'], (0.07, 0.07, 1.27), (x, 2.2, 0))
        put_box(s, m['black'], (0.07, 0.05, 1.27), (x, 0.03, 0))
        for z in (-0.6, 0.6):
            put_box(s, m['red'], (0.12, 0.05, 0.1), (x, 1.35, z + (0.06 if z < 0 else -0.06)))
    for z in (-0.6, 0.6):
        put_box(s, m['black'], (1.27, 0.07, 0.07), (0, 2.2, z))
    cyl(s, m['steel'], 0.016, 2.1, (0, 1.42, 0.55), 'x', 14)  # гриф
    for side in (-1, 1):
        for k, (r, w) in enumerate(((0.22, 0.05), (0.18, 0.04))):
            cyl(s, m['rubber'], r, w, (side * (0.7 + k * 0.055), 1.42, 0.55), 'x', 32)
    tube(s, m['steel'], (-0.6, 2.1, -0.6), (0.6, 2.1, -0.6), 0.02)  # турник
    return s


def kettlebells():
    s = Scene(); m = palette(s)
    for k, (x, z, r, mat) in enumerate(((-0.22, 0.1, 0.13, m['black']), (0.08, -0.12, 0.11, m['accent']), (0.26, 0.18, 0.09, m['red']))):
        sphere(s, mat, r, (x, r * 0.95, z))
        R = rot('x', 90)
        s.add(*torus(r * 0.55, r * 0.14, 32, 10), mat, (R, at(x, r * 1.9, z)))
    return s


def mat():
    s = Scene(); m = palette(s)
    purple = s.material('mat', (0.45, 0.3, 0.85), 0.8)
    put_box(s, purple, (1.6, 0.012, 0.62), (-0.1, 0.006, 0))
    cyl(s, purple, 0.07, 0.62, (0.77, 0.07, 0), 'z', 32)
    cyl(s, m['steel'], 0.04, 0.24, (0.55, 0.12, 0.42), 'y', 20)  # бутылка воды
    cyl(s, m['accent'], 0.025, 0.04, (0.55, 0.26, 0.42), 'y', 16)
    return s


def dumbbells():
    s = Scene(); m = palette(s)
    for z in (-0.16, 0.16):
        dumbbell(s, m, 0, 0.09, z, 2, m['rubber'])
    return s


def bench():
    s = Scene(); m = palette(s)
    put_box(s, m['pad'], (1.45, 0.09, 0.32), (0, 0.48, 0))
    put_box(s, m['black'], (1.3, 0.06, 0.12), (0, 0.4, 0))
    for x in (-0.55, 0.55):
        tube(s, m['black'], (x, 0.38, 0), (x, 0.05, 0), 0.03)
        put_box(s, m['black'], (0.08, 0.05, 0.5), (x, 0.025, 0))
    return s


def ball():
    s = Scene()
    blue = s.material('ball', (0.2, 0.55, 0.95), 0.35)
    sphere(s, blue, 0.32, (0, 0.32, 0), 48)
    return s


def plant():
    s = Scene()
    pot = s.material('pot', (0.92, 0.9, 0.86), 0.6)
    soil = s.material('soil', (0.25, 0.18, 0.12), 0.95)
    leaf = s.material('leaf', (0.22, 0.6, 0.3), 0.55, double=True)
    leaf2 = s.material('leaf-light', (0.38, 0.72, 0.36), 0.55, double=True)
    s.add(*lathe([(0.17, 0.0), (0.22, 0.38), (0.23, 0.42)], 32), pot)
    s.add(*lathe([(0.21, 0.38), (0.0, 0.38)], 32), soil)
    rng = np.random.default_rng(3)
    for k in range(14):
        a = k * 137.5; tilt = 25 + rng.uniform(0, 35); L = 0.45 + rng.uniform(0, 0.35)
        # лист — изогнутая лента из двух треугольников по длине
        pts, nor, uv, idx = [], [], [], []
        n = 8
        for i in range(n + 1):
            t = i / n; w = math.sin(math.pi * t) * 0.07
            y = t * L; zc = (t ** 2) * L * 0.35
            for sgn in (-1, 1):
                pts.append((sgn * w, y, zc)); nor.append((0, -0.3, 1)); uv.append(((sgn + 1) / 2, t))
        for i in range(n):
            p = 2 * i
            idx += [p, p + 1, p + 2, p + 1, p + 3, p + 2]
        R = rot('y', a) @ rot('x', -tilt)
        s.add(pts, nor, uv, idx, leaf if k % 2 else leaf2, (R, at(0, 0.4, 0)))
    return s


def trophy():
    s = Scene(); m = palette(s)
    s.add(*lathe([(0.0, 0.0), (0.07, 0.0), (0.07, 0.03), (0.05, 0.035), (0.05, 0.06)], 32), m['black'])
    s.add(*lathe([(0.012, 0.06), (0.012, 0.12), (0.03, 0.14), (0.065, 0.2), (0.075, 0.26), (0.07, 0.27)], 32), m['gold'])
    for side in (-1, 1):
        s.add(*torus(0.035, 0.007, 20, 8), m['gold'], (rot('x', 90), at(side * 0.08, 0.22, 0)))
    return s


MODELS = {'treadmill': treadmill, 'exercise-bike': exercise_bike, 'boxing-bag': boxing_bag, 'dumbbell-rack': dumbbell_rack,
          'power-rack': power_rack, 'kettlebells': kettlebells, 'mat': mat, 'dumbbells': dumbbells, 'bench': bench,
          'ball': ball, 'plant': plant, 'trophy': trophy}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, build in MODELS.items():
        write_glb(build(), os.path.join(OUT, f'{name}.glb'))
