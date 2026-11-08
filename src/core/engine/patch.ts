import type { Fixture, Show, Vec3 } from './types'

/** 조명 찾기에서 고칠 수 있는 항목 */
export interface FixtureEdit {
  address?: number
  position?: Vec3
  direction?: Fixture['direction']
  verified?: boolean
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
    // shortcut: 설치 위치(천장/바닥)는 방향에서 정함(위로·무빙 = 바닥), 천장 무빙 같은 예외가 생기면 따로 고르게
    next.mount = p.direction === 'up' || p.direction === 'pan_tilt' ? 'floor' : 'ceiling'
  }
  if (p.verified !== undefined) next.verified = !!p.verified
  Object.assign(f, next)
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
