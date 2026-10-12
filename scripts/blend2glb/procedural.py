"""Авторские процедурные 3D-модели магазина (CC0, сделаны для PLAY YOUR LIFE).

Запуск: python3 scripts/blend2glb/procedural.py  → public/models/shop/thermae.glb, icecream.glb
Модели строятся из тел вращения (lathe), торов и параллелепипедов с PBR-материалами;
текстуры (дерево, вафля) рисуются здесь же через Pillow.
"""
import io, json, math, os, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'shop')


class Scene:
    def __init__(self):
        self.meshes = []  # (pos, nor, uv, idx, material)
        self.materials = []
        self.textures = {}

    def material(self, name, color, rough=0.6, metal=0.0, texture=None, normal_scale=None, emissive=None, double=False):
        self.materials.append(dict(name=name, color=color, rough=rough, metal=metal, texture=texture, emissive=emissive, double=double))
        return len(self.materials) - 1

    def add(self, pos, nor, uv, idx, mat, transform=None):
        pos = np.asarray(pos, np.float32); nor = np.asarray(nor, np.float32)
        if transform is not None:
            R, t = transform
            pos = pos @ R.T + t
            nor = nor @ R.T
        # Порядок обхода треугольников согласуем с нормалями: иначе three.js отсекает лицевые грани.
        tri = np.asarray(idx, np.int64).reshape(-1, 3)
        geo = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
        flip = np.einsum('ij,ij->i', geo, nor[tri].sum(1)) < 0
        tri[flip] = tri[flip][:, [0, 2, 1]]
        self.meshes.append((pos, nor, np.asarray(uv, np.float32), tri.reshape(-1).astype(np.uint32), mat))


def rot(axis, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    if axis == 'x':
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], np.float32)
    if axis == 'y':
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], np.float32)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], np.float32)


def lathe(profile, seg=48, a0=0.0, a1=360.0, uv_scale=(1, 1)):
    """profile: [(r, y)] снизу вверх. Нормали — из производной профиля."""
    prof = np.array(profile, np.float32)
    n = len(prof)
    full = abs(a1 - a0) >= 359.9
    cols = seg + 1
    tang = np.zeros_like(prof)
    tang[1:-1] = prof[2:] - prof[:-2]; tang[0] = prof[1] - prof[0]; tang[-1] = prof[-1] - prof[-2]
    lengths = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(prof, axis=0), axis=1))])
    v_coord = lengths / max(lengths[-1], 1e-6)
    pos, nor, uv = [], [], []
    for j in range(cols):
        a = math.radians(a0 + (a1 - a0) * j / seg); c, s = math.cos(a), math.sin(a)
        for i in range(n):
            r, y = prof[i]
            dr, dy = tang[i]
            nr, ny = dy, -dr  # перпендикуляр к касательной, наружу
            l = math.hypot(nr, ny) or 1
            pos.append((r * c, y, r * s)); nor.append((nr / l * c, ny / l, nr / l * s))
            uv.append((j / seg * uv_scale[0], v_coord[i] * uv_scale[1]))
    idx = []
    for j in range(seg):
        for i in range(n - 1):
            p = j * n + i; q = (j + 1) * n + i
            idx += [p, p + 1, q, q, p + 1, q + 1]
    return pos, nor, uv, idx


def torus(R, r, seg=64, ring=16):
    prof = [(R + r * math.cos(t), r * math.sin(t)) for t in np.linspace(-math.pi, math.pi, ring + 1)]
    return lathe(prof, seg)


def box(w, h, d):
    x, y, z = w / 2, h / 2, d / 2
    quads = [((1, 0, 0), [(x, -y, z), (x, -y, -z), (x, y, -z), (x, y, z)]),
             ((-1, 0, 0), [(-x, -y, -z), (-x, -y, z), (-x, y, z), (-x, y, -z)]),
             ((0, 1, 0), [(-x, y, z), (x, y, z), (x, y, -z), (-x, y, -z)]),
             ((0, -1, 0), [(-x, -y, -z), (x, -y, -z), (x, -y, z), (-x, -y, z)]),
             ((0, 0, 1), [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]),
             ((0, 0, -1), [(x, -y, -z), (-x, -y, -z), (-x, y, -z), (x, y, -z)])]
    pos, nor, uv, idx = [], [], [], []
    for n, corners in quads:
        b = len(pos)
        pos += corners; nor += [n] * 4; uv += [(0, 0), (1, 0), (1, 1), (0, 1)]
        idx += [b, b + 1, b + 2, b, b + 2, b + 3]
    return pos, nor, uv, idx


