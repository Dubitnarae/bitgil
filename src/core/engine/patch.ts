import type { Fixture, Show, Vec3, Venue } from './types'

/** 조명 찾기에서 고칠 수 있는 항목 */
export interface FixtureEdit {
  address?: number
  position?: Vec3
  direction?: Fixture['direction']
  verified?: boolean
  /** 한 곳을 겨누는 조명의 조준점, null = 지움 */
  aim?: Vec3 | null
}

const DIRECTIONS: Fixture['direction'][] = ['down', 'up', 'aimed', 'pan_tilt']

function fixture(show: Show, id: string) {
  const f = show.fixtures.find((x) => x.id === id)
  if (!f) throw new Error(`조명을 찾을 수 없음: ${id}`)
  return f
}

/** 조명 한 대의 주소·위치·방향·확인 표시를 고친다. 틀린 값이면 아무것도 바꾸지 않고 오류. */
export function editFixture(show: Show, id: string, p: FixtureEdit) {
  const f = fixture(show, id)
  const count = show.fixture_types.find((t) => t.id === f.type)?.channel_count ?? 1
  const next = { ...f }
  if (p.address !== undefined) {
    const a = Number(p.address)
    if (!Number.isInteger(a) || a < 1 || a + count - 1 > 512) throw new Error(`DMX 주소는 1~${513 - count} 사이여야 함: ${p.address}`)
    next.address = a
  }
  if (p.position) {
    const { x, y, z } = p.position
    if (![x, y, z].every((v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) < 100)) throw new Error('위치 값이 이상함')
    next.position = { x: Number(x), y: Number(y), z: Number(z) }
  }
  if (p.direction) {
    if (!DIRECTIONS.includes(p.direction)) throw new Error(`설치 방향이 이상함: ${p.direction}`)
    next.direction = p.direction
    // shortcut: 설치 위치(천장/바닥)는 방향에서 정함(위로·무빙 = 바닥, 겨눔 = 그대로), 천장 무빙 같은 예외가 생기면 따로 고르게
    if (p.direction !== 'aimed') next.mount = p.direction === 'up' || p.direction === 'pan_tilt' ? 'floor' : 'ceiling'
  }
  if (p.verified !== undefined) next.verified = !!p.verified
  if (p.aim !== undefined) next.aim = p.aim && { x: num(p.aim.x, '조준점 x'), y: num(p.aim.y, '조준점 y'), z: num(p.aim.z, '조준점 z') }
  Object.assign(f, next)
}

/** 0~max 사이 숫자인지 확인하고 숫자로 돌려준다(공간 좌표는 모두 기준 모서리에서 양수) */
function num(v: unknown, what: string, max = 100): number {
  const n = Number(v)
  if (v === '' || v === null || !Number.isFinite(n) || n < 0 || n > max) throw new Error(`${what} 값이 이상함(0~${max}): ${v}`)
  return n
}

function span(from: unknown, to: unknown, what: string): [number, number] {
  const a = num(from, what + ' 시작')
  const b = num(to, what + ' 끝')
  if (a >= b) throw new Error(`${what}: 시작(${a})이 끝(${b})보다 작아야 함`)
  return [a, b]
}

