import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Show } from './types'
import { Engine } from './engine'
import { layerScenes } from './faders'

const base: Show = JSON.parse(readFileSync('data/starter-show.bitgil.json', 'utf-8'))
// 시험용 씬 두 개: 2-1(11ch, 밝기 8비트), 1-12(300W, 밝기 16비트)
const show: Show = {
  ...base,
  scenes: [
    { id: 'A', name: 'A', fade_seconds: 2, values: { '2-1': { dimmer: 200, red: 255 }, '1-12': { dimmer: 255, dimmer_fine: 255 } } },
    { id: 'B', name: 'B', fade_seconds: 2, values: { '2-1': { dimmer: 100, red: 10 } } }
  ]
}

describe('씬 페이더 겹치기', () => {
  it('밝기는 페이더만큼, 겹치면 큰 값(HTP)', () => {
    const v = layerScenes(show, {}, { A: 0.5, B: 1 }, { A: 1, B: 2 })
    expect(v['2-1'].dimmer).toBe(100) // A 200×0.5=100, B 100 → 100
    expect((v['1-12'].dimmer << 8) | v['1-12'].dimmer_fine).toBe(32768) // 16비트 절반
  })
  it('색은 나중에 올린 씬(LTP)', () => {
    expect(layerScenes(show, {}, { A: 1, B: 1 }, { A: 1, B: 2 })['2-1'].red).toBe(10)
    expect(layerScenes(show, {}, { A: 1, B: 1 }, { A: 2, B: 1 })['2-1'].red).toBe(255)
  })
  it('페이더 0인 씬은 영향 없음, 기본 값은 유지', () => {
    const v = layerScenes(show, { '2-1': { dimmer: 30, red: 7 } }, { A: 0 }, {})
    expect(v['2-1']).toEqual({ dimmer: 30, red: 7 })
  })
})

describe('페이더 반영 방식', () => {
  it('바로 반영 모드: 움직이면 즉시 출력', () => {
    const e = new Engine(show)
    e.setFader(0, 'A', 0.5)
    expect(e.output(0)['2-1'].dimmer).toBe(100)
    expect(e.frame(0)[154]).toBe(100) // 2-1 밝기 채널 155
    expect(e.pending).toBe(false)
  })
  it('미리보기 모드: [적용]해야 나가고, 적용하면 페이드', () => {
    const e = new Engine(show)
    e.faderMode = 'preview'
    e.setFader(0, 'A', 1)
    expect(e.output(0)['2-1']).toBeUndefined()
    expect(e.previewOutput()['2-1'].dimmer).toBe(200)
    expect(e.pending).toBe(true)
    e.apply(1000, 2)
    expect(e.output(2000)['2-1'].dimmer).toBe(100) // 페이드 절반
    expect(e.output(3000)['2-1'].dimmer).toBe(200)
    expect(e.pending).toBe(false)
  })
  it('미리보기 모드: [취소]하면 페이더 위치가 되돌아간다', () => {
    const e = new Engine(show)
    e.faderMode = 'preview'
    e.setFader(0, 'A', 1)
    e.cancel()
    expect(e.previewFaders).toEqual({})
  })
  it('블랙아웃은 페이더보다 우선', () => {
    const e = new Engine(show)
    e.setFader(0, 'A', 1)
    e.blackout = true
    expect(e.frame(0)[154]).toBe(0)
  })
})
