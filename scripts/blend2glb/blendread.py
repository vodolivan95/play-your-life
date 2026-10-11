"""Minimal reader for uncompressed little-endian 64-bit .blend files (Blender 2.8x–3.x)."""
import struct, re, sys


class Blend:
    def __init__(self, path):
        self.data = open(path, 'rb').read()
        d = self.data
        assert d[:7] == b'BLENDER' and d[7:8] == b'-' and d[8:9] == b'v', 'unsupported header'
        self.version = d[9:12].decode()
        off = 12
        self.blocks = []
        self.by_ptr = {}
        while off < len(d):
            code, size, ptr, sdna, count = struct.unpack_from('<4sIQII', d, off)
            off += 24
            block = dict(code=code.rstrip(b'\0').decode('latin1'), size=size, ptr=ptr, sdna=sdna, count=count, off=off)
            self.blocks.append(block)
            if ptr:
                self.by_ptr[ptr] = block
            off += size
            if block['code'] == 'ENDB':
                break
        self._read_sdna(next(b for b in self.blocks if b['code'] == 'DNA1'))

    def _read_sdna(self, b):
        d, off = self.data, b['off']
        assert d[off:off + 4] == b'SDNA'
        off += 4

        def section(tag, off):
            assert d[off:off + 4] == tag, (tag, d[off:off + 4])
            return off + 4

        def align(o):
            return (o + 3) & ~3

        off = section(b'NAME', off)
        n, = struct.unpack_from('<I', d, off); off += 4
        names = []
        for _ in range(n):
            end = d.index(b'\0', off); names.append(d[off:end].decode('latin1')); off = end + 1
        off = section(b'TYPE', align(off))
        n, = struct.unpack_from('<I', d, off); off += 4
        types = []
        for _ in range(n):
            end = d.index(b'\0', off); types.append(d[off:end].decode('latin1')); off = end + 1
        off = section(b'TLEN', align(off))
        tlen = list(struct.unpack_from('<%dH' % len(types), d, off)); off += 2 * len(types)
        off = section(b'STRC', align(off))
        n, = struct.unpack_from('<I', d, off); off += 4
        self.structs = []
        self.struct_by_name = {}
        for _ in range(n):
            t, nf = struct.unpack_from('<HH', d, off); off += 4
            fields = []
            pos = 0
            for _ in range(nf):
                ft, fn = struct.unpack_from('<HH', d, off); off += 4
                name = names[fn]
                is_ptr = name.startswith('*') or name.startswith('(*')
                dims = [int(x) for x in re.findall(r'\[(\d+)\]', name)]
                mult = 1
                for x in dims:
                    mult *= x
                size = (8 if is_ptr else tlen[ft]) * mult
                clean = re.sub(r'\[.*', '', name).lstrip('*').replace('(', '').replace(')', '')
                fields.append(dict(name=clean, type=types[ft], ptr=is_ptr, dims=dims, off=pos, size=size, raw=name))
                pos += size
            s = dict(name=types[t], size=tlen[t], fields={f['name']: f for f in fields}, order=fields)
            self.structs.append(s)
            self.struct_by_name[types[t]] = s
        self.types, self.tlen = types, tlen

    def struct(self, name):
        return self.struct_by_name[name]

    def get(self, sname, base, field):
        s = self.struct(sname)
        f = s['fields'][field]
        o = base + f['off']
        d = self.data
        if f['ptr']:
            if f['dims']:
                return [struct.unpack_from('<Q', d, o + 8 * i)[0] for i in range(f['size'] // 8)]
            return struct.unpack_from('<Q', d, o)[0]
        t = f['type']
        fmt = {'float': 'f', 'int': 'i', 'short': 'h', 'char': 'b', 'double': 'd', 'uint': 'I', 'ushort': 'H', 'uchar': 'B', 'int64_t': 'q', 'uint64_t': 'Q'}.get(t)
        if t == 'char' and f['dims']:
            raw = d[o:o + f['size']]
            return raw.split(b'\0')[0].decode('utf-8', 'replace')
        if fmt is None:
            return o  # nested struct: return its absolute offset
        cnt = f['size'] // struct.calcsize(fmt)
        vals = struct.unpack_from('<%d%s' % (cnt, fmt), d, o)
        return vals if f['dims'] else vals[0]

    def block_at(self, ptr):
        return self.by_ptr.get(ptr)

    def blocks_of(self, code):
        return [b for b in self.blocks if b['code'] == code]

    def sdna_name(self, block):
        return self.structs[block['sdna']]['name']


if __name__ == '__main__':
    b = Blend(sys.argv[1])
    print('version', b.version)
    from collections import Counter
    print(Counter(b.sdna_name(x) for x in b.blocks if x['code'] not in ('DATA',)).most_common(30))
