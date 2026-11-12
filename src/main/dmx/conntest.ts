import type { OutStats } from './output'

/**
 * 연결 시험: 정해진 시간 동안 출력을 켜 두고 보낸 수·거절·끊김·가장 긴 끊김을 센다.
 * 출력의 누적 기록(stats)을 시작 때 찍어 두고 끝날 때 차이를 본다. 끊긴 시간은 출력 루프(25ms)마다 tick 으로 잰다.
 */
export class ConnTest {
  private start: OutStats
  private last: number
  private seen = false // 한 번이라도 연결됐는지(처음 여는 동안은 끊김으로 안 셈)
  private curOff = 0
  private maxOff = 0

  constructor(private out: { stats: OutStats }, readonly startedAt: number, readonly ms: number, readonly wasOn: boolean) {
    out.stats.maxRun = 0 // 연속 거절 최대는 시험 동안의 값만
    this.start = { ...out.stats }
    this.last = startedAt
  }

  /** 출력 루프마다 부른다. 시간이 다 됐으면 true */
  tick(now: number, connected: boolean): boolean {
    const dt = now - this.last
    this.last = now
    if (connected) { this.seen = true; this.curOff = 0 }
    else if (this.seen) { this.curOff += dt; this.maxOff = Math.max(this.maxOff, this.curOff) }
    return now - this.startedAt >= this.ms
  }

  /** 결과 한 줄. error = 끝날 때의 출력 오류 문구(연결이 한 번도 안 됐을 때 이유로 보여줌) */
  report(now: number, error: string): string {
    const s = this.out.stats
    const ok = s.ok - this.start.ok, fail = s.fail - this.start.fail, drops = s.drops - this.start.drops
    const secs = Math.max(1, (now - this.startedAt) / 1000)
    const len = secs >= 60 ? `${Math.round(secs / 6) / 10}분` : `${Math.round(secs)}초`
    if (!this.seen) return `${len} 시험: 연결 안 됨 ✗ — ${error || '장치를 열지 못했습니다'}`
    const good = drops === 0 && this.maxOff === 0
    return `${len} 시험: ${good ? '좋음 ✓' : '불안정 ✗'} · 보냄 ${ok}번(초당 ${Math.round(ok / secs)}) · 거절 ${fail}번(연속 최대 ${s.maxRun}, 20번 연속이면 끊김)` +
      ` · 끊김 ${drops}번` + (this.maxOff ? ` · 가장 길게 끊긴 시간 ${(this.maxOff / 1000).toFixed(1)}초` : '')
  }
}
