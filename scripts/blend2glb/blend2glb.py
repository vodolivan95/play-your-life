"""Convert mesh objects of a Blender 2.9x .blend into a textured GLB (Y-up, metres).

Usage: blend2glb.py file.blend out.glb spec.json
spec.json: {"objects": {"<object name>": {"baseColor": "tex.png", "normal": "n.png"|null,
            "roughnessTex": "r.png"|null, "roughness": 0.4, "metallic": 0}}, "texSize": 1024}
"""
import io, json, math, struct, sys
import numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from blendread import Blend

blend_path, out_path, spec_path = sys.argv[1:4]
spec = json.load(open(spec_path))
tex_size = spec.get('texSize', 1024)
tex_dir = spec['texDir']
b = Blend(blend_path)


def arr(ptr, sname, count):
    blk = b.block_at(ptr)
    s = b.struct(sname)
    return blk['off'], s['size'], count


def mesh_arrays(me):
    base = me['off']
    nv, nl, np_ = b.get('Mesh', base, 'totvert'), b.get('Mesh', base, 'totloop'), b.get('Mesh', base, 'totpoly')
    d = b.data
    vo, vs, _ = arr(b.get('Mesh', base, 'mvert'), 'MVert', nv)
    co_off = b.struct('MVert')['fields']['co']['off']
    no_off = b.struct('MVert')['fields']['no']['off']
    verts = np.zeros((nv, 3), np.float32)
    vnorm = np.zeros((nv, 3), np.float32)
    for i in range(nv):
        o = vo + i * vs
        verts[i] = struct.unpack_from('<3f', d, o + co_off)
        vnorm[i] = np.array(struct.unpack_from('<3h', d, o + no_off), np.float32) / 32767.0
    lo, ls, _ = arr(b.get('Mesh', base, 'mloop'), 'MLoop', nl)
    v_off = b.struct('MLoop')['fields']['v']['off']
    loops = np.array([struct.unpack_from('<I', d, lo + i * ls + v_off)[0] for i in range(nl)], np.int64)
    po, ps, _ = arr(b.get('Mesh', base, 'mpoly'), 'MPoly', np_)
    pf = b.struct('MPoly')['fields']
    polys = []
    for i in range(np_):
        o = po + i * ps
        start = struct.unpack_from('<i', d, o + pf['loopstart']['off'])[0]
        tot = struct.unpack_from('<i', d, o + pf['totloop']['off'])[0]
        flag = struct.unpack_from('<b', d, o + pf['flag']['off'])[0]
        polys.append((start, tot, bool(flag & 1)))
    uvs = None
    uvp = b.get('Mesh', base, 'mloopuv')
    if uvp:
        uo, us, _ = arr(uvp, 'MLoopUV', nl)
        uv_off = b.struct('MLoopUV')['fields']['uv']['off']
        uvs = np.array([struct.unpack_from('<2f', d, uo + i * us + uv_off) for i in range(nl)], np.float32)
    return verts, vnorm, loops, polys, uvs


def build(obj_block, me_block):
    verts, vnorm, loops, polys, uvs = mesh_arrays(me_block)
    m = np.array(b.get('Object', obj_block['off'], 'obmat'), np.float32).reshape(4, 4)  # column-major rows = columns
    M = m.T  # world = M @ [x,y,z,1]
    world = (np.c_[verts, np.ones(len(verts))] @ M.T)[:, :3]
    nmat = np.linalg.inv(M[:3, :3]).T
    wnorm = vnorm @ nmat.T
    wnorm /= np.linalg.norm(wnorm, axis=1, keepdims=True) + 1e-9
    key_index = {}
    pos, nor, tex, idx = [], [], [], []

    def emit(li, n, flat_id):
        v = int(loops[li])
        uv = tuple(np.round(uvs[li], 5)) if uvs is not None else (0, 0)
        key = (v, uv, flat_id)
        if key in key_index:
            return key_index[key]
        k = len(pos)
        key_index[key] = k
        pos.append(world[v]); nor.append(n); tex.append(uv)
        return k

    for pi, (start, tot, smooth) in enumerate(polys):
        ls = list(range(start, start + tot))
        if smooth:
            ids = [emit(l, wnorm[loops[l]], -1) for l in ls]
        else:
            p = world[loops[ls]]
            n = np.zeros(3)
            for i in range(tot):
                a, c = p[i], p[(i + 1) % tot]
                n += np.cross(a, c)
            n /= np.linalg.norm(n) + 1e-9
            ids = [emit(l, n, pi) for l in ls]
        for i in range(1, tot - 1):
            idx += [ids[0], ids[i], ids[i + 1]]
    pos = np.array(pos, np.float32); nor = np.array(nor, np.float32); tex = np.array(tex, np.float32)
    # Blender Z-up -> glTF Y-up
    pos = pos[:, [0, 2, 1]] * np.array([1, 1, -1], np.float32)
    nor = nor[:, [0, 2, 1]] * np.array([1, 1, -1], np.float32)
    tex[:, 1] = 1 - tex[:, 1]
    return pos, nor, tex, np.array(idx, np.uint32)