def bumpy_sphere(R, seg=48, rings=32, amp=0.06, seed=1):
    rng = np.random.default_rng(seed)
    k = rng.normal(size=(6, 3)); ph = rng.uniform(0, 6.28, 6)
    pos, nor, uv = [], [], []
    for j in range(rings + 1):
        th = math.pi * j / rings
        for i in range(seg + 1):
            ph_ = 2 * math.pi * i / seg
            d = np.array([math.sin(th) * math.cos(ph_), math.cos(th), math.sin(th) * math.sin(ph_)])
            bump = 1 + amp * sum(math.sin(3.2 * float(k[m] @ d) + ph[m]) for m in range(6)) / 6
            if j > rings * 0.72:  # нижний «натёк» шарика шире и площе
                bump *= 1 + 0.12 * (j - rings * 0.72) / (rings * 0.28)
            pos.append(d * R * bump); nor.append(d); uv.append((i / seg, j / rings))
    idx = []
    for j in range(rings):
        for i in range(seg):
            p = j * (seg + 1) + i; q = p + seg + 1
            idx += [p, q, p + 1, p + 1, q, q + 1]
    pos = np.array(pos, np.float32)
    # Нормали по деформированной поверхности; на вырожденных полюсах — радиальные.
    idx_a = np.array(idx).reshape(-1, 3)
    fn = np.cross(pos[idx_a[:, 1]] - pos[idx_a[:, 0]], pos[idx_a[:, 2]] - pos[idx_a[:, 0]])
    radial = pos / (np.linalg.norm(pos, axis=1, keepdims=True) + 1e-9)
    fn *= np.sign(np.einsum('ij,ij->i', fn, radial[idx_a].sum(1)))[:, None]
    nor = np.zeros_like(pos)
    for c in range(3):
        np.add.at(nor, idx_a[:, c], fn)
    length = np.linalg.norm(nor, axis=1, keepdims=True)
    nor = np.where(length > 1e-7, nor / (length + 1e-12), radial)
    return pos, nor, uv, idx


def wood_texture(seed=3, size=512):
    rng = np.random.default_rng(seed)
    y = np.linspace(0, 1, size)[:, None]; x = np.linspace(0, 1, size)[None, :]
    grain = np.sin((x * 40 + np.sin(y * 9) * 1.6 + rng.normal() * 0.3) * math.pi) * 0.5 + 0.5
    fine = rng.normal(0, 1, (size, size)); fine = np.array(Image.fromarray(((fine + 3) * 40).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)), np.float32) / 255
    t = 0.55 * grain + 0.45 * fine
    light, dark = np.array([214, 162, 104]), np.array([150, 96, 52])
    img = (dark + (light - dark) * t[..., None]).clip(0, 255).astype(np.uint8)
    # швы между клёпками ведра
    staves = 16
    for k in range(staves):
        xs = int(k * size / staves)
        img[:, max(0, xs - 2):xs + 1] = (img[:, max(0, xs - 2):xs + 1] * 0.55).astype(np.uint8)
    return Image.fromarray(img, 'RGB')


def waffle_texture(size=512):
    img = Image.new('RGB', (size, size), (214, 150, 74))
    d = ImageDraw.Draw(img)
    step = size // 10
    for k in range(-size, 2 * size, step):
        d.line([(k, 0), (k + size, size)], fill=(170, 104, 40), width=7)
        d.line([(k, size), (k + size, 0)], fill=(170, 104, 40), width=7)
    img = img.filter(ImageFilter.GaussianBlur(1.4))
    noise = (np.random.default_rng(5).normal(0, 9, (size, size, 1))).astype(np.int16)
    arr = (np.array(img, np.int16) + noise).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')


