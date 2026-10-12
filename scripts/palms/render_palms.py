"""Атлас пальм для «Города»: Kenney Nature Kit (CC0) → src/assets/city-palms.webp.

Запуск: python3 scripts/palms/render_palms.py
Строки — 2 модели × 4 поворота вокруг ствола, столбцы — 8 кадров покачивания на ветру.
Камера смотрит с юга под углом 38° к земле, как нарисована карта острова. Свет — тёплое солнце слева сверху.
"""
import json, math, os, struct
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', '..', 'src', 'assets', 'city-palms.webp')
MODELS = ['tree_palmDetailedTall.glb', 'tree_palmDetailedShort.glb']
CELL, SS, FRAMES, YAWS = 96, 3, 8, 4
ELEV = math.radians(38)

def load(path):
    data = open(path, 'rb').read()
    jlen = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + jlen]); bin_ = data[20 + jlen + 8:]
    def acc(i):
        a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride', 0); size = np.dtype(dt).itemsize * n
        if stride and stride != size:
            arr = np.frombuffer(bin_, np.uint8, count=stride * a['count'], offset=off).reshape(a['count'], stride)[:, :size]
            return np.frombuffer(arr.tobytes(), dt).reshape(a['count'], n)
        return np.frombuffer(bin_, dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
    def matrix(node):
        if 'matrix' in node: return np.array(node['matrix'], np.float64).reshape(4, 4).T
        M = np.eye(4); t = node.get('translation', [0, 0, 0]); s = node.get('scale', [1, 1, 1]); q = node.get('rotation', [0, 0, 0, 1])
        x, y, z, w = q
        R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
        M[:3, :3] = R * s; M[:3, 3] = t; return M
    tris = []
    def walk(i, parent):
        node = doc['nodes'][i]; M = parent @ matrix(node)
        if 'mesh' in node:
            for prim in doc['meshes'][node['mesh']]['primitives']:
                pos = acc(prim['attributes']['POSITION']).astype(np.float64)
                idx = acc(prim['indices']).reshape(-1) if 'indices' in prim else np.arange(len(pos))
                mat = doc['materials'][prim.get('material', 0)]
                col = mat.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3]
                p = (np.c_[pos, np.ones(len(pos))] @ M.T)[:, :3]
                tris.append((p[idx.reshape(-1, 3)], np.array(col)))
        for c in node.get('children', []): walk(c, M)
    for r in doc['scenes'][doc.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return tris

def srgb(c): return np.where(c <= .0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, 1), 1 / 2.4) - .055)

def render(tris, yaw, sway, height):
    W = CELL * SS; img = np.zeros((W, W, 4)); zb = np.full((W, W), -1e9)
    sun = np.array([-.55, .75, .35]); sun /= np.linalg.norm(sun)
    cy, sy = math.cos(yaw), math.sin(yaw)
    scale = W * .78 / height
    for P, col in tris:
        P = P.copy()
        # Покачивание: изгиб пропорционален квадрату высоты (ствол у земли неподвижен).
        h = np.clip(P[..., 1] / height, 0, 1)
        P[..., 0] += sway * height * .07 * h ** 2
        x = P[..., 0] * cy - P[..., 2] * sy; z = P[..., 0] * sy + P[..., 2] * cy; y = P[..., 1]
        n = np.cross(np.stack([x[:, 1]-x[:, 0], y[:, 1]-y[:, 0], z[:, 1]-z[:, 0]], -1), np.stack([x[:, 2]-x[:, 0], y[:, 2]-y[:, 0], z[:, 2]-z[:, 0]], -1))
        n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-12
        # Камера смотрит на север сверху под углом ELEV: экранная Y = высота·cos − глубина·sin.
        sxp = W / 2 + x * scale
        syp = W * .94 - (y * math.cos(ELEV) - z * math.sin(ELEV)) * scale
        depth = z * math.cos(ELEV) + y * math.sin(ELEV)
        view = np.array([0, math.sin(ELEV), math.cos(ELEV)])
        for t in range(len(x)):
            nn = n[t] if n[t] @ view > 0 else -n[t]
            light = .38 + .72 * max(0, nn @ sun)
            c = srgb(np.power(col, 2.2) * light)
            xs, ys, ds = sxp[t], syp[t], depth[t]
            x0, x1 = int(max(0, math.floor(xs.min()))), int(min(W - 1, math.ceil(xs.max())))
            y0, y1 = int(max(0, math.floor(ys.min()))), int(min(W - 1, math.ceil(ys.max())))
            if x0 > x1 or y0 > y1: continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
            (ax, bx, cx), (ay, by, cy_) = xs, ys
            den = (by - cy_) * (ax - cx) + (cx - bx) * (ay - cy_)
            if abs(den) < 1e-9: continue
            w0 = ((by - cy_) * (gx - cx) + (cx - bx) * (gy - cy_)) / den
            w1 = ((cy_ - ay) * (gx - cx) + (ax - cx) * (gy - cy_)) / den
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any(): continue
            d = w0 * ds[0] + w1 * ds[1] + w2 * ds[2]
            sub = zb[y0:y1 + 1, x0:x1 + 1]; m = inside & (d > sub)
            sub[m] = d[m]; img[y0:y1 + 1, x0:x1 + 1][m] = [*c, 1]
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA')
    return im.resize((CELL, CELL), Image.LANCZOS)

atlas = Image.new('RGBA', (CELL * FRAMES, CELL * len(MODELS) * YAWS))
for mi, name in enumerate(MODELS):
    tris = load(os.path.join(HERE, name))
    height = max(P[..., 1].max() for P, _ in tris)
    for yi in range(YAWS):
        yaw = yi * math.pi / 2 + .35
        for f in range(FRAMES):
            sway = math.sin(f / FRAMES * math.pi * 2)
            atlas.paste(render(tris, yaw, sway, height), (f * CELL, (mi * YAWS + yi) * CELL))
atlas.save(OUT, 'WEBP', quality=88, method=6, exact=True)
print('saved', OUT, atlas.size)
