import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Show } from './types'
import { Engine } from './engine'
import { editFixture, editFixtureType, editVenue, overlaps, swapFixtures } from './patch'

const load = (): Show => JSON.parse(readFileSync('data/starter-show.bitgil.json', 'utf-8'))
const fx = (s: Show, id: string) => s.fixtures.find((f) => f.id === id)!

describe('조명 찾기', () => {
  it('찾는 조명만 Locate 값으로 켜고 나머지는 끈다, 전체 밝기 0%여도 켜진다', () => {
    const e = new Engine(load())
    e.goScene(0, e.show.scenes[0].id)
    e.master = 0
    e.setFind(0, '2-1') // 11ch, 주소 151, 밝기 = 5번째 채널
    const frame = e.frame(10000)
    expect(frame[151 + 5 - 2]).toBe(255)
    expect(frame.reduce((n, v, i) => n + (v && (i < 150 || i > 160) ? 1 : 0), 0)).toBe(0)
    e.blackout = true
    expect(e.frame(10000)[151 + 5 - 2]).toBe(0) // 블랙아웃은 그대로 우선
  })
  it('끝내면 원래 상태로 2초 동안 돌아간다', () => {
    const e = new Engine(load())
    const before = e.frame(0)
    e.setFind(0, '2-1')
    e.setFind(1000, null)
    expect(e.fading).toBe(true)
    expect(e.frame(2000)[151 + 5 - 2]).toBe(128) // 중간
    expect(e.frame(3000)).toEqual(before)
    expect(e.fading).toBe(false)
  })
  it('주소가 다른 조명과 겹쳐도 찾는 조명이 켜진다', () => {
    const e = new Engine(load())
    editFixture(e.show, '1-7', { address: fx(e.show, '1-11').address })
    e.setFind(0, '1-7')
    expect(e.frame(0).some((v) => v > 0)).toBe(true)
  })
  it('없는 조명은 오류', () => {
    expect(() => new Engine(load()).setFind(0, 'x')).toThrow()
  })
})

describe('패치 수정', () => {
  it('주소·위치·방향·확인 표시를 고친다', () => {
    const s = load()
    editFixture(s, '2-1', { address: 400, position: { x: 1, y: 2, z: 3 }, direction: 'up', verified: true })
    expect(fx(s, '2-1')).toMatchObject({ address: 400, position: { x: 1, y: 2, z: 3 }, direction: 'up', mount: 'floor', verified: true })
  })
  it('틀린 값이면 아무것도 바꾸지 않는다', () => {
    const s = load()
    const before = JSON.stringify(fx(s, '2-1'))
    expect(() => editFixture(s, '2-1', { verified: true, address: 510 })).toThrow() // 11채널이라 502까지
    expect(() => editFixture(s, '2-1', { position: { x: NaN, y: 0, z: 0 } })).toThrow()
    expect(JSON.stringify(fx(s, '2-1'))).toBe(before)
  })
  it('자리 바꾸기: 위치·방향은 맞바꾸고 주소는 그대로', () => {
    const s = load()
    const [a, b] = [structuredClone(fx(s, '2-1')), structuredClone(fx(s, '2-2'))]
    swapFixtures(s, '2-1', '2-2')
    expect(fx(s, '2-1')).toMatchObject({ address: a.address, position: b.position, direction: b.direction })
    expect(fx(s, '2-2')).toMatchObject({ address: b.address, position: a.position, direction: a.direction })
  })
  it('채널이 겹치는 조명을 알려준다', () => {
    const s = load()
    expect(overlaps(s, '2-1')).toEqual([])
    editFixture(s, '2-2', { address: fx(s, '2-1').address + 3 })
    expect(overlaps(s, '2-1')).toEqual(['2-2'])
  })
})

describe('공간·조명 종류 수정', () => {
  it('공간 치수·소품을 고치고 추가·삭제한다', () => {
    const s = load()
    const v = structuredClone(s.venue)
    v.room.length_x = 17
    v.battens[0].height = 5.8
    v.props = [...v.props.slice(1), { id: 'drum', label: '드럼', x: 2, z: 7, w: 1.5, d: 1.5, h: 1 }]
    editVenue(s, v)
    expect(s.venue.room.length_x).toBe(17)
    expect(s.venue.battens[0]).toMatchObject({ id: 'RD1', height: 5.8, label: 'Apron 배튼' })
    expect(s.venue.props.map((p) => p.id)).toEqual(['piano', 'band', 'drum'])
    expect((s.venue as unknown as { note: string }).note).toBeTruthy() // 고치지 않은 항목은 남는다
  })
  it('틀린 공간 값이면 아무것도 바꾸지 않는다', () => {
    const s = load()
    const before = JSON.stringify(s.venue)
    const bad = (f: (v: typeof s.venue) => void) => { const v = structuredClone(s.venue); f(v); expect(() => editVenue(s, v)).toThrow() }
    bad((v) => { v.stage.z_to = v.stage.z_from })
    bad((v) => { v.room.ridge_height = 1 })
    bad((v) => { v.battens.pop() })
    bad((v) => { v.props[1].id = v.props[0].id })
    bad((v) => { v.seating_tiers[0].height = -1 })
    bad((v) => { (v.room as { length_x: unknown }).length_x = '' })
    expect(JSON.stringify(s.venue)).toBe(before)
  })
  it('조준점을 고치고 지운다', () => {
    const s = load()
    const id = s.fixtures.find((f) => f.aim)!.id
    editFixture(s, id, { aim: { x: 8, y: 1, z: 1 } })
    expect(fx(s, id).aim).toEqual({ x: 8, y: 1, z: 1 })
    expect(() => editFixture(s, id, { aim: { x: 8, y: NaN, z: 1 } })).toThrow()
    editFixture(s, id, { aim: null })
    expect(fx(s, id).aim).toBeNull()
  })
  it('빛 각도·팬·틸트 범위를 고친다', () => {
    const s = load()
    editFixtureType(s, 'wash', { beam_deg: [8, 30], pan_deg: 540, tilt_deg: 200 })
    expect(s.fixture_types[0]).toMatchObject({ beam_deg: [8, 30], tilt_deg: 200 })
    expect(() => editFixtureType(s, 'wash', { beam_deg: [30, 8] })).toThrow()
    expect(() => editFixtureType(s, 'wash', { tilt_deg: 999 })).toThrow()
    expect(s.fixture_types[0].beam_deg).toEqual([8, 30])
  })
})
