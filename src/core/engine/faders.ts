import type { Show, Values } from './types'
import { merge, value16 } from './values'

/** 씬 id → 페이더 위치(0~1) */
export type Levels = Record<string, number>

/**
 * 씬 페이더를 겹친 뒤, 손으로 조정한 값(base)을 맨 위에 올린다. 콘솔과 같은 규칙:
 * - HTP 채널(밝기): 씬 값 × 페이더 위치, 여러 개가 겹치면 큰 값
 * - LTP 채널(색·팬·틸트 등): 페이더가 0보다 크면 씬 값, 나중에 올린 씬이 이긴다
 * - 손으로 조정한 값은 씬보다 우선(콘솔의 프로그래머처럼). 조정한 채널만 덮는다.
 * order: 씬 id → 올린 순서 번호(클수록 나중)
 */
export function layerScenes(show: Show, base: Values, levels: Levels, order: Record<string, number>): Values {
  const active = show.scenes
    .filter((s) => (levels[s.id] ?? 0) > 0)
    .sort((a, b) => (order[a.id] ?? 0) - (order[b.id] ?? 0))
  if (!active.length) return base
  const types = new Map(show.fixture_types.map((t) => [t.id, t]))
  const fixtures = new Map(show.fixtures.map((f) => [f.id, f]))
  const out: Values = {}
  for (const s of active) {
    const level = levels[s.id]
    for (const [fid, attrs] of Object.entries(s.values)) {
      const type = types.get(fixtures.get(fid)?.type ?? '')
      if (!type) continue
      const o = (out[fid] ??= {})
      for (const [attr, val] of Object.entries(attrs)) {
        const ch = type.channels.find((c) => c.attr === attr)
        if (!ch || attr === 'dimmer_fine') continue
        if (ch.mix === 'LTP') { o[attr] = val; continue }
        if (attr === 'dimmer' && type.channels.some((c) => c.attr === 'dimmer_fine')) {
          // 16비트 밝기는 합쳐서 비교·계산
          const v = Math.max(value16(o, 'dimmer'), Math.round(value16(attrs, 'dimmer') * level))
          o.dimmer = v >> 8
          o.dimmer_fine = v & 255
        } else {
          o[attr] = Math.max(o[attr] ?? 0, Math.round(val * level))
        }
      }
    }
  }
  return merge(out, base)
}

/** 페이더 위치를 from → to 로 t만큼 진행 */
export function lerpLevels(from: Levels, to: Levels, t: number): Levels {
  const out: Levels = {}
  for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const a = from[id] ?? 0
    out[id] = a + ((to[id] ?? 0) - a) * t
  }
  return out
}
