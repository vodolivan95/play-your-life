#!/usr/bin/env python3
"""Атласы жителей «Города» из 3D-моделей KayKit Adventurers (Kay Lousberg, CC0).

Каждый атлас: 8 направлений (строки, шаг 45° по экранным осям, строка 0 — вправо, y вниз)
× 8 кадров шага (столбцы). Анимация Walking_A из самих GLB. Рендер — программный (numpy),
без three.js и браузера: модель, скиннинг, z-буфер, текстура-палитра, мягкое освещение.

Запуск:  python3 scripts/build-city-people.py <папка с *.glb> [<папка вывода>]
По умолчанию вывод — src/assets/city-people/. Подробности — docs/LIVE_CITY.md.
"""
import json, math, struct, sys, io
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

CELL = 128         # размер кадра в атласе, px (загрузчик берёт cell = ширина / 8)
SS = 3             # суперсэмплинг
SLIM = 0.80        # сужение тела по плечам (до поворота), чтобы герои не выглядели «жирными»
ELEV = math.radians(32)   # угол камеры над горизонтом
FRAMES = 8
DIRS = 8
ANIM = 'Walking_A'
CHARACTERS = {      # файл -> имя атласа, префикс частей тела
    'Knight': ('kaykit-knight', 'Knight_'),
    'Barbarian': ('kaykit-barbarian', 'Barbarian_'),
    'Mage': ('kaykit-mage', 'Mage_'),
    'Rogue': ('kaykit-rogue', 'Rogue_'),
    'Rogue_Hooded': ('kaykit-hooded', 'Rogue_'),
}
LIGHT = np.array([-0.45, 0.8, 0.55]); LIGHT /= np.linalg.norm(LIGHT)

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load_glb(path):
    d = Path(path).read_bytes()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', d[off:off + 4])[0]
    return j, d[off + 8:off + 8 + bl]


def accessor(j, b, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    n, k = a['count'], NC[a['type']]; dt = np.dtype(CT[a['componentType']])
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or dt.itemsize * k
    raw = np.frombuffer(b, dtype=np.uint8, count=stride * n, offset=start) if stride * n + start <= len(b) else None
    arr = np.lib.stride_tricks.as_strided(raw, shape=(n, dt.itemsize * k), strides=(stride, 1)).copy().view(dt).reshape(n, k)
    if a.get('normalized'):
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr


def trs(n):
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    return compose(n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1]))


def compose(t, q, s):
    x, y, z, w = q
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4); m[:3, :3] = r * np.array(s); m[:3, 3] = t
    return m


def slerp(a, b, t):
    a = np.array(a, float); b = np.array(b, float)
    d = float(a @ b)
    if d < 0: b, d = -b, -d
    if d > .9995:
        r = a + t * (b - a)
    else:
        th = math.acos(d); r = (math.sin((1 - t) * th) * a + math.sin(t * th) * b) / math.sin(th)
    return r / np.linalg.norm(r)


def sample(times, vals, t, rot):
    if t <= times[0]: return vals[0]
    if t >= times[-1]: return vals[-1]
    i = int(np.searchsorted(times, t) - 1); f = (t - times[i]) / (times[i + 1] - times[i])
    return slerp(vals[i], vals[i + 1], f) if rot else vals[i] * (1 - f) + vals[i + 1] * f


