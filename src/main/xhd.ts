import type { Scene, Show, Values } from '../core/engine/types'

/**
 * Mini Pearl 1024 Pro 쇼 백업(.XHD) 읽기·쓰기. 구조는 tools/xhd_parser.py 해독 결과와 같다.
 * - 0x40: 콘솔 조명 1~120의 시작 주소(2바이트), 0x130: 조명별 라이브러리 번호
 * - 0xac0: DMX 채널 1~512 → 기록 안 칸 번호(2바이트, 0 = 패치 안 됨)
 * - 0x21c00 + 칸×0x800: 리플레이 목록(칸 = (페이지-1)×10 + 페이더-1, 첫 바이트 1 = 사용, +24 = 기록 번호표)
 * - 0x595c00 + n×0x1800: 기록 n(번호표 작은 순서대로 n). +0x2ad+조명번호 = 조명 포함 표시,
 *   +0x325+칸 = 채널 포함(1/0), +0xba5+칸 = 값
 */
const MAGIC = 'H3_1024S_SHOW_SH'
const LIB_BASE = 0x12400, LIB_SIZE = 0x800
const DIR_BASE = 0x21c00, DIR_SIZE = 0x800, DIR_SLOTS = 64
const REC_BASE = 0x595c00, REC_SIZE = 0x1800
const FIX_FLAG = 0x2ad, INC = 0x325, VAL = 0xba5

interface Replay { slot: number; id: string; rec: number }

function parse(buf: Buffer) {
  if (buf.length < REC_BASE || buf.toString('latin1', 0, 16) !== MAGIC) throw new Error('Mini Pearl 1024 Pro 백업 파일(.XHD)이 아닙니다')
  const dmx2idx = new Map<number, number>()
  for (let ch = 1; ch <= 512; ch++) {
    const i = buf.readUInt16LE(0xac0 + 2 * (ch - 1))
    if (i) dmx2idx.set(ch, i)
  }
  // DMX 채널 → 콘솔 조명 번호(조명 포함 표시용)
  const ch2fix = new Map<number, number>()
  for (let f = 1; f <= 120; f++) {
    const addr = buf.readUInt16LE(0x40 + 2 * (f - 1)), lib = buf[0x130 + f - 1]
    if (!addr || !lib) continue
    const n = buf[LIB_BASE + (lib - 1) * LIB_SIZE + 0x0c]
    for (let c = 0; c < n; c++) ch2fix.set(addr + c, f)
  }
  const used = [...Array(DIR_SLOTS).keys()].filter((k) => buf[DIR_BASE + k * DIR_SIZE] === 1)
  const refs = used.map((k) => buf[DIR_BASE + k * DIR_SIZE + 24]).sort((a, b) => a - b)
  const replays: Replay[] = used.map((k) => ({
    slot: k,
    id: `P${Math.floor(k / 10) + 1}-${String((k % 10) + 1).padStart(2, '0')}`,
    rec: refs.indexOf(buf[DIR_BASE + k * DIR_SIZE + 24])
  }))
  for (const r of replays) if (REC_BASE + (r.rec + 1) * REC_SIZE > buf.length) throw new Error('XHD 파일이 잘려 있습니다')
  return { dmx2idx, ch2fix, replays }
}

/** 빛길 패치로 DMX 채널 → [조명 id, 속성] */
function patchMap(show: Show) {
  const m = new Map<number, [string, string]>()
  for (const f of show.fixtures) {
    const t = show.fixture_types.find((x) => x.id === f.type)
    for (const c of t?.channels ?? []) m.set(f.address + c.offset - 1, [f.id, c.attr])
  }
  return m
}

/** 콘솔 백업의 리플레이(씬)를 빛길 씬으로. id = P페이지-페이더. 값이 없는 효과 전용 리플레이는 뺀다. */
export function xhdToScenes(buf: Buffer, show: Show): Scene[] {
  const { dmx2idx, replays } = parse(buf)
  const pm = patchMap(show)
  const out: Scene[] = []
  for (const r of replays) {
    const b = REC_BASE + r.rec * REC_SIZE
    const values: Values = {}
    for (const [ch, i] of dmx2idx) {
      const fa = pm.get(ch)
      if (fa && buf[b + INC + i]) (values[fa[0]] ??= {})[fa[1]] = buf[b + VAL + i]
    }
    if (Object.keys(values).length) out.push({ id: r.id, name: r.id, fade_seconds: 2, values })
  }
  return out
}

/** 불러온 씬을 쇼에 넣는다: 같은 id는 값만 바꾸고(이름·페이드 유지), 없으면 추가. 바뀐 개수를 돌려준다. */
export function mergeScenes(show: Show, scenes: Scene[]) {
  let replaced = 0
  for (const s of scenes) {
    const cur = show.scenes.find((x) => x.id === s.id)
    if (cur) { cur.values = s.values; replaced++ } else show.scenes.push(s)
  }
  return { replaced, added: scenes.length - replaced }
}

/**
 * 빛길 씬을 원본 백업 복사본에 써 넣는다. 콘솔에 같은 자리(P페이지-페이더) 리플레이가 있는 씬만 쓸 수 있다
 * (shortcut: 새 리플레이 자리 만들기는 기록 배치 규칙을 다 몰라서 안 함, 콘솔에서 빈 자리에 아무거나 기록해 두면 덮어쓸 수 있음).
 * 효과(Shape)·시간 같은 머리 부분은 그대로 둔다.
 */
export function scenesToXhd(base: Buffer, show: Show) {
  const buf = Buffer.from(base)
  const { dmx2idx, ch2fix, replays } = parse(buf)
  const pm = patchMap(show)
  const attrCh = new Map([...pm].map(([ch, [id, a]]) => [id + '/' + a, ch]))
  const written: string[] = []
  const skipped: string[] = []
  let unpatched = 0
  for (const s of show.scenes) {
    const r = replays.find((x) => x.id === s.id)
    if (!r) { skipped.push(s.name === s.id ? s.id : `${s.name}(${s.id})`); continue }
    const b = REC_BASE + r.rec * REC_SIZE
    const fixOn = new Set<number>()
    for (const [ch, i] of dmx2idx) {
      const fa = pm.get(ch)
      const v = fa ? s.values[fa[0]]?.[fa[1]] : undefined
      buf[b + INC + i] = v === undefined ? 0 : 1
      if (v === undefined) continue
      buf[b + VAL + i] = Math.max(0, Math.min(255, Math.round(v)))
      const f = ch2fix.get(ch)
      if (f) fixOn.add(f)
    }
    for (const [id, attrs] of Object.entries(s.values))
      for (const a of Object.keys(attrs)) if (!dmx2idx.has(attrCh.get(id + '/' + a) ?? 0)) unpatched++
    // 조명 포함 표시: 원래 값은 그대로 두고(채널 없이 표시만 된 조명도 콘솔 원본에 있음), 새로 들어간 조명만 7
    for (let f = 1; f <= 120; f++) { if (fixOn.has(f) && !buf[b + FIX_FLAG + f]) buf[b + FIX_FLAG + f] = 7 }
    written.push(s.id)
  }
  return { buf, written, skipped, unpatched }
}
