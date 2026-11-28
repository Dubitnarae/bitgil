import type { Show, Values } from './types'
import type { Levels } from './faders'

/** 갑자기 꺼졌을 때 이어가기용: 실제로 나가던 상태(페이드가 끝났을 때 목표값 기준) */
export interface Snapshot {
  live: Values
  faders: Levels
  raised: Record<string, number> // 페이더를 올린 순서(LTP)
  master: number
  blackout: boolean
  cue: number
}

/** 켜진 게 하나도 없는 상태(이어갈 게 없음) */
export const isDark = (s: Snapshot) => !Object.keys(s.live).length && !Object.values(s.faders).some((v) => v > 0)

const num = (v: unknown, lo: number, hi: number, round = false): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const x = Math.max(lo, Math.min(hi, v))
  return round ? Math.round(x) : x
}

/** 파일에서 읽은 값을 믿지 않고 고른다: 지금 쇼에 없는 조명·씬은 빼고, 숫자는 범위 안으로. 쓸 수 없으면 null */
export function cleanSnapshot(show: Show, raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
  const live: Values = {}
  for (const f of show.fixtures) {
    const attrs: Record<string, number> = {}
    for (const [a, v] of Object.entries(obj(obj(r.live)[f.id]))) {
      const n = num(v, 0, 255, true)
      if (n !== null) attrs[a] = n
    }
    if (Object.keys(attrs).length) live[f.id] = attrs
  }
  const faders: Levels = {}
  const raised: Record<string, number> = {}
  for (const s of show.scenes) {
    const v = num(obj(r.faders)[s.id], 0, 1)
    if (v !== null) faders[s.id] = v
    const o = num(obj(r.raised)[s.id], 0, 1e9, true)
    if (o !== null) raised[s.id] = o
  }
  const cue = num(r.cue, -1, show.cuelist.length - 1, true) ?? -1
  return { live, faders, raised, master: num(r.master, 0, 1) ?? 1, blackout: r.blackout === true, cue }
}
