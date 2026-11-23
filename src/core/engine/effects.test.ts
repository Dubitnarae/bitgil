import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Effect, Show } from './types'
import { Engine } from './engine'
import { applyEffects, effectPhase, waveFactor } from './effects'
import { value16 } from './values'

const load = (): Show => JSON.parse(readFileSync('data/starter-show.bitgil.json', 'utf-8'))
const wave = (fixtures: string[], o: Partial<Effect> = {}): Effect =>
  ({ type: 'wave', fixtures, size: 100, speed: 60, repeat: 1, spread: 100, ...o })

describe('효과 위상', () => {
  it('속도 60 = 1초에 한 바퀴, 퍼짐 100 이면 조명마다 고르게 어긋난다', () => {
    const e = wave(['a', 'b', 'c', 'd'])
    expect(effectPhase(e, 0, 0)).toBe(0)
    expect(effectPhase(e, 0, 500)).toBeCloseTo(0.5)
    expect(effectPhase(e, 1, 0)).toBeCloseTo(0.75) // 한 칸 뒤 = 1/4 늦게
    expect(effectPhase(e, 2, 0)).toBeCloseTo(0.5)
  })
  it('퍼짐 0 이면 모두 같이, 반복 2 면 반씩 되풀이', () => {
    expect(effectPhase(wave(['a', 'b'], { spread: 0 }), 1, 250)).toBeCloseTo(0.25)
    const r = wave(['a', 'b', 'c', 'd'], { repeat: 2 })
    expect(effectPhase(r, 2, 0)).toBeCloseTo(effectPhase(r, 0, 0))
    expect(effectPhase(r, 1, 0)).toBeCloseTo(0.5)
  })
  it('밝기 물결: 위상 0 은 그대로, 반 바퀴는 크기만큼 어둡게', () => {
    expect(waveFactor(wave([]), 0)).toBe(1)
    expect(waveFactor(wave([]), 0.5)).toBeCloseTo(0)
    expect(waveFactor(wave([], { size: 40 }), 0.5)).toBeCloseTo(0.6)
  })
})

describe('씬 효과 계산', () => {
  it('켜진 씬의 효과만, 밝기 없는 조명은 그대로', () => {
    const show = load()
    show.scenes[0].effects = [wave(['1-1', 'zz'], { spread: 0 })]
    const v = { '1-1': { dimmer: 200, red: 9 } }
    expect(applyEffects(show, v, {}, 500)).toBe(v) // 페이더 0
    const out = applyEffects(show, v, { [show.scenes[0].id]: 1 }, 500)
    expect(out['1-1']).toEqual({ dimmer: 0, red: 9 })
    expect(v['1-1'].dimmer).toBe(200) // 원래 값은 안 바뀜
  })
  it('16비트 밝기는 합쳐서 줄인다', () => {
    const show = load()
    const ov = show.fixtures.find((f) => f.type === 'OV_300W_3')!.id
    show.scenes[0].effects = [wave([ov], { size: 50 })]
    const out = applyEffects(show, { [ov]: { dimmer: 255, dimmer_fine: 255 } }, { [show.scenes[0].id]: 1 }, 500)
    expect(value16(out[ov], 'dimmer')).toBe(Math.round(65535 * 0.5))
  })
})

describe('엔진 + 효과', () => {
  it('씬을 적용하면 DMX·미리보기 모두 물결, 페이더 내리면 같이 줄고 블랙아웃이 이긴다', () => {
    const show = load()
    const s = show.scenes.find((x) => Object.values(x.values).some((v) => v.dimmer > 100) && Object.keys(x.values).length >= 2)!
    const ids = Object.keys(s.values).filter((id) => s.values[id].dimmer > 100).slice(0, 2)
    s.effects = [wave(ids, { spread: 0 })]
    const e = new Engine(show)
    e.setFader(0, s.id, 1)
    const base = s.values[ids[0]].dimmer
    expect(e.output(0)[ids[0]].dimmer).toBe(base)
    expect(e.output(500)[ids[0]].dimmer).toBe(0)
    expect(e.output(250)[ids[0]].dimmer).toBe(Math.round(base * 0.5))
    expect(e.previewOutput(500)[ids[0]].dimmer).toBe(0)
    e.setFader(0, s.id, 0.5)
    expect(e.output(250)[ids[0]].dimmer).toBe(Math.round(Math.round(base * 0.5) * 0.5))
    const f = show.fixtures.find((x) => x.id === ids[0])!
    const ch = f.address - 1 + show.fixture_types.find((t) => t.id === f.type)!.channels.find((c) => c.attr === 'dimmer')!.offset - 1
    expect(e.frame(0)[ch]).toBeGreaterThan(0)
    e.blackout = true
    expect(e.frame(0)[ch]).toBe(0)
  })
  it('씬 저장은 효과를 뺀 값을 저장하고 효과는 씬에 남는다', () => {
    const show = load()
    const s = show.scenes[0]
    const id = Object.keys(s.values)[0]
    s.effects = [wave([id])]
    const before = JSON.stringify(s.values)
    const e = new Engine(show)
    e.selectScene(s.id)
    e.saveScene('', { id: s.id })
    expect(JSON.stringify(s.values)).toBe(before)
    expect(s.effects).toHaveLength(1)
  })
})
