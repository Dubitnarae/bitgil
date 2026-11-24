import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Effect, Show, Values } from './types'
import { Engine } from './engine'
import { applyEffects, circleDelta, cleanEffects, colorAt, effectPhase, flashFactor, waveFactor } from './effects'
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

describe('깜빡임·색 돌기', () => {
  it('깜빡임: 앞 반은 그대로, 뒤 반은 크기만큼 어둡게', () => {
    expect(flashFactor(wave([]), 0.2)).toBe(1)
    expect(flashFactor(wave([]), 0.7)).toBe(0)
    expect(flashFactor(wave([], { size: 30 }), 0.7)).toBeCloseTo(0.7)
  })
  it('색 돌기: 빨강→초록→파랑, 크기 0 이면 씬 색 그대로, 밝기는 씬 최댓값', () => {
    const e = wave([], { type: 'color' })
    expect(colorAt(e, 0, [0, 0, 0])).toEqual([255, 0, 0])
    expect(colorAt(e, 1 / 3, [0, 0, 0])).toEqual([0, 255, 0])
    expect(colorAt(e, 2 / 3, [100, 0, 0])).toEqual([0, 0, 100])
    expect(colorAt(wave([], { type: 'color', size: 0 }), 0.5, [1, 2, 3])).toEqual([1, 2, 3])
  })
  it('색 돌기는 색 있는 조명만, 밝기·W 는 그대로', () => {
    const show = load()
    show.scenes[0].effects = [wave(['a', 'b'], { type: 'color', spread: 0 })]
    const v = { a: { dimmer: 200, red: 0, green: 0, blue: 0, white: 50 }, b: { dimmer: 200 } }
    const out = applyEffects(show, v, { [show.scenes[0].id]: 1 }, 0)
    expect(out.a).toEqual({ dimmer: 200, red: 255, green: 0, blue: 0, white: 50 })
    expect(out.b).toBe(v.b)
  })
})

describe('무빙 원', () => {
  it('조준점 둘레로 돌고 한 바퀴면 제자리, 무빙이 아니거나 팬·틸트 값이 없으면 그대로', () => {
    const show = load()
    const id = show.fixtures.find((f) => f.direction === 'pan_tilt')!.id
    const other = show.fixtures.find((f) => f.direction !== 'pan_tilt')!.id
    show.scenes[0].effects = [wave([id, other, 'zz'], { type: 'circle', speed: 60 })]
    const on = { [show.scenes[0].id]: 1 }
    const v: Values = { [id]: { pan: 128, pan_fine: 0, tilt: 160, tilt_fine: 0, dimmer: 255 }, [other]: { pan: 9, dimmer: 9 } }
    const a = applyEffects(show, v, on, 0)
    const b = applyEffects(show, v, on, 250)
    expect(value16(a[id], 'pan')).toBeGreaterThan(value16(v[id], 'pan')) // 0° = 팬 쪽
    expect(value16(a[id], 'tilt')).toBe(value16(v[id], 'tilt'))
    expect(value16(b[id], 'tilt')).toBeGreaterThan(value16(v[id], 'tilt')) // 90° = 틸트 쪽
    expect(applyEffects(show, v, on, 1000)[id]).toEqual(a[id])
    expect(a[id].dimmer).toBe(255)
    expect(a[other]).toBe(v[other])
  })
  it('크기 0 이면 안 움직이고, 반대 방향이면 차이도 반대, 끝에서는 0~65535 로 막힌다', () => {
    const t = load().fixture_types.find((x) => x.id === 'wash')!
    expect(circleDelta(wave([], { size: 0 }), 0, t, 40000).pan).toBeCloseTo(0)
    const d = circleDelta(wave([]), 0, t, 40000).pan
    expect(circleDelta(wave([]), 0, { ...t, pan_invert: true }, 40000).pan).toBeCloseTo(-d)
    const show = load()
    const id = show.fixtures.find((f) => f.direction === 'pan_tilt')!.id
    show.scenes[0].effects = [wave([id], { type: 'circle' })]
    const out = applyEffects(show, { [id]: { pan: 255, pan_fine: 255, tilt: 128 } }, { [show.scenes[0].id]: 1 }, 0)
    expect(value16(out[id], 'pan')).toBe(65535)
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

describe('효과 편집', () => {
  it('다듬기: 모르는 종류·없는 조명·조명 없는 효과는 빼고 숫자는 범위 안으로', () => {
    const show = load()
    const list = cleanEffects(show, [
      wave(['1-1', 'zz', '1-1'], { size: 300, speed: -5, repeat: 0, spread: 50 }),
      wave(['zz']),
      { ...wave(['1-1']), type: 'boom' as never }
    ])
    expect(list).toEqual([{ type: 'wave', fixtures: ['1-1'], size: 100, speed: 0, repeat: 1, spread: 50 }])
  })
  it('편집 미리보기는 미리보기에만, 저장하면 씬에 남고 미리보기는 끝난다', () => {
    const e = new Engine(load())
    const s = e.show.scenes.find((x) => Object.values(x.values).some((v) => v.dimmer > 0))!
    const id = Object.keys(s.values).find((k) => s.values[k].dimmer > 0)!
    e.setFader(0, s.id, 1) // 바로 반영 모드: LIVE 와 미리보기 둘 다 올라감
    const before = e.output(500)[id]
    expect(e.effectsRunning(500)).toBe(false)
    e.setEffectDraft({ scene: s.id, effects: [wave([id], { spread: 0 })] })
    expect(e.previewOutput(500)[id].dimmer).toBeLessThan(before.dimmer)
    expect(e.output(500)[id]).toEqual(before) // LIVE 는 그대로
    expect(s.effects).toBeUndefined() // 쇼도 그대로
    e.setEffects(s.id, [wave([id], { spread: 0 })])
    expect(e.effectDraft).toBeNull()
    expect(s.effects).toHaveLength(1)
    expect(e.output(500)[id].dimmer).toBeLessThan(before.dimmer)
    expect(e.effectsRunning(500)).toBe(true)
    e.setFader(0, s.id, 0)
    expect(e.effectsRunning(500)).toBe(false) // 페이더 내리면 효과도 멈춘 것
    e.setEffects(s.id, [])
    expect(s.effects).toBeUndefined()
    expect(() => e.setEffectDraft({ scene: 'nope', effects: [] })).toThrow()
  })
})
