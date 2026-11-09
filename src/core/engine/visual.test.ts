import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Show } from './types'
import { beamDirection, beamHit, panTiltFor } from './visual'

const show: Show = JSON.parse(readFileSync('data/starter-show.bitgil.json', 'utf-8'))
const type = show.fixture_types.find((t) => t.id === 'wash')!
const f = { ...show.fixtures.find((x) => x.type === 'wash')!, position: { x: 5, y: 0, z: 5 } }

describe('panTiltFor: 찍은 곳을 비추는 무빙 팬·틸트', () => {
  it.each([
    { x: 8, y: 0.5, z: 9 },
    { x: 2, y: 6, z: 1 },
    { x: 5, y: 7, z: 5.001 },
    { x: 1, y: -0.2, z: 5 }
  ])('계산한 값으로 빛 방향을 다시 구하면 그 지점을 향한다 %o', (target) => {
    const v = panTiltFor(type, f.position, target, undefined)!
    const d = beamDirection(f, type, v)
    const want = { x: target.x - 5, y: target.y, z: target.z - 5 }
    const l = Math.hypot(want.x, want.y, want.z)
    expect(d.x).toBeCloseTo(want.x / l, 3)
    expect(d.y).toBeCloseTo(want.y / l, 3)
    expect(d.z).toBeCloseTo(want.z / l, 3)
  })

  it('같은 방향이 되는 값이 여럿이면 지금 값에서 덜 움직이는 쪽', () => {
    const cur = { pan: 230, pan_fine: 0, tilt: 128, tilt_fine: 0 } // 팬을 오른쪽 끝 가까이 돌려 둔 상태
    const v = panTiltFor(type, f.position, { x: 8, y: 0.5, z: 9 }, cur)!
    expect(Math.abs(v.pan - 230)).toBeLessThan(Math.abs(panTiltFor(type, f.position, { x: 8, y: 0.5, z: 9 }, undefined)!.pan - 230))
  })

  it('좌석 단 위를 찍으면 빛 웅덩이가 그 지점에 생긴다', () => {
    const tier = show.venue.seating_tiers.at(-1)!
    const target = { x: 4, y: tier.height, z: (tier.z_from + tier.z_to) / 2 }
    const high = { ...f, position: { x: 5, y: 5, z: 5 } } // 바닥 조명이 더 높은 단을 겨누면 계단 옆면에 막히므로 높은 곳에서
    const d = beamDirection(high, type, panTiltFor(type, high.position, target, undefined)!)
    const hit = beamHit(show.venue, high.position, d).point
    expect(hit.x).toBeCloseTo(target.x, 2)
    expect(hit.y).toBeCloseTo(target.y, 2)
    expect(hit.z).toBeCloseTo(target.z, 2)
  })

  it('틸트 범위를 넘는 곳(바로 아래)은 null', () => {
    expect(panTiltFor(type, { x: 5, y: 3, z: 5 }, { x: 5, y: 0, z: 5 }, undefined)).toBeNull()
  })
})
