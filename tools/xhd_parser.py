"""Mini Pearl 1024 Pro 쇼 백업(.XHD) 파서 — 분석으로 알아낸 구조(참고용). 사용: Show(path), export(show)."""
import struct, sys

class Show:
    LIB_BASE = 0x12400
    LIB_SIZE = 0x800
    REC_BASE = 0x595c00
    REC_SIZE = 0x1800
    DIR_BASE = 0x21c00
    DIR_SIZE = 0x800

    def __init__(self, path):
        self.d = open(path, 'rb').read()
        d = self.d
        self.magic = d[0:0x10].decode('ascii', 'replace')
        self.name = d[0x14:0x20].decode('ascii', 'replace').strip()
        self.libs = {}
        self.fixtures = []
        for f in range(1, 121):
            addr = struct.unpack_from('<H', d, 0x40 + 2 * (f - 1))[0]
            lib = d[0x130 + (f - 1)]
            if addr and lib:
                self.fixtures.append({'no': f, 'page': (f - 1) // 20 + 1,
                                      'button': (f - 1) % 20 + 1,
                                      'addr': addr, 'lib': lib})
                if lib not in self.libs:
                    self.libs[lib] = self.read_lib(lib)
        # DMX channel -> internal index (universe 1)
        self.dmx2idx = {}
        for ch in range(1, 513):
            v = struct.unpack_from('<H', d, 0xac0 + 2 * (ch - 1))[0]
            if v:
                self.dmx2idx[ch] = v

    def read_lib(self, lib):
        b = self.LIB_BASE + (lib - 1) * self.LIB_SIZE
        d = self.d
        name = d[b:b + 12].split(b'\0')[0].decode('ascii', 'replace')
        nch = d[b + 0x0c]
        slots = []
        for k in range(40):
            coarse = d[b + 0x0d + 2 * k]
            fine = d[b + 0x0e + 2 * k] if k < 39 else 0
            sname = d[b + 0x5d + 12 * k: b + 0x5d + 12 * k + 12].split(b'\0')[0].decode('ascii', 'replace')
            if coarse:
                slots.append({'slot': k, 'name': sname or f'slot{k}', 'ch': coarse, 'fine': fine})
        # per-channel names
        chname = {}
        for s in slots:
            chname[s['ch']] = s['name']
            if s['fine']:
                chname[s['fine']] = s['name'] + ' fine'
        return {'no': lib, 'name': name, 'channels': nch, 'slots': slots, 'chname': chname}

    def record(self, n):
        b = self.REC_BASE + n * self.REC_SIZE
        return self.d[b:b + self.REC_SIZE]

    def scene_dmx(self, n, only_included=True):
        """Return {dmx_channel: value} for record n."""
        r = self.record(n)
        out = {}
        for ch, idx in self.dmx2idx.items():
            inc = r[0x325 + idx]
            val = r[0xba5 + idx]
            if inc or not only_included:
                out[ch] = val
        return out

    def directory(self):
        out = []
        for k in range(64):
            a = self.DIR_BASE + k * self.DIR_SIZE
            e = self.d[a:a + self.DIR_SIZE]
            if e[0] != 1:
                continue
            out.append({'slot': k, 'type': e[14], 'ref': e[24], 'addr': a})
        return out


def shapes_of(rec):
    """Shapes stored in a scene record header (entry size 0x86, starting at 0x0e)."""
    n = rec[14]
    out = []
    for i in range(n):
        o = 0x10 + i * 0x86
        sid, size, speed = struct.unpack_from('<HHH', rec, o)
        param = struct.unpack_from('<H', rec, o + 8)[0]
        cnt = struct.unpack_from('<H', rec, o + 12)[0]
        fx = list(rec[o + 14:o + 14 + cnt])
        out.append({'id': sid, 'size': size, 'speed': speed, 'param': param,
                    'fixtures': [x + 1 for x in fx]})
    return out


def export(show):
    """Build replay list: directory slot k -> (page, fader); records stored in ref order."""
    dirs = show.directory()
    refs_sorted = sorted(e['ref'] for e in dirs)
    ref2rec = {ref: i for i, ref in enumerate(refs_sorted)}
    replays = []
    for e in dirs:
        rec_no = ref2rec[e['ref']]
        rec = show.record(rec_no)
        vals = show.scene_dmx(rec_no)
        fx = {}
        for f in show.fixtures:
            L = show.libs[f['lib']]
            attrs = []
            for c in range(1, L['channels'] + 1):
                ch = f['addr'] + c - 1
                if ch in vals:
                    attrs.append([L['chname'].get(c, f'ch{c}'), vals[ch]])
            if attrs:
                fx[f['no']] = attrs
        replays.append({'slot': e['slot'], 'page': e['slot'] // 10 + 1, 'fader': e['slot'] % 10 + 1,
                        'mode': e['type'], 'record': rec_no, 'ref': e['ref'],
                        'flagged': [f for f in range(1, 121) if rec[0x2ad + f]],
                        'fixtures': fx, 'shapes': shapes_of(rec),
                        'dmx': sorted(vals.items())})
    return replays