class Model:
    def __init__(self, path, prefix):
        self.j, self.b = load_glb(path)
        j = self.j
        img = j['images'][0]; bv = j['bufferViews'][img['bufferView']]
        self.tex = np.array(Image.open(io.BytesIO(self.b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB'))
        self.parent = {}
        for i, n in enumerate(j['nodes']):
            for c in n.get('children', []): self.parent[c] = i
        self.anim = next(a for a in j['animations'] if a['name'] == ANIM)
        self.channels = {}
        for ch in self.anim['channels']:
            s = self.anim['samplers'][ch['sampler']]
            self.channels[(ch['target']['node'], ch['target']['path'])] = (accessor(j, self.b, s['input'])[:, 0], accessor(j, self.b, s['output']))
        self.duration = max(c[0][-1] for c in self.channels.values())
        self.meshes = []
        for i, n in enumerate(j['nodes']):
            if 'mesh' not in n or not n['name'].startswith(prefix): continue
            for p in j['meshes'][n['mesh']]['primitives']:
                at = p['attributes']
                self.meshes.append(dict(
                    node=i, skin=n.get('skin'),
                    pos=accessor(j, self.b, at['POSITION']).astype(np.float64),
                    uv=accessor(j, self.b, at['TEXCOORD_0']).astype(np.float64),
                    joints=accessor(j, self.b, at['JOINTS_0']).astype(int) if 'JOINTS_0' in at else None,
                    weights=accessor(j, self.b, at['WEIGHTS_0']).astype(np.float64) if 'WEIGHTS_0' in at else None,
                    idx=accessor(j, self.b, p['indices'])[:, 0].astype(int).reshape(-1, 3)))
        self.ibm = {}
        for k, s in enumerate(j['skins']):
            self.ibm[k] = accessor(j, self.b, s['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1).astype(np.float64)

    def world(self, t):
        j = self.j; local = []
        for i, n in enumerate(j['nodes']):
            tt, q, s = n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1])
            if (i, 'translation') in self.channels: tt = sample(*self.channels[(i, 'translation')], t, False)
            if (i, 'rotation') in self.channels: q = sample(*self.channels[(i, 'rotation')], t, True)
            if (i, 'scale') in self.channels: s = sample(*self.channels[(i, 'scale')], t, False)
            local.append(trs(n) if 'matrix' in n else compose(tt, q, s))
        world = [None] * len(local)
        def get(i):
            if world[i] is None:
                p = self.parent.get(i); world[i] = local[i] if p is None else get(p) @ local[i]
            return world[i]
        return [get(i) for i in range(len(local))]

    def posed(self, t):
        """Вершины и UV всех частей в мировых координатах (y вверх, лицо к +Z)."""
        w = self.world(t); out = []
        for m in self.meshes:
            if m['skin'] is not None and m['joints'] is not None:
                skin = self.j['skins'][m['skin']]
                jm = np.stack([w[jn] @ self.ibm[m['skin']][k] for k, jn in enumerate(skin['joints'])])
                hp = np.concatenate([m['pos'], np.ones((len(m['pos']), 1))], 1)
                acc = np.zeros((len(hp), 4))
                for c in range(4):
                    acc += m['weights'][:, c:c + 1] * np.einsum('nij,nj->ni', jm[m['joints'][:, c]], hp)
                p = acc[:, :3]
            else:
                hp = np.concatenate([m['pos'], np.ones((len(m['pos']), 1))], 1)
                p = (w[m['node']] @ hp.T).T[:, :3]
            out.append((p, m['uv'], m['idx']))
        return out


def render(model, parts, heading, scale, base):
    """Один кадр: ортографическая камера, z-буфер. heading — угол движения на экране (y вниз)."""
    size = CELL * SS
    phi = math.pi / 2 - heading
    cy_, sy_ = math.cos(phi), math.sin(phi)
    R = np.array([[cy_, 0, sy_], [0, 1, 0], [-sy_, 0, cy_]])
    ce, se = math.cos(ELEV), math.sin(ELEV)
    color = np.zeros((size, size, 3)); alpha = np.zeros((size, size), bool); zbuf = np.full((size, size), -1e9)
    tex = model.tex; th, tw = tex.shape[:2]
    for p, uv, idx in parts:
        q = (p * np.array([SLIM, 1.0, 1.0])) @ R.T
        sx = size / 2 + q[:, 0] * scale * SS
        sy = base * SS - (q[:, 1] * ce - q[:, 2] * se) * scale * SS
        dz = q[:, 1] * se + q[:, 2] * ce
        for tri in idx:
            a, b, c = tri
            x0, x1 = sx[[a, b, c]].min(), sx[[a, b, c]].max(); y0, y1 = sy[[a, b, c]].min(), sy[[a, b, c]].max()
            ix0, ix1 = max(int(math.floor(x0)), 0), min(int(math.ceil(x1)), size - 1)
            iy0, iy1 = max(int(math.floor(y0)), 0), min(int(math.ceil(y1)), size - 1)
            if ix1 < ix0 or iy1 < iy0: continue
            den = (sy[b] - sy[c]) * (sx[a] - sx[c]) + (sx[c] - sx[b]) * (sy[a] - sy[c])
            if abs(den) < 1e-9: continue
            gx, gy = np.meshgrid(np.arange(ix0, ix1 + 1) + .5, np.arange(iy0, iy1 + 1) + .5)
            l1 = ((sy[b] - sy[c]) * (gx - sx[c]) + (sx[c] - sx[b]) * (gy - sy[c])) / den
            l2 = ((sy[c] - sy[a]) * (gx - sx[c]) + (sx[a] - sx[c]) * (gy - sy[c])) / den
            l3 = 1 - l1 - l2
            inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
            if not inside.any(): continue
            z = l1 * dz[a] + l2 * dz[b] + l3 * dz[c]
            sub = zbuf[iy0:iy1 + 1, ix0:ix1 + 1]
            vis = inside & (z > sub)
            if not vis.any(): continue
            n = np.cross(q[b] - q[a], q[c] - q[a]); ln = np.linalg.norm(n)
            if ln < 1e-12: continue
            n /= ln
            view = np.array([0, se, ce])
            if n @ view < 0: n = -n
            shade = .56 + .5 * max(0., float(n @ LIGHT))
            u = l1 * uv[a, 0] + l2 * uv[b, 0] + l3 * uv[c, 0]; v = l1 * uv[a, 1] + l2 * uv[b, 1] + l3 * uv[c, 1]
            tx = np.clip((u * tw).astype(int), 0, tw - 1); ty = np.clip((v * th).astype(int), 0, th - 1)
            col = tex[ty, tx] * shade
            sub[vis] = z[vis]
            cs = color[iy0:iy1 + 1, ix0:ix1 + 1]; cs[vis] = col[vis]
            alpha[iy0:iy1 + 1, ix0:ix1 + 1][vis] = True
    rgba = np.zeros((size, size, 4), np.float32)
    rgba[..., :3] = np.clip(color, 0, 255) * alpha[..., None]
    rgba[..., 3] = alpha * 255
    small = cv2.resize(rgba, (CELL, CELL), interpolation=cv2.INTER_AREA)
    a = small[..., 3] / 255.0
    rgb = np.where(a[..., None] > 0, small[..., :3] / np.maximum(a[..., None] * 255, 1e-3) * 255, 0)
    # Плотная фигура: мягкие края (суперсэмплинг) подтягиваем к 0/1, внутри альфа ровно 1.
    solid = np.clip((a - .12) / .45, 0, 1)
    # Тонкий тёмный контур в 1 px вокруг фигуры — не «тает» на светлой плитке и воде.
    ring = cv2.dilate((solid > .35).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
    outline = np.clip(ring - solid, 0, 1) * .55
    out_a = np.clip(solid + outline * (1 - solid), 0, 1)
    ink = np.array([22, 26, 40], np.float32)
    mix = (rgb * solid[..., None] + ink * (outline * (1 - solid))[..., None]) / np.maximum(out_a[..., None], 1e-3)
    return np.clip(np.concatenate([mix, out_a[..., None] * 255], 2), 0, 255).astype(np.uint8)


def main():
    src = Path(sys.argv[1]); out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'src/assets/city-people'
    out.mkdir(parents=True, exist_ok=True)
    models = {k: Model(src / f'{k}.glb', v[1]) for k, v in CHARACTERS.items()}
    # Общий масштаб: самый высокий (с шляпой) занимает ~86% кадра, ноги стоят на линии base.
    tmax = 0
    for m in models.values():
        for p, _, _ in m.posed(0):
            tmax = max(tmax, float(p[:, 1].max()))
    scale = CELL * .80 / (tmax * math.cos(ELEV)); base = CELL * .90
    print('высота модели', round(tmax, 3), 'масштаб', round(scale, 2), 'px/ед')
    for key, (name, _) in CHARACTERS.items():
        m = models[key]; sheet = np.zeros((CELL * DIRS, CELL * FRAMES, 4), np.uint8)
        poses = [m.posed(m.duration * f / FRAMES) for f in range(FRAMES)]
        for d in range(DIRS):
            for f in range(FRAMES):
                sheet[d * CELL:(d + 1) * CELL, f * CELL:(f + 1) * CELL] = render(m, poses[f], d * math.pi / 4, scale, base)
        Image.fromarray(sheet, 'RGBA').save(out / f'{name}.webp', lossless=True, method=6)
        print('готово', name)


if __name__ == '__main__':
    main()