/** 공간(방·무대·좌석 단·배튼·소품)을 바꾼다. 값 하나라도 틀리면 아무것도 바꾸지 않고 오류. 배튼은 조명이 id로 붙어 있어 추가·삭제 없이 값만. */
export function editVenue(show: Show, v: Venue) {
  const r = v.room
  const room = { ...r, length_x: num(r.length_x, '방 길이'), width_z: num(r.width_z, '방 폭'), eave_height: num(r.eave_height, '처마 높이'), ridge_height: num(r.ridge_height, '지붕 꼭대기 높이') }
  if (!room.length_x || !room.width_z || !room.eave_height) throw new Error('방 길이·폭·처마 높이는 0보다 커야 함')
  if (room.ridge_height < room.eave_height) throw new Error('지붕 꼭대기가 처마보다 낮음')
  const [sz0, sz1] = span(v.stage.z_from, v.stage.z_to, '무대 깊이')
  const stage = { ...v.stage, z_from: sz0, z_to: sz1, height: num(v.stage.height, '무대 높이', 5) }
  const seating_tiers = v.seating_tiers.map((t, i) => {
    const [z0, z1] = span(t.z_from, t.z_to, `좌석 ${i + 1}단`)
    return { ...t, z_from: z0, z_to: z1, height: num(t.height, `좌석 ${i + 1}단 높이`, 10) }
  })
  const oldIds = show.venue.battens.map((b) => b.id).join()
  if (v.battens.map((b) => b.id).join() !== oldIds) throw new Error('배튼은 추가·삭제·이름 바꾸기 불가')
  const battens = v.battens.map((b) => {
    const [x0, x1] = span(b.x_from, b.x_to, `${b.id} 길이`)
    return { ...b, x_from: x0, x_to: x1, z: num(b.z, `${b.id} 위치`), height: num(b.height, `${b.id} 높이`, 30) }
  })
  const ids = new Set<string>()
  const props = v.props.map((p) => {
    const id = String(p.id ?? '').trim()
    if (!id || ids.has(id)) throw new Error(`소품 id가 비었거나 겹침: ${p.id}`)
    ids.add(id)
    const w = num(p.w, `${p.label} 폭`), d = num(p.d, `${p.label} 깊이`)
    if (!w || !d) throw new Error(`${p.label}: 폭·깊이는 0보다 커야 함`)
    return { ...p, id, label: String(p.label ?? '').trim() || id, x: num(p.x, `${p.label} x`), z: num(p.z, `${p.label} z`), w, d, h: num(p.h, `${p.label} 높이`, 20) }
  })
  show.venue = { ...show.venue, room, stage, seating_tiers, battens, props }
}

/** 조명 종류에서 고칠 수 있는 항목(추정값) */
export interface TypeEdit { beam_deg?: [number, number]; pan_deg?: number; tilt_deg?: number }

/** 조명 종류의 빛 각도(좁게~넓게)와 무빙 팬·틸트 범위를 고친다 */
export function editFixtureType(show: Show, id: string, p: TypeEdit) {
  const t = show.fixture_types.find((x) => x.id === id)
  if (!t) throw new Error(`조명 종류를 찾을 수 없음: ${id}`)
  const next = { ...t }
  if (p.beam_deg) {
    const lo = num(p.beam_deg[0], '빛 각도(좁게)', 180), hi = num(p.beam_deg[1], '빛 각도(넓게)', 180)
    if (!lo || lo > hi) throw new Error('빛 각도: 0 < 좁게 ≤ 넓게')
    next.beam_deg = [lo, hi]
  }
  if (p.pan_deg !== undefined) next.pan_deg = num(p.pan_deg, '팬 범위', 720)
  if (p.tilt_deg !== undefined) next.tilt_deg = num(p.tilt_deg, '틸트 범위', 360)
  Object.assign(t, next)
}

/** 두 조명의 자리(위치·조준점·설치 방향·배튼)를 맞바꾼다. 주소·종류는 그대로. */
export function swapFixtures(show: Show, a: string, b: string) {
  const fa = fixture(show, a)
  const fb = fixture(show, b)
  if (fa === fb) return
  const place = ({ position, aim, mount, direction, batten }: Fixture) => ({ position, aim, mount, direction, batten })
  const pa = place(fa)
  Object.assign(fa, place(fb))
  Object.assign(fb, pa)
}

/** 채널이 겹치는 다른 조명 id 목록(주소를 잘못 넣었을 때 경고용) */
export function overlaps(show: Show, id: string): string[] {
  const count = (f: Fixture) => show.fixture_types.find((t) => t.id === f.type)?.channel_count ?? 1
  const f = fixture(show, id)
  const end = f.address + count(f) - 1
  return show.fixtures
    .filter((o) => o.id !== id && o.address <= end && o.address + count(o) - 1 >= f.address)
    .map((o) => o.id)
}
