import { describe, expect, it } from 'vitest'
describe('beamAngle: 줌', () => {
  it('정면 조명(200W1S_5)은 줌 0 = 넓게, 255 = 좁게', () => {
    const t = show.fixture_types.find((x) => x.id === '200W1S_5')!
    expect(beamAngle(t, { zoom: 0 })).toBe(t.beam_deg[1])
    expect(beamAngle(t, { zoom: 255 })).toBe(t.beam_deg[0])
  })
  it('줌으로 좁힐수록 밝게(넓을 때 1, 최대 2), 줌 없는 기구는 1', () => {
    const t = show.fixture_types.find((x) => x.id === '200W1S_5')!
    expect(beamBoost(t, { zoom: 0 })).toBe(1)
    expect(beamBoost(t, { zoom: 128 })).toBeGreaterThan(1)
    expect(beamBoost(t, { zoom: 255 })).toBe(2)
    expect(beamBoost(show.fixture_types.find((x) => x.id === '8ch')!, {})).toBe(1)
  })
  it('표시 없는 기구는 그대로 0 = 좁게', () => {
    expect(beamAngle({ ...type, zoom_wide_at_0: undefined }, { zoom: 0 })).toBe(type.beam_deg[0])
  })
})
import { readFileSync } from 'node:fs'
import type { Show } from './types'
import { beamAngle, beamBoost, beamDirection, beamHit, fixtureColor, panTiltFor, shutterState } from './visual'

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

describe('셔터·팬 보정(실물 확인 2026-11-19)', () => {
  const t = (id: string) => show.fixture_types.find((x) => x.id === id)!
  it('무빙(wash)은 255 = 점등·0 = 꺼짐, 나머지는 0 = 점등·255 = 꺼짐, 사이는 스트로브', () => {
    expect(shutterState(t('wash'), { shutter: 255 })).toBe('open')
    expect(shutterState(t('wash'), { shutter: 0 })).toBe('closed')
    expect(shutterState(t('8ch'), { shutter: 0 })).toBe('open')
    expect(shutterState(t('8ch'), { shutter: 255 })).toBe('closed')
    expect(shutterState(t('OV_300W_3'), { shutter: 120 })).toBe('strobe')
    expect(fixtureColor(t('8ch'), { dimmer: 255, shutter: 255 }).intensity).toBe(0)
  })
  it('팬·틸트 반대 방향: 같은 값이면 3D 방향이 거울처럼 뒤집히고, 찍기 계산도 따라간다', () => {
    const inv = { ...type, pan_invert: true, tilt_invert: true }
    const v = { pan: 200, pan_fine: 0, tilt: 180, tilt_fine: 0 }
    const a = beamDirection(f, type, v), b = beamDirection(f, inv, v)
    const back = { pan: 255 - v.pan, pan_fine: 255, tilt: 255 - v.tilt, tilt_fine: 255 } // 가운데 기준 반대 값
    const c = beamDirection(f, type, back)
    expect(b.x).toBeCloseTo(c.x, 3)
    expect(b.z).toBeCloseTo(c.z, 3)
    expect(a.x).not.toBeCloseTo(b.x, 1)
    const target = { x: 8, y: 0.5, z: 9 }
    const d = beamDirection(f, inv, panTiltFor(inv, f.position, target, undefined)!)
    const want = { x: 3, y: 0.5, z: 4 }, l = Math.hypot(3, 0.5, 4)
    expect(d.x).toBeCloseTo(want.x / l, 3)
    expect(d.z).toBeCloseTo(want.z / l, 3)
  })

  it('무빙 팬 가운데 값 + 틸트 기울임 = 보정 90° 만큼 위에서 볼 때 반시계(+z → +x)', () => {
    const d = beamDirection(f, t('wash'), { pan: 127, pan_fine: 255, tilt: 200, tilt_fine: 0 })
    expect(d.x).toBeGreaterThan(0.5)
    expect(Math.abs(d.z)).toBeLessThan(0.01)
  })
})
