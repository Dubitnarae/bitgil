import type { Effect, FixtureType, Show, Values } from './types'
import { value16 } from './values'
import type { Levels } from './faders'

/**
 * 씬 효과: 씬 값(기준) 위에 시간에 따라 바뀌는 값을 얹는다. 매개변수는 콘솔 설명서와 같은 이름.
 * - size(크기) 0~100%: 얼마나 크게 바뀌는지
 * - speed(속도): 1분에 몇 번 도는지
 * - repeat(반복): 조명 줄 안에서 물결이 몇 번 되풀이되는지
 * - spread(퍼짐) 0~100%: 0 = 모두 같이, 100 = 한 물결 안에서 조명마다 고르게 어긋남
 * 조명 순서(fixtures) = 고른 순서 = 물결이 지나가는 순서.
 * 페이더를 내리면 씬 밝기가 줄어 효과도 같이 줄고, 블랙아웃·전체 밝기는 프레임에서 그 위에 곱한다.
 */

/** 조명 i(0부터)의 지금 위상(0~1 = 한 바퀴) */
export function effectPhase(e: Effect, i: number, now: number): number {
  const n = e.fixtures.length
  const group = Math.max(1, Math.ceil(n / Math.max(1, Math.round(e.repeat) || 1)))
  const offset = ((i % group) / group) * (clamp(e.spread, 0, 100) / 100)
  const cycles = (now / 60000) * clamp(e.speed, 0, 600)
  const p = (cycles - offset) % 1
  return p < 0 ? p + 1 : p
}

/** 밝기 물결: 위상 0 에서 씬 밝기 그대로, 반 바퀴에서 size 만큼 어두워진다 */
export const waveFactor = (e: Effect, phase: number) =>
  1 - (clamp(e.size, 0, 100) / 100) * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase))

/** 깜빡임: 한 바퀴의 앞 반은 씬 밝기 그대로, 뒤 반은 size 만큼 어둡게(100 = 꺼짐) */
export const flashFactor = (e: Effect, phase: number) => (phase < 0.5 ? 1 : 1 - clamp(e.size, 0, 100) / 100)

/** 색 돌기: 무지개 색(위상 = 색상환 각도)을 씬 색에 size 만큼 섞는다. 밝기는 씬 R·G·B 중 가장 큰 값(모두 0이면 255) */
export function colorAt(e: Effect, phase: number, rgb: [number, number, number]): [number, number, number] {
  const peak = Math.max(...rgb) || 255
  const k = clamp(e.size, 0, 100) / 100
  const hue = (h: number) => Math.max(0, Math.min(1, Math.abs(((phase * 6 + h) % 6) - 3) - 1)) // 빨강→초록→파랑
  return [hue(0), hue(4), hue(2)].map((c, i) => Math.round(rgb[i] * (1 - k) + c * peak * k)) as [number, number, number]
}

/** 무빙 원 크기 100% = 반지름 30° */
export const CIRCLE_MAX_DEG = 30

/**
 * 무빙 원: 지금 조준점(씬 팬·틸트) 둘레로 원을 그린다. 팬·틸트 값에 더할 16비트 차이를 돌려준다.
 * 틸트가 작으면(빛이 거의 위·아래) 같은 팬 각도도 원이 작아지므로 팬 폭을 1/sin(틸트)로 키운다.
 * 반대 방향(invert) 조명은 차이도 뒤집어 3D·실물에서 같은 쪽으로 돈다.
 */
// shortcut: 팬·틸트 평면의 원(틸트 0° 근처는 sin 0.3 으로 막아 둠), 천장·벽 설치 무빙이 생기면 빛 방향 벡터로 계산
export function circleDelta(e: Effect, phase: number, type: FixtureType, tilt16: number): { pan: number; tilt: number } {
  const r = (clamp(e.size, 0, 100) / 100) * CIRCLE_MAX_DEG
  const panDeg = type.pan_deg ?? 540, tiltDeg = type.tilt_deg ?? 270
  const tiltNow = Math.abs((tilt16 / 65535 - 0.5) * tiltDeg) * (Math.PI / 180)
  const a = 2 * Math.PI * phase
  return {
    pan: ((r * Math.cos(a)) / Math.max(0.3, Math.sin(tiltNow)) / panDeg) * 65535 * (type.pan_invert ? -1 : 1),
    tilt: ((r * Math.sin(a)) / tiltDeg) * 65535 * (type.tilt_invert ? -1 : 1),
  }
}

