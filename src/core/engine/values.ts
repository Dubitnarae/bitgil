import type { FixtureType, Values } from './types'

export const clone = (v: Values): Values => JSON.parse(JSON.stringify(v))

/** 씬 병합: 씬에 있는 값만 덮어쓰고, 없는 조명·채널은 그대로 둔다(LTP). */
// shortcut: 씬을 한 번에 하나만 올리므로 HTP 겹침은 계산하지 않음, 여러 씬 동시 재생 기능을 만들 때 추가
export function merge(base: Values, over: Values): Values {
  const out = clone(base)
  for (const [id, attrs] of Object.entries(over)) out[id] = { ...out[id], ...attrs }
  return out
}

/** 16비트 채널 쌍(굵은 값 + 미세 값)은 하나로 합쳐 페이드해야 중간에 튀지 않는다. */
const FINE_PAIRS = ['dimmer', 'pan', 'tilt']

/** 한 조명의 값을 from → to 로 t(0~1)만큼 진행. fade:false 채널은 시작하자마자 바뀐다. */
export function lerpFixture(type: FixtureType, from: Record<string, number> = {}, to: Record<string, number> = {}, t: number) {
  const out: Record<string, number> = {}
  const fades = new Map(type.channels.map((c) => [c.attr, c.fade]))
  for (const attr of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const a = from[attr] ?? 0
    const b = to[attr] ?? a
    out[attr] = fades.get(attr) === false ? (t > 0 ? b : a) : Math.round(a + (b - a) * t)
  }
  for (const base of FINE_PAIRS) {
    const fine = base + '_fine'
    if (!fades.has(fine) || !(base in out)) continue
    const a = ((from[base] ?? 0) << 8) | (from[fine] ?? 0)
    const b = (((to[base] ?? from[base] ?? 0) << 8) | (to[fine] ?? from[fine] ?? 0))
    const v = Math.round(a + (b - a) * t)
    out[base] = v >> 8
    out[fine] = v & 255
  }
  return out
}

/** 16비트 값(0~65535). 미세 채널이 없으면 굵은 값만으로 계산. */
export const value16 = (v: Record<string, number> | undefined, base: string) =>
  (((v?.[base] ?? 0) << 8) | (v?.[base + '_fine'] ?? v?.[base] ?? 0))
