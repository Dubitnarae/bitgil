import { describe, expect, it } from 'vitest'
import { ConnTest } from './conntest'
import { newStats } from './output'

describe('ConnTest', () => {
  it('끊김 없이 끝나면 좋음, 시작 전 기록은 빼고 센다', () => {
    const out = { stats: { ...newStats(), ok: 100, fail: 5, maxRun: 7 } }
    const t = new ConnTest(out, 0, 60_000, false)
    for (let now = 25; now < 60_000; now += 25) { out.stats.ok++; expect(t.tick(now, true)).toBe(false) }
    out.stats.fail += 3; out.stats.maxRun = 2
    expect(t.tick(60_000, true)).toBe(true)
    const r = t.report(60_000, '')
    expect(r).toContain('1분 시험: 좋음')
    expect(r).toContain('보냄 2399번')
    expect(r).toContain('거절 3번(연속 최대 2')
    expect(r).toContain('끊김 0번')
  })

  it('끊기면 불안정, 가장 긴 끊김 시간을 잰다', () => {
    const out = { stats: newStats() }
    const t = new ConnTest(out, 0, 10_000, true)
    t.tick(1000, true)
    out.stats.drops++
    t.tick(2000, false); t.tick(3500, false) // 2.5초 끊김
    t.tick(4000, true)
    t.tick(5000, false) // 1초
    t.tick(6000, true)
    const r = t.report(10_000, '')
    expect(r).toContain('불안정')
    expect(r).toContain('끊김 1번')
    expect(r).toContain('2.5초')
  })

  it('처음 여는 동안은 끊김으로 안 세고, 끝까지 못 열면 이유를 보여준다', () => {
    const out = { stats: newStats() }
    const t = new ConnTest(out, 0, 5000, false)
    t.tick(1000, false); t.tick(5000, false)
    expect(t.report(5000, 'uDMX 드라이버가 없습니다')).toBe('5초 시험: 연결 안 됨 ✗ — uDMX 드라이버가 없습니다')
  })
})