/** 16비트 값을 attr(+_fine)에 넣는다. 미세 채널이 없는 종류면 굵은 값만 */
function put16(out: Record<string, number>, attr: string, v16: number, hasFine: boolean) {
  const v = Math.max(0, Math.min(65535, Math.round(v16)))
  out[attr] = hasFine ? v >> 8 : Math.round(v / 257)
  if (hasFine) out[attr + '_fine'] = v & 255
}

/** 켜진(페이더 > 0) 씬의 효과를 값에 얹은 새 값. 효과가 없으면 같은 객체를 돌려준다. */
export function applyEffects(show: Show, values: Values, levels: Levels, now: number): Values {
  const active = show.scenes.filter((s) => (levels[s.id] ?? 0) > 0 && s.effects?.length)
  if (!active.length) return values
  const out: Values = { ...values }
  for (const s of active) {
    for (const e of s.effects!) {
      e.fixtures.forEach((id, i) => {
        const v = out[id]
        const phase = effectPhase(e, i, now)
        if (e.type === 'circle') {
          const f = show.fixtures.find((x) => x.id === id)
          const type = f?.direction === 'pan_tilt' ? show.fixture_types.find((t) => t.id === f.type) : undefined
          if (!v || !type || !('pan' in v || 'tilt' in v)) return // 팬·틸트 값이 없으면 중심을 모르니 그대로
          const has = (a: string) => type.channels.some((c) => c.attr === a)
          const d = circleDelta(e, phase, type, value16(v, 'tilt'))
          const next = { ...v }
          put16(next, 'pan', value16(v, 'pan') + d.pan, has('pan_fine'))
          put16(next, 'tilt', value16(v, 'tilt') + d.tilt, has('tilt_fine'))
          out[id] = next
          return
        }
        if (e.type === 'color') {
          if (!v || !('red' in v || 'green' in v || 'blue' in v)) return // 색 값이 없는 조명(흰색 전용 등)은 그대로
          const [red, green, blue] = colorAt(e, phase, [v.red ?? 0, v.green ?? 0, v.blue ?? 0])
          out[id] = { ...v, red, green, blue }
          return
        }
        if (!v || !('dimmer' in v)) return // 밝기 값이 없으면(꺼진 조명) 건드리지 않는다
        const f = e.type === 'flash' ? flashFactor(e, phase) : waveFactor(e, phase)
        if ('dimmer_fine' in v) {
          const d = Math.round(value16(v, 'dimmer') * f)
          out[id] = { ...v, dimmer: d >> 8, dimmer_fine: d & 255 }
        } else out[id] = { ...v, dimmer: Math.round(v.dimmer * f) }
      })
    }
  }
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0))

export const EFFECT_TYPES: Effect['type'][] = ['wave', 'flash', 'color', 'circle']

/** 화면·파일에서 받은 효과 목록 다듬기: 모르는 종류·없는 조명은 빼고, 숫자는 범위 안으로. 조명이 하나도 없는 효과는 버린다. */
export function cleanEffects(show: Show, list: Effect[]): Effect[] {
  const ids = new Set(show.fixtures.map((f) => f.id))
  return (Array.isArray(list) ? list : [])
    .filter((e) => EFFECT_TYPES.includes(e?.type))
    .map((e) => ({
      type: e.type,
      fixtures: [...new Set((e.fixtures ?? []).filter((id) => ids.has(id)))],
      size: clamp(e.size, 0, 100), speed: clamp(e.speed, 0, 600), repeat: Math.max(1, Math.round(clamp(e.repeat, 1, 36))), spread: clamp(e.spread, 0, 100)
    }))
    .filter((e) => e.fixtures.length > 0)
}
