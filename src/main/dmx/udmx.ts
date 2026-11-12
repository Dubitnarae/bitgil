import { usb } from 'usb'
import type { DmxOutput } from './output'

/** uDMX(Anyma 호환) 장치 번호 */
export const UDMX_VID = 0x16c0
export const UDMX_PID = 0x05dc
/** SetChannelRange: vendor·장치 대상·컴퓨터→장치(bmRequestType 0x40), bRequest 2, wValue = 채널 수, wIndex = 시작 채널 */
export const SET_CHANNEL_RANGE = { requestType: 'vendor', recipient: 'device', request: 2, value: 512, index: 0 } as const

type Device = NonNullable<Awaited<ReturnType<typeof usb.findDeviceByIds>>>

/**
 * uDMX 실제 출력. COM 포트가 아니라 USB 제어 전송으로 512채널을 한 번에 보낸다(Windows 는 Zadig 로 WinUSB 드라이버 필요).
 * UsbDmxOutput 과 같은 규칙: 출력이 켜졌을 때만 열고, 끊기면 connected=false·2초마다 다시 연결.
 */
export class UdmxOutput implements DmxOutput {
  readonly name = 'uDMX 출력'
  readonly type = 'udmx'
  connected = false
  enabled = false
  path = ''
  error = ''
  private dev: Device | null = null
  private opening = false
  private busy = false

  constructor() {
    setInterval(() => { if (this.enabled && !this.connected) void this.connect() }, 2000)
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (on) void this.connect()
    else this.close()
  }

  send(frame: Uint8Array) {
    const dev = this.dev
    if (!this.enabled || !this.connected || !dev || this.busy) return
    this.busy = true // 앞 전송이 안 끝났으면 건너뜀. 장치가 멈춰도 제어 전송은 1초(1000ms) 뒤 실패로 끝나 갇히지 않는다
    dev.nativeControlTransferOut(SET_CHANNEL_RANGE, 1000, frame).then(
      () => { this.busy = false },
      (err: unknown) => { this.busy = false; this.lost(dev, err instanceof Error ? err.message : String(err)) })
  }

  private async connect() {
    if (this.opening || this.connected) return
    this.opening = true
    let dev: Device | undefined
    try {
      dev = await usb.findDeviceByIds(UDMX_VID, UDMX_PID)
      if (!dev) throw new Error('uDMX 장치를 찾지 못했습니다 (꽂혀 있으면 Zadig 로 WinUSB 드라이버 설치 필요)')
      await dev.open()
      await dev.claimInterface(0) // Windows(WinUSB)는 인터페이스를 잡아야 제어 전송이 됨(안 잡으면 'invalid state')
      if (!this.enabled) { await dev.close(); return } // 여는 사이에 출력을 끈 경우
      this.dev = dev
      this.path = 'uDMX'
      this.connected = true
      this.busy = false
      this.error = ''
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err)
      if (dev?.opened) dev.close().catch(() => {}) // 열고 나서 실패했으면 닫아 두어야 2초 뒤 다시 열 수 있음
    } finally {
      this.opening = false
    }
  }

  private lost(dev: Device, why: string) {
    if (this.dev !== dev) return
    this.dev = null
    this.connected = false
    // stall = 장치가 굳음(저가 uDMX 에서 확인됨). 프로그램으로는 못 풀고 뺐다 꽂아야 풀린다
    if (this.enabled) this.error = /stall/i.test(why) ? 'uDMX 가 멈췄습니다 — USB 를 뺐다 다시 꽂아 주세요' : `연결이 끊겼습니다: ${why}`
    dev.close().catch(() => {})
  }

  private close() {
    const d = this.dev
    this.dev = null
    this.connected = false
    this.error = ''
    d?.close().catch(() => {})
  }
}
