import { describe, expect, it } from 'vitest'
import { guideSteps } from './guide'

const st = (o: any = {}) => ({ blackout: false, pending: false, cue: -1, faders: {}, ...o,
  output: { enabled: true, connected: true, port: 'COM5', error: '', ...o.output } }) as any
const show = (o: any = {}) => ({ scenes: [{ id: 'a', name: '기본' }, { id: 'b', name: '설교' }], cuelist: [{ scene: 'b', fade: 2 }], default_scene: 'a', ...o }) as any
const done = (s: any, sh = show()) => guideSteps(s, sh).map((x) => x.done)
const target = (s: any, sh = show()) => guideSteps(s, sh).map((x) => x.target)

describe('따라하기', () => {
  it('처음엔 출력 켜기부터, 연결 안 되면 안 끝남', () => {
    expect(done(st({ output: { enabled: false } }))).toEqual([false, false, false])
    expect(done(st({ output: { connected: false } }))[0]).toBe(false)
  })
  it('기본 조명: 기본 씬 페이더가 올라가야, 블랙아웃이면 블랙아웃 해제를 짚음', () => {
    expect(done(st({ faders: { a: 1 } }))).toEqual([true, true, false])
    expect(guideSteps(st({ faders: { a: 1 }, blackout: true }), show())[1]).toMatchObject({ done: false, target: 'blackout' })
    expect(done(st({ faders: { a: 1 } }), show({ default_scene: undefined }))[1]).toBe(true) // 안 정했으면 첫 씬
  })
  it('순서: [다음] → [적용] 차례로 짚고, 적용해야 끝', () => {
    expect(target(st())[2]).toBe('next')
    expect(guideSteps(st({ cue: 0, pending: true }), show())[2]).toMatchObject({ done: false, target: 'apply' })
    expect(done(st({ cue: 0, faders: { b: 1 } }))[2]).toBe(true)
  })
  it('순서 목록이 비면 씬 버튼으로', () => {
    const sh = show({ cuelist: [] })
    expect(target(st(), sh)[2]).toBe('scenes')
    expect(done(st({ faders: { a: 1 } }), sh)[2]).toBe(false)
    expect(done(st({ faders: { b: 1 } }), sh)[2]).toBe(true)
  })
})
