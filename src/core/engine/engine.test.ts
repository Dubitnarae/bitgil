import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Show } from './types'
import { Engine } from './engine'
import { buildFrame, enttecPacket } from './frame'
import { lerpFixture, merge } from './values'
import { beamDirection, beamHit, fixtureColor } from './visual'

const show: Show = JSON.parse(readFileSync('data/starter-show.bitgil.json', 'utf-8'))
const type = (id: string) => show.fixture_types.find((t) => t.id === id)!
const fx = (id: string) => show.fixtures.find((f) => f.id === id)!

describe('씬 병합', () => {
  it('씬에 없는 조명·채널은 그대로 둔다', () => {
    const m = merge({ a: { red: 10, blue: 20 }, b: { red: 1 } }, { a: { red: 99 } })
    expect(m).toEqual({ a: { red: 99, blue: 20 }, b: { red: 1 } })
  })
})

describe('페이드', () => {
  it('중간에는 중간값, fade:false 채널은 바로 바뀐다', () => {
    const t = type('200W1S_5') // shutter fade:false
    const v = lerpFixture(t, { dimmer: 0, shutter: 0 }, { dimmer: 200, shutter: 255 }, 0.5)
    expect(v).toEqual({ dimmer: 100, shutter: 255 })
  })
  it('16비트(굵은+미세)는 합쳐서 페이드한다', () => {
    const v = lerpFixture(type('wash'), { tilt: 0, tilt_fine: 255 }, { tilt: 1, tilt_fine: 1 }, 0.5)
    expect((v.tilt << 8) | v.tilt_fine).toBe(256) // 255 → 257 의 가운데 (따로 하면 0→1, 255→1 로 튐)
  })
  it('적용하면 시간에 따라 LIVE가 PREVIEW로 간다', () => {
    const e = new Engine(show)
    e.setPreview(['1-12'], 'dimmer', 200)
    expect(e.current(0)['1-12']).toBeUndefined() // PREVIEW만 바뀜
    e.apply(1000, 2)
    expect(e.current(2000)['1-12'].dimmer).toBe(100)
    expect(e.current(3000)['1-12'].dimmer).toBe(200)
    expect(e.fading).toBe(false)
  })
  it('취소하면 PREVIEW가 LIVE로 돌아간다', () => {
    const e = new Engine(show)
    e.setPreview(['1-12'], 'dimmer', 200)
    e.cancel()
    expect(e.preview).toEqual({})
  })
  it('기본 조명은 PREVIEW를 거치지 않고 LIVE로 간다(그 씬 페이더 100%, 수동 값 지움)', () => {
    const e = new Engine(show)
    e.setPreview(['1-3'], 'dimmer', 5)
    e.apply(0, 0)
    e.goScene(0, 'P1-01')
    expect(e.output(10_000)['1-3'].dimmer).toBe(255)
    expect(e.faders['P1-01']).toBe(1)
    expect(e.pending).toBe(false)
  })
})

describe('DMX 프레임', () => {
  it('채널 = 주소 + offset - 1', () => {
    const f = buildFrame(show, { '2-1': { red: 11, dimmer: 55 } }) // 주소 151, red offset 1, dimmer 5
    expect(f[150]).toBe(11)
    expect(f[154]).toBe(55)
  })
  it('블랙아웃·전체 밝기는 밝기 채널에만', () => {
    const v = { '2-1': { red: 11, dimmer: 200 }, '1-12': { dimmer: 255, dimmer_fine: 255 } }
    expect(buildFrame(show, v, 1, true)[154]).toBe(0)
    expect(buildFrame(show, v, 1, true)[150]).toBe(11)
    expect(buildFrame(show, v, 0.5)[154]).toBe(100)
    const half = buildFrame(show, v, 0.5)
    expect((half[107] << 8) | half[108]).toBe(32768) // 1-12 주소 108, 16비트 밝기
  })
  it('Enttec 전송 메시지 형식', () => {
    const p = enttecPacket(new Uint8Array(512).fill(7))
    expect(p.length).toBe(518)
    expect([...p.slice(0, 5)]).toEqual([0x7e, 0x06, 0x01, 0x02, 0x00]) // 길이 513
    expect(p[5]).toBe(7)
    expect(p[517]).toBe(0xe7)
  })
})

describe('3D 계산', () => {
  it('색: RGB에 W를 더하고 밝기를 곱한다', () => {
    const c = fixtureColor(type('11ch'), { red: 255, white: 51, dimmer: 255 }, 0.5)
    expect(c.r).toBe(1)
    expect(c.g).toBeCloseTo(0.2)
    expect(c.intensity).toBeCloseTo(0.5)
  })
  it('무빙 워시 팬·틸트 가운데 값은 바로 위', () => {
    const d = beamDirection(fx('1-1'), type('wash'), { pan: 127, pan_fine: 255, tilt: 127, tilt_fine: 255 })
    expect(d.y).toBeCloseTo(1, 3)
  })
  it('천장 조명 빛은 그 아래 바닥(무대 높이)에 닿는다', () => {
    const h = beamHit(show.venue, fx('3-4').position, { x: 0, y: -1, z: 0 }) // RD1 z 2.46 → 통로
    expect(h.point.y).toBeCloseTo(0)
    const s = beamHit(show.venue, { x: 8, y: 5.2, z: 1 }, { x: 0, y: -1, z: 0 })
    expect(s.point.y).toBeCloseTo(0.4) // 무대 위
  })
})

describe('씬 저장', () => {
  it('미리보기에 보이는 값(페이더+손 조정)을 새 씬으로 저장한다', () => {
    const e = new Engine(structuredClone(show))
    e.selectScene('P1-01')
    e.setPreview(['1-1'], 'red', 7)
    const id = e.saveScene(' 설교 ')
    const s = e.show.scenes.find((x) => x.id === id)!
    expect(id).toBe('U-01')
    expect(s.name).toBe('설교')
    expect(s.values).toEqual(e.previewOutput())
    expect(s.values['1-1'].red).toBe(7)
    expect(e.saveScene('임시', { temp: true })).toBe('T-01')
    expect(e.saveScene('')).toBe('U-02')
  })
  it('덮어쓰기·이름 바꾸기·삭제', () => {
    const e = new Engine(structuredClone(show))
    e.setPreview(['1-1'], 'red', 9)
    e.saveScene('', { id: 'P1-02' })
    expect(e.show.scenes.find((x) => x.id === 'P1-02')!.values).toEqual({ '1-1': { red: 9 } })
    e.renameScene('P1-02', '찬양1')
    e.renameScene('P1-02', '  ') // 빈 이름은 무시
    expect(e.show.scenes.find((x) => x.id === 'P1-02')!.name).toBe('찬양1')
    e.setFader(0, 'P1-02', 1)
    e.deleteScene('P1-02')
    expect(e.show.scenes.some((x) => x.id === 'P1-02')).toBe(false)
    expect(e.faders['P1-02']).toBeUndefined()
  })
})