def write_glb(scene, path):
    parts, views, accessors, images, textures, materials, meshes, nodes = [], [], [], [], [], [], [], []

    def view(raw, target=None):
        while sum(map(len, parts)) % 4:
            parts.append(b'\0')
        off = sum(map(len, parts)); parts.append(raw)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)}
        if target: v['target'] = target
        views.append(v); return len(views) - 1

    def accessor(a, ctype, typ, target, mm=False):
        acc = {'bufferView': view(a.tobytes(), target), 'componentType': ctype, 'count': len(a), 'type': typ}
        if mm: acc['min'] = a.min(0).tolist(); acc['max'] = a.max(0).tolist()
        accessors.append(acc); return len(accessors) - 1

    tex_index = {}
    for m in scene.materials:
        mat = {'name': m['name'], 'pbrMetallicRoughness': {'baseColorFactor': list(m['color']) + [1], 'metallicFactor': m['metal'], 'roughnessFactor': m['rough']}}
        if m.get('emissive'): mat['emissiveFactor'] = list(m['emissive'])
        if m.get('double'): mat['doubleSided'] = True
        if m['texture'] is not None:
            key = id(m['texture'])
            if key not in tex_index:
                buf = io.BytesIO(); m['texture'].save(buf, 'JPEG', quality=86)
                images.append({'bufferView': view(buf.getvalue()), 'mimeType': 'image/jpeg'})
                textures.append({'source': len(images) - 1, 'sampler': 0}); tex_index[key] = len(textures) - 1
            mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_index[key]}
        materials.append(mat)
    for k, (pos, nor, uv, idx, mat) in enumerate(scene.meshes):
        nor = nor / (np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9)
        prim = {'attributes': {'POSITION': accessor(pos.astype(np.float32), 5126, 'VEC3', 34962, True),
                               'NORMAL': accessor(nor.astype(np.float32), 5126, 'VEC3', 34962),
                               'TEXCOORD_0': accessor(uv.astype(np.float32), 5126, 'VEC2', 34962)},
                'indices': accessor(idx.astype(np.uint32), 5125, 'SCALAR', 34963), 'material': mat}
        meshes.append({'primitives': [prim]}); nodes.append({'mesh': k})
    binary = b''.join(parts)
    while len(binary) % 4: binary += b'\0'
    gltf = {'asset': {'version': '2.0', 'generator': 'play-your-life procedural.py', 'copyright': 'CC0 PLAY YOUR LIFE'},
            'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'materials': materials,
            'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(binary)}],
            'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]}
    if images: gltf['images'] = images; gltf['textures'] = textures
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(binary)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
    open(path, 'wb').write(out)
    print(path, len(out), 'bytes', sum(len(m[3]) // 3 for m in scene.meshes), 'triangles')


def thermae():
    """Банное ведро из клёпок с латунными обручами, ковш и камни — «Поход в термы»."""
    s = Scene()
    wood = s.material('wood', (1, 1, 1), 0.7, texture=wood_texture())
    inner = s.material('wood-inner', (0.62, 0.42, 0.24), 0.8)
    brass = s.material('brass', (0.86, 0.66, 0.32), 0.32, 1.0)
    water = s.material('water', (0.55, 0.78, 0.86), 0.08)
    stone = s.material('stone', (0.36, 0.37, 0.4), 0.9)
    towel = s.material('towel', (0.96, 0.95, 0.92), 0.95)
    stripe = s.material('towel-stripe', (0.2, 0.45, 0.85), 0.9)
    # ведро: наружная стенка, кромка, внутренняя стенка, дно
    outer = [(0.42, 0.0), (0.44, 0.06), (0.47, 0.35), (0.5, 0.66)]
    s.add(*lathe(outer, 64, uv_scale=(1, 1)), wood)
    s.add(*lathe([(0.5, 0.66), (0.5, 0.69), (0.46, 0.69)], 64), wood)
    s.add(*lathe([(0.46, 0.69), (0.43, 0.38), (0.4, 0.07)], 64), inner)
    s.add(*lathe([(0.0, 0.0), (0.42, 0.0)], 64), inner)
    s.add(*lathe([(0.0, 0.52), (0.44, 0.52)][::-1], 64), water)  # вода (нормаль вверх)
    for y, r in ((0.13, 0.452), (0.55, 0.49)):
        s.add(*torus(r, 0.02, 72, 12), brass, (np.eye(3, dtype=np.float32), np.array([0, y, 0], np.float32)))
    # ручки-уши
    for side in (-1, 1):
        s.add(*box(0.08, 0.16, 0.12), wood, (np.eye(3, dtype=np.float32), np.array([side * 0.53, 0.6, 0], np.float32)))
    # ковш: чашка и длинная ручка, лежит на краю
    cup = lathe([(0.0, 0.0), (0.09, 0.005), (0.12, 0.05), (0.13, 0.11), (0.12, 0.11), (0.1, 0.05), (0.0, 0.02)], 40)
    R = rot('z', -18)
    s.add(*cup, brass, (R, np.array([-0.18, 0.68, 0.0], np.float32)))
    handle = lathe([(0.0, 0.0), (0.025, 0.0), (0.025, 0.62), (0.0, 0.62)], 16)
    Rh = rot('z', -70)
    s.add(*handle, wood, (Rh, np.array([-0.08, 0.76, 0.0], np.float32)))
    # горячие камни
    for k, (x, z, r) in enumerate(((0.72, 0.25, 0.13), (0.86, 0.02, 0.1), (0.68, -0.08, 0.09))):
        p, n, uv, idx = bumpy_sphere(r, 24, 16, 0.18, seed=10 + k)
        p = p * np.array([1, 0.7, 1], np.float32)
        s.add(p, n, uv, idx, stone, (np.eye(3, dtype=np.float32), np.array([x, r * 0.7, z], np.float32)))
    # свёрнутое полотенце
    roll = lathe([(0.0, -0.32), (0.12, -0.32), (0.13, -0.3), (0.13, 0.3), (0.12, 0.32), (0.0, 0.32)], 40)
    Rt, center = rot('y', 30) @ rot('x', 90), np.array([-0.62, 0.13, 0.45], np.float32)
    s.add(*roll, towel, (Rt, center))
    for off in (-0.2, -0.16, 0.16, 0.2):
        s.add(*torus(0.133, 0.008, 48, 8), stripe, (Rt, center + Rt @ np.array([0, off, 0], np.float32)))
    return s


def icecream():
    """Вафельный рожок с двумя шариками, сиропом и вишней — недорогая награда."""
    s = Scene()
    waffle = s.material('waffle', (1, 1, 1), 0.75, texture=waffle_texture())
    rim = s.material('waffle-rim', (0.78, 0.5, 0.22), 0.7)
    straw = s.material('strawberry', (0.98, 0.62, 0.72), 0.55)
    vanilla = s.material('vanilla', (0.99, 0.93, 0.78), 0.5)
    syrup = s.material('chocolate', (0.33, 0.17, 0.08), 0.25)
    cherry = s.material('cherry', (0.78, 0.04, 0.1), 0.18)
    stem = s.material('stem', (0.3, 0.45, 0.15), 0.6)
    s.add(*lathe([(0.0, 0.0), (0.02, 0.03), (0.2, 0.78)], 48, uv_scale=(4, 3)), waffle)
    s.add(*torus(0.205, 0.035, 56, 12), rim, (np.eye(3, dtype=np.float32), np.array([0, 0.8, 0], np.float32)))
    p, n, uv, idx = bumpy_sphere(0.24, 48, 32, 0.07, seed=4)
    s.add(p, n, uv, idx, vanilla, (np.eye(3, dtype=np.float32), np.array([0, 0.98, 0], np.float32)))
    p, n, uv, idx = bumpy_sphere(0.21, 48, 32, 0.08, seed=7)
    s.add(p, n, uv, idx, straw, (np.eye(3, dtype=np.float32), np.array([0.02, 1.3, 0.01], np.float32)))
    # шоколадный сироп: сплющенный купол на верхнем шарике
    p, n, uv, idx = bumpy_sphere(0.17, 40, 24, 0.12, seed=9)
    p = p * np.array([1.05, 0.45, 1.05], np.float32)
    s.add(p, n, uv, idx, syrup, (np.eye(3, dtype=np.float32), np.array([0.02, 1.45, 0.01], np.float32)))
    p, n, uv, idx = bumpy_sphere(0.055, 24, 16, 0.0, seed=1)
    s.add(p, n, uv, idx, cherry, (np.eye(3, dtype=np.float32), np.array([0.03, 1.56, 0.02], np.float32)))
    s.add(*lathe([(0.0, 0.0), (0.006, 0.0), (0.006, 0.12), (0.0, 0.12)], 8), stem, (rot('z', -20), np.array([0.04, 1.6, 0.02], np.float32)))
    return s


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write_glb(thermae(), os.path.join(OUT, 'thermae.glb'))
    write_glb(icecream(), os.path.join(OUT, 'icecream.glb'))
