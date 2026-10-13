#!/usr/bin/env python3
"""Маршруты «живого города» для широкой карты: тротуары вдоль дорог и пути судов по открытой воде.

Строит `src/cityLive/wideLife.ts` из трёх источников, ничего не рисуя «на глаз»:
  * тротуары — смещённые копии полос машин `wide-*` (правая рука по ходу полосы = край дороги);
  * корабли — кратчайшие пути по маске воды: синие пиксели карты ∩ водные области профиля,
    путь тянется по «глубокой» воде (карта расстояний до берега), дальше сглаживание и упрощение;
  * проверка: каждая точка судового маршрута не ближе MIN_SHORE px к берегу.

Запуск (нужны numpy, opencv, scikit-image, Pillow и Node 22): python3 scripts/build-wide-life.py
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
from skimage.graph import route_through_array

ROOT = Path(__file__).resolve().parent.parent
W, H = 2000, 1125
MAX_POINTS = 95
PLAZA_CAP = {'wide-plaza-globe': 12}
PLAZA_SPEED = {}
MARGIN = 9.0  # пешеходы не ближе 9 px к воде
MAX_WET = 0.03  # доля точек маршрута ближе 4 px к воде, выше которой маршрут отбрасывается


def dump():
    code = ("import { wideProfile as p } from '%s/src/cityLive/wideMap.ts';"
            "import { basePlazaRoutes as b } from '%s/src/cityLive/wideMap.ts';"
            "console.log(JSON.stringify({regions:p.waterRegions,routes:[...p.routes.filter(r=>r.kind!=='pedestrian'),...b].map(r=>({id:r.id,kind:r.kind,closed:r.closed,"
            "pts:r.points.map(q=>[q.x*p.width,q.y*p.height])}))}));") % (ROOT, ROOT)
    out = subprocess.run(['node', '--experimental-strip-types', '-e', code, '--input-type=module'], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def resample(p, step=6.0):
    p = np.array(p, float); seg = np.hypot(*np.diff(p, axis=0).T); L = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, L[-1], max(2, int(L[-1] / step)))
    return np.stack([np.interp(t, L, p[:, 0]), np.interp(t, L, p[:, 1])], 1)


def smooth(p, it=3, closed=False):
    p = np.array(p, float)
    for _ in range(it):
        q = p.copy()
        if closed: q = (np.roll(p, 1, 0) + 2 * p + np.roll(p, -1, 0)) / 4
        else: q[1:-1] = (p[:-2] + 2 * p[1:-1] + p[2:]) / 4
        p = q
    return p


def offset_right(p, d, closed=False):
    """Смещение вправо по ходу (в экранных осях: y вниз)."""
    p = np.array(p, float)
    t = (np.roll(p, -1, 0) - np.roll(p, 1, 0)) if closed else np.gradient(p, axis=0)
    t /= np.maximum(np.hypot(*t.T)[:, None], 1e-9)
    return p + np.stack([-t[:, 1], t[:, 0]], 1) * d


def rdp(p, eps):
    p = np.array(p)
    if len(p) < 3: return p
    a, b = p[0], p[-1]; ab = b - a; l = np.hypot(*ab)
    d = p - a
    dd = np.abs(ab[0] * d[:, 1] - ab[1] * d[:, 0]) / l if l > 1e-9 else np.hypot(d[:, 0], d[:, 1])
    i = int(dd.argmax())
    if dd[i] > eps: return np.vstack([rdp(p[:i + 1], eps)[:-1], rdp(p[i:], eps)])
    return np.array([a, b])


def simplify(p, eps=1.0, closed=False):
    p = np.array(p)
    if closed: p = np.vstack([p, p[:1]])
    q = rdp(p, eps)
    while len(q) > MAX_POINTS: eps *= 1.25; q = rdp(p, eps)
    return q[:-1] if closed else q


def fmt(p):
    return '[' + ','.join('[%.1f,%.1f]' % (x, y) for x, y in p) + ']'


def water_distance(regions):
    im = np.array(Image.open(ROOT / 'src/assets/city-wide.webp').convert('RGB').resize((W, H), Image.LANCZOS))
    reg = np.zeros((H, W), np.uint8)
    for r in regions: cv2.fillPoly(reg, [np.array(r, np.int32)], 255)
    hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0].astype(int) * 2, hsv[..., 1], hsv[..., 2]
    blue = ((h >= 180) & (h <= 235) & (s >= 110) & (v >= 70)).astype(np.uint8) * 255
    water = cv2.morphologyEx(cv2.bitwise_and(blue, reg), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    return cv2.distanceTransform(water, cv2.DIST_L2, 5)


def land_distance():
    """Расстояние от каждой точки карты до воды (любой синий пиксель, включая тени под арками мостов)."""
    im = np.array(Image.open(ROOT / 'src/assets/city-wide.webp').convert('RGB').resize((W, H), Image.LANCZOS))
    hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0].astype(int) * 2, hsv[..., 1], hsv[..., 2]
    blue = ((h >= 170) & (h <= 240) & (s >= 90) & (v >= 60)).astype(np.uint8)
    blue = cv2.morphologyEx(blue, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return cv2.distanceTransform(1 - blue, cv2.DIST_L2, 5)


def keep_dry(p, land, closed=False, margin=MARGIN, radius=28):
    """Сдвигает точки пешеходного маршрута от воды: каждая точка ближе MARGIN px к воде переносится на ближайший сухой пиксель."""
    q = resample(p, 5.0)
    out = []
    for x, y in q:
        xi, yi = min(W - 1, max(0, int(x))), min(H - 1, max(0, int(y)))
        if land[yi, xi] >= margin: out.append((x, y)); continue
        sn = snap(land, (x, y), margin, radius)
        out.append((float(sn[0]), float(sn[1])) if sn else (x, y))
    out = smooth(np.array(out), 2, closed)
    out = np.array([(x, y) if land[min(H - 1, max(0, int(y))), min(W - 1, max(0, int(x)))] >= margin * .6 else
                    (snap(land, (x, y), margin, radius) or (x, y)) for x, y in out], float)
    return simplify(out, 0.9, closed)


def wet_share(p, land, closed=False):
    q = resample(np.vstack([p, p[:1]]) if closed else p, 3.0)
    return float(np.mean([land[min(H - 1, max(0, int(y))), min(W - 1, max(0, int(x)))] < 4 for x, y in q]))


def snap(dist, pt, need, radius=60):
    x, y = int(pt[0]), int(pt[1])
    y0, y1, x0, x1 = max(0, y - radius), min(H, y + radius), max(0, x - radius), min(W, x + radius)
    win = dist[y0:y1, x0:x1]
    ys, xs = np.where(win >= need)
    if not len(ys): return None
    k = int(np.argmin((xs + x0 - x) ** 2 + (ys + y0 - y) ** 2))
    return (xs[k] + x0, ys[k] + y0)


def sea_route(dist, waypoints, need):
    cost = 1.0 + 60.0 / (1.0 + dist) ** 1.2
    cost[dist < need * .6] = 1e4
    pts = []
    snapped = [snap(dist, p, need) for p in waypoints]
    if any(s is None for s in snapped): return None
    for a, b in zip(snapped, snapped[1:]):
        path, _ = route_through_array(cost, (a[1], a[0]), (b[1], b[0]), fully_connected=True, geometric=True)
        pts += [(c, r) for r, c in path]
    p = smooth(resample(pts, 5.0), 6)
    return simplify(p, 1.6)


# Суда: id -> (путь-ориентиры в px карты 2000×1125, скорость, вместимость, нужен запас до берега)
SEA = {
    'life-sea-nw-out':  ([(310, 160), (450, 170), (610, 165)], 18, 3, 16),
    'life-sea-nw-back': ([(610, 178), (460, 184), (320, 172)], 17, 3, 16),
    'life-sea-w':       ([(60, 350), (150, 352), (215, 372)], 14, 2, 14),
    'life-sea-sw-out':  ([(130, 880), (300, 950), (480, 1000), (650, 1060)], 22, 4, 18),
    'life-sea-sw-mid':  ([(150, 965), (300, 1040), (450, 1090)], 26, 3, 16),
    'life-sea-sw-north':([(160, 835), (350, 885), (560, 945)], 18, 3, 16),
    'life-sea-s-out':   ([(1300, 1030), (1450, 985), (1550, 1040), (1650, 1052), (1750, 1050)], 22, 4, 15),
    'life-sea-e':       ([(1640, 340), (1700, 345), (1760, 340)], 12, 2, 12),
}

# Тротуары: id -> (исходная полоса, смещение вправо по ходу, скорость, вместимость, обратное направление тоже)
WALK = {
    'life-walk-coast-n':   ('wide-coast-west', 9.5, 4.2, 9, True),
    'life-walk-coast-s':   ('wide-coast-east', 9.5, 4.2, 9, True),
    'life-walk-sport-in':  ('wide-sport-in', 9.5, 4.0, 5, True),
    'life-walk-sport-out': ('wide-sport-out', 9.5, 4.0, 5, True),
    'life-walk-eng-in':    ('wide-english-in', 9.5, 4.0, 5, True),
    'life-walk-eng-out':   ('wide-english-out', 9.5, 4.0, 5, True),
    'life-walk-globe':     ('wide-globe-outer', 10.5, 4.4, 8, False),
}


def main():
    data = dump(); lanes = {r['id']: r for r in data['routes']}
    out = ['// Сгенерировано scripts/build-wide-life.py — не править вручную.',
           '// Тротуары вдоль дорог (смещённые полосы машин) и пути судов по открытой воде широкой карты (px карты 2000 × 1125).',
           "import type { CityRoute } from './paths.ts';", '']
    entries = []
    for rid, (src, off, speed, cap, both) in WALK.items():
        lane = lanes[src]; closed = lane['closed']
        base = smooth(resample(lane['pts']), 3, closed)
        p = simplify(offset_right(base, off, closed), 0.9, closed)
        entries.append((rid, 'pedestrian', closed, speed, cap, p))
        if both and not closed: entries.append((rid + '-back', 'pedestrian', False, speed, cap, p[::-1]))
    land = land_distance()
    for k, (rid, kind, closed, speed, cap, p) in enumerate(entries):
        entries[k] = (rid, kind, closed, speed, cap, keep_dry(p, land, closed))
    for rid, r in lanes.items():
        if r['kind'] == 'pedestrian' and rid.startswith('wide-plaza'):
            cap = PLAZA_CAP.get(rid, 11)
            entries.append((rid, 'pedestrian', r['closed'], PLAZA_SPEED.get(rid, 5.2), cap, keep_dry(np.array(r['pts']), land, r['closed'])))
    kept = []
    for e in entries:
        w = wet_share(e[5], land, e[2])
        print('%-26s у воды %4.1f%%' % (e[0], w * 100))
        if w > MAX_WET and e[0].startswith('life-walk'): print('  ОТБРОШЕН: слишком близко к воде'); continue
        kept.append((e, w))
    entries = [e for e, _ in kept]
    wet = {e[0]: round(w, 4) for e, w in kept}
    (ROOT / 'scripts/city-routes-metrics.json').write_text(json.dumps({'maxWetShare': MAX_WET, 'wetShare': wet}, indent=2) + '\n')
    dist = water_distance(data['regions'])
    for rid, (way, speed, cap, need) in SEA.items():
        p = sea_route(dist, way, need)
        if p is None: print('ПРОПУЩЕН (нет воды)', rid); continue
        lo = min(dist[min(H - 1, int(y)), min(W - 1, int(x))] for x, y in resample(p, 4.0))
        print('%-18s точек %2d, длина %5.0f, мин. до берега %4.1f' % (rid, len(p), float(np.hypot(*np.diff(p, axis=0).T).sum()), lo))
        if lo < need * .6: print('  ПРЕДУПРЕЖДЕНИЕ: близко к берегу'); continue
        entries.append((rid, 'water', False, speed, cap, p))
    body = ['export const lifeRoutes: CityRoute[] = ([']
    for rid, kind, closed, speed, cap, p in entries:
        body.append("  ['%s', '%s', %s, %s, %d, %s]," % (rid, kind, 'true' if closed else 'false', speed, cap, fmt(p)))
    body.append("] as const).map(([id, kind, closed, speed, capacity, points]) => ({ id, kind, closed, speed, capacity,")
    body.append("  points: points.map(([x, y]) => ({ x: x / 2000, y: y / 1125 })) }));")
    text = '\n'.join(out + body) + '\n'
    (ROOT / 'src/cityLive/wideLife.ts').write_text(text)
    print('записано', len(entries), 'маршрутов,', len(text) // 1024, 'КБ')


if __name__ == '__main__':
    main()
