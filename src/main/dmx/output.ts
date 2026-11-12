/** DMX 출력 공통 모양. 가상 출력과 실제 Enttec 출력이 같은 모양을 따른다. */
export interface DmxOutput {
  readonly name: string
  readonly connected: boolean
  send(frame: Uint8Array): void
}

/** 실제 출력의 누적 기록(연결 시험이 시작·끝 값을 비교). ok = 보낸 프레임, fail = 거절(그 프레임만 건너뜀), maxRun = 연속 거절 최대, drops = 끊김 */
export interface OutStats { ok: number; fail: number; maxRun: number; drops: number }
export const newStats = (): OutStats => ({ ok: 0, fail: 0, maxRun: 0, drops: 0 })

/** 장비 없이 마지막 프레임만 기억한다(채널 모니터로 보여줌). 개발 기본값. */
export class VirtualOutput implements DmxOutput {
  readonly name = '가상 출력'
  readonly connected = true
  last: Uint8Array = new Uint8Array(512)
  send(frame: Uint8Array) { this.last = frame }
}
