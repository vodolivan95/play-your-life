"""Tiny software renderer for a GLB (base colour textures + Lambert) to check geometry and UVs."""
import io, json, math, struct, sys
import numpy as np
from PIL import Image

path, out, yaw, pitch = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
W = H = 520
raw = open(path, 'rb').read()
jl = struct.unpack_from('<I', raw, 12)[0]
g = json.loads(raw[20:20 + jl])
binoff = 20 + jl + 8
binary = raw[binoff:]


def acc(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
    return np.frombuffer(binary, dt, a['count'] * n, v['byteOffset']).reshape(a['count'], n) if n > 1 else np.frombuffer(binary, dt, a['count'], v['byteOffset'])


def tex(i):
    img = g['images'][g['textures'][i]['source']]; v = g['bufferViews'][img['bufferView']]
    return np.asarray(Image.open(io.BytesIO(binary[v['byteOffset']:v['byteOffset'] + v['byteLength']])).convert('RGB'), np.float32) / 255


cy, sy, cp, sp = math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
R = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @ np.eye(3)
R = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]]) @ R
allpos = np.concatenate([acc(m['primitives'][0]['attributes']['POSITION']) for m in g['meshes']])
center = (allpos.min(0) + allpos.max(0)) / 2
scale = 0.8 * W / np.max(allpos.max(0) - allpos.min(0))
img = np.zeros((H, W, 3), np.float32) + np.array([0.06, 0.09, 0.2])
zbuf = np.full((H, W), -1e9)
light = np.array([-0.4, 0.7, 0.6]); light /= np.linalg.norm(light)
for m in g['meshes']:
    p = m['primitives'][0]
    pos = (acc(p['attributes']['POSITION']) - center) @ R.T
    nor = acc(p['attributes']['NORMAL']) @ R.T
    uv = acc(p['attributes']['TEXCOORD_0'])
    idx = acc(p['indices']).reshape(-1, 3)
    pbr = g['materials'][p['material']]['pbrMetallicRoughness']
    factor = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3], np.float32)
    t = tex(pbr['baseColorTexture']['index']) * factor if 'baseColorTexture' in pbr else np.ones((2, 2, 3), np.float32) * factor
    th, tw = t.shape[:2]
    sx = pos[:, 0] * scale + W / 2; sy2 = -pos[:, 1] * scale + H / 2; sz = pos[:, 2]
    for a, b_, c in idx:
        x0, y0, x1, y1, x2, y2 = sx[a], sy2[a], sx[b_], sy2[b_], sx[c], sy2[c]
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-9:
            continue
        minx, maxx = int(max(0, math.floor(min(x0, x1, x2)))), int(min(W - 1, math.ceil(max(x0, x1, x2))))
        miny, maxy = int(max(0, math.floor(min(y0, y1, y2)))), int(min(H - 1, math.ceil(max(y0, y1, y2))))
        if minx > maxx or miny > maxy:
            continue
        xs, ys = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        w0 = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / den
        w1 = ((y2 - y0) * (xs - x2) + (x0 - x2) * (ys - y2)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any():
            continue
        z = w0 * sz[a] + w1 * sz[b_] + w2 * sz[c]
        zb = zbuf[miny:maxy + 1, minx:maxx + 1]
        upd = inside & (z > zb)
        if not upd.any():
            continue
        u = w0 * uv[a, 0] + w1 * uv[b_, 0] + w2 * uv[c, 0]
        v = w0 * uv[a, 1] + w1 * uv[b_, 1] + w2 * uv[c, 1]
        col = t[(np.mod(v, 1) * (th - 1)).astype(int), (np.mod(u, 1) * (tw - 1)).astype(int)]
        n = w0[..., None] * nor[a] + w1[..., None] * nor[b_] + w2[..., None] * nor[c]
        n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-9
        lam = 0.35 + 0.75 * np.clip(np.abs(n @ light), 0, 1)
        zb[upd] = z[upd]
        img[miny:maxy + 1, minx:maxx + 1][upd] = np.clip(col[upd] * lam[upd][:, None], 0, 1)
Image.fromarray((img * 255).astype(np.uint8)).save(out)
print('ok', out)
