/** DMX 출력 공통 모양. 가상 출력과 실제 Enttec 출력이 같은 모양을 따른다. */
export interface DmxOutput {
  readonly name: string
  readonly connected: boolean
  send(frame: Uint8Array): void
}

/** 장비 없이 마지막 프레임만 기억한다(채널 모니터로 보여줌). 개발 기본값. */
export class VirtualOutput implements DmxOutput {
  readonly name = '가상 출력'
  readonly connected = true
  last: Uint8Array = new Uint8Array(512)
  send(frame: Uint8Array) { this.last = frame }
}
