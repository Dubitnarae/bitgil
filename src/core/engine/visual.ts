import type { Fixture, FixtureType, Vec3, Venue } from './types'
import { value16 } from './values'

/** 표시 색과 세기(0~1). R·G·B에 W를 더해 섞고 밝기를 곱한다. */
// shortcut: 셔터 값의 뜻(열림/스트로브)이 기구마다 달라 화면 표시에서는 무시, 실물 확인 후 반영
export function fixtureColor(type: FixtureType, v: Record<string, number> | undefined, master = 1) {
  const has = (a: string) => type.channels.some((c) => c.attr === a)
  const intensity = (value16(v, 'dimmer') / 65535) * master
  if (!has('red')) return { r: 1, g: 0.92, b: 0.8, intensity } // 흰색 전용 조명(약간 따뜻한 색)
  const w = (v?.white ?? 0) / 255
  const c = (a: string) => Math.min(1, (v?.[a] ?? 0) / 255 + w)
  return { r: c('red'), g: c('green'), b: c('blue'), intensity }
}

/** 빛 퍼짐 각도(도). 줌 채널이 있으면 좁음~넓음 사이. */
export function beamAngle(type: FixtureType, v: Record<string, number> | undefined) {
  const [lo, hi] = type.beam_deg
  const hasZoom = type.channels.some((c) => c.attr === 'zoom')
  return hasZoom ? lo + ((hi - lo) * (v?.zoom ?? 0)) / 255 : lo
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

/**
 * 빛이 나가는 방향(단위 벡터). 무빙 워시(바닥 설치)는 팬·틸트 가운데 값이 바로 위,
 * 틸트를 올리면 좌석 쪽(+z)으로 기울고, 팬은 위에서 볼 때 돌아가는 각도. (각도 범위는 추정값)
 */
export function beamDirection(f: Fixture, type: FixtureType, v: Record<string, number> | undefined): Vec3 {
  if (f.direction === 'aimed' && f.aim) return norm({ x: f.aim.x - f.position.x, y: f.aim.y - f.position.y, z: f.aim.z - f.position.z })
  if (f.direction === 'up') return { x: 0, y: 1, z: 0 }
  if (f.direction === 'pan_tilt') {
    const rad = Math.PI / 180
    const pan = (value16(v, 'pan') / 65535 - 0.5) * (type.pan_deg ?? 540) * rad
    const tilt = (value16(v, 'tilt') / 65535 - 0.5) * (type.tilt_deg ?? 270) * rad
    return { x: Math.sin(tilt) * Math.sin(pan), y: Math.cos(tilt), z: Math.sin(tilt) * Math.cos(pan) }
  }
  return { x: 0, y: -1, z: 0 }
}

/** z 위치의 바닥 높이 (무대 / 통로 / 좌석 단) */
export function floorY(venue: Venue, z: number) {
  if (z >= venue.stage.z_from && z < venue.stage.z_to) return venue.stage.height
  const tier = venue.seating_tiers.find((t) => z >= t.z_from && z < t.z_to)
  return tier ? tier.height : 0
}

/** 빛이 처음 닿는 면(바닥·벽·처마 높이 천장)까지의 거리와 그 면의 방향 */
// shortcut: 공간을 상자로 보고 계산(지붕 경사·소품 무시), 정확한 빛 웅덩이가 필요하면 Three.js Raycaster로 교체
export function beamHit(venue: Venue, p: Vec3, d: Vec3) {
  const { length_x: X, width_z: Z, eave_height: H } = venue.room
  const cands: { t: number; n: Vec3 }[] = []
  const plane = (pos: number, dir: number, target: number, n: Vec3) => {
    if (Math.abs(dir) < 1e-6) return
    const t = (target - pos) / dir
    if (t > 0.01) cands.push({ t, n })
  }
  plane(p.x, d.x, 0, { x: 1, y: 0, z: 0 })
  plane(p.x, d.x, X, { x: -1, y: 0, z: 0 })
  plane(p.z, d.z, 0, { x: 0, y: 0, z: 1 })
  plane(p.z, d.z, Z, { x: 0, y: 0, z: -1 })
  plane(p.y, d.y, H, { x: 0, y: -1, z: 0 })
  if (d.y < 0) {
    // 아래로 가는 빛: 대략 닿는 곳의 바닥 높이로 한 번 더 맞춘다
    const t0 = (p.y - 0) / -d.y
    const fy = floorY(venue, p.z + d.z * t0)
    plane(p.y, d.y, fy, { x: 0, y: 1, z: 0 })
  }
  const hit = cands.sort((a, b) => a.t - b.t)[0] ?? { t: 6, n: { x: 0, y: 1, z: 0 } }
  return { distance: hit.t, normal: hit.n, point: { x: p.x + d.x * hit.t, y: p.y + d.y * hit.t, z: p.z + d.z * hit.t } }
}