objects = {}
for blk in b.blocks_of('OB'):
    name = b.get('ID', b.get('Object', blk['off'], 'id'), 'name')[2:]
    if name in spec['objects']:
        objects[name] = (blk, b.block_at(b.get('Object', blk['off'], 'data')))

bin_parts = []
buffer_views, accessors, images, textures, materials, meshes, nodes = [], [], [], [], [], [], []


def add_view(raw, target=None):
    while sum(len(p) for p in bin_parts) % 4:
        bin_parts.append(b'\0')
    off = sum(len(p) for p in bin_parts)
    bin_parts.append(raw)
    view = {'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)}
    if target:
        view['target'] = target
    buffer_views.append(view)
    return len(buffer_views) - 1


def add_accessor(a, ctype, typ, target, minmax=False):
    view = add_view(a.tobytes(), target)
    acc = {'bufferView': view, 'componentType': ctype, 'count': len(a), 'type': typ}
    if minmax:
        acc['min'] = a.min(0).tolist(); acc['max'] = a.max(0).tolist()
    accessors.append(acc)
    return len(accessors) - 1


def add_image(path, mode, fmt, quality=88):
    im = Image.open(path)
    im = im.convert(mode) if mode != 'MR' else im.convert('L')
    im = im.resize((tex_size, tex_size), Image.LANCZOS)
    if mode == 'MR':  # roughness in G, metallic 0 in B
        g = np.array(im)
        rgb = np.stack([np.full_like(g, 255), g, np.zeros_like(g)], -1)
        im = Image.fromarray(rgb, 'RGB')
    buf = io.BytesIO()
    if fmt == 'jpeg':
        im.save(buf, 'JPEG', quality=quality, optimize=True, progressive=False)
        mime = 'image/jpeg'
    else:
        im.save(buf, 'PNG', optimize=True)
        mime = 'image/png'
    view = add_view(buf.getvalue())
    images.append({'bufferView': view, 'mimeType': mime})
    textures.append({'source': len(images) - 1, 'sampler': 0})
    return len(textures) - 1


all_pos = []
for name, opts in spec['objects'].items():
    obj_block, me_block = objects[name]
    pos, nor, tex, idx = build(obj_block, me_block)
    all_pos.append(pos)
    mat = {'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': add_image(f"{tex_dir}/{opts['baseColor']}", 'RGB', 'jpeg')},
                                                   'metallicFactor': opts.get('metallic', 0), 'roughnessFactor': opts.get('roughness', 0.5)}}
    if opts.get('roughnessTex'):
        mat['pbrMetallicRoughness']['metallicRoughnessTexture'] = {'index': add_image(f"{tex_dir}/{opts['roughnessTex']}", 'MR', 'jpeg')}
        mat['pbrMetallicRoughness']['roughnessFactor'] = 1
    if opts.get('normal'):
        mat['normalTexture'] = {'index': add_image(f"{tex_dir}/{opts['normal']}", 'RGB', 'jpeg', 92)}
    materials.append(mat)
    prim = {'attributes': {'POSITION': add_accessor(pos, 5126, 'VEC3', 34962, True),
                           'NORMAL': add_accessor(nor, 5126, 'VEC3', 34962),
                           'TEXCOORD_0': add_accessor(tex, 5126, 'VEC2', 34962)},
            'indices': add_accessor(idx if len(pos) > 65535 else idx.astype(np.uint16), 5125 if len(pos) > 65535 else 5123, 'SCALAR', 34963),
            'material': len(materials) - 1}
    meshes.append({'name': name, 'primitives': [prim]})
    nodes.append({'name': name, 'mesh': len(meshes) - 1})
    print(name, 'vertices', len(pos), 'triangles', len(idx) // 3)

allp = np.concatenate(all_pos)
print('bounds', allp.min(0), allp.max(0))
gltf = {'asset': {'version': '2.0', 'generator': 'play-your-life blend2glb'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
        'materials': materials, 'textures': textures, 'images': images,
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
        'accessors': accessors, 'bufferViews': buffer_views}
binary = b''.join(bin_parts)
while len(binary) % 4:
    binary += b'\0'
gltf['buffers'] = [{'byteLength': len(binary)}]
js = json.dumps(gltf, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary))
out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
open(out_path, 'wb').write(out)
print('wrote', out_path, len(out), 'bytes')
