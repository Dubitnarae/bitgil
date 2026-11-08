import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Show } from './types'
import { Engine } from './engine'
import { editFixture, overlaps, swapFixtures } from './patch'

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
