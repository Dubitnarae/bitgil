import { execFile } from 'node:child_process'
import { usb } from 'usb'
import { newStats, type DmxOutput } from './output'

/** uDMX(Anyma 호환) 장치 번호 */
export const UDMX_VID = 0x16c0
export const UDMX_PID = 0x05dc
/** SetChannelRange: vendor·장치 대상·컴퓨터→장치(bmRequestType 0x40), bRequest 2, wValue = 채널 수, wIndex = 시작 채널 */
export const SET_CHANNEL_RANGE = { requestType: 'vendor', recipient: 'device', request: 2, value: 512, index: 0 } as const

type Device = NonNullable<Awaited<ReturnType<typeof usb.findDeviceByIds>>>

/** 꽂힌 uDMX 의 드라이버. none = 안 꽂힘, ok = WinUSB, missing = 꽂혔지만 WinUSB 가 아님(Zadig 필요) */
export type DriverState = 'none' | 'ok' | 'missing'
/** Windows 장치 정보(Win32_PnPEntity) 줄들로 판단. 언어와 상관없게 드라이버 이름(Service)·오류 코드만 본다 */
export function driverState(rows: { Service?: string | null; ConfigManagerErrorCode?: number }[]): DriverState {
  if (!rows.length) return 'none'
  return rows.some((r) => r.Service?.toLowerCase() === 'winusb' && !r.ConfigManagerErrorCode) ? 'ok' : 'missing'
}
const PNP_QUERY = String.raw`Get-CimInstance Win32_PnPEntity -Filter "PNPDeviceID LIKE 'USB\\VID_16C0&PID_05DC%'" | Select-Object Service,ConfigManagerErrorCode | ConvertTo-Json -Compress`
/** 드라이버 상태 확인(약 1초). Windows 가 아니거나 실패하면 none */
export function checkDriver(): Promise<DriverState> {
  if (process.platform !== 'win32') return Promise.resolve('none')
  return new Promise((ok) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PNP_QUERY], { timeout: 10000, windowsHide: true }, (err, out) => {
    if (err) return ok('none')
    try {
      const j = out.trim() ? JSON.parse(out) : []
      ok(driverState(Array.isArray(j) ? j : [j]))
    } catch { ok('none') }
  }))
}
export const NO_DRIVER = 'uDMX 드라이버가 없습니다 — 편집 모드 → 설정 → [uDMX 드라이버 설치]'

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
      () => { this.busy = false; this.stalls = 0; this.stats.ok++ },
      (err: unknown) => {
        this.busy = false
        const why = err instanceof Error ? err.message : String(err)
        this.stats.fail++
        this.stats.maxRun = Math.max(this.stats.maxRun, this.stalls + 1)
        // 허브를 거친 저가 uDMX 는 5% 정도 한 번씩 stall 을 내고 다음 전송에서 바로 살아난다 → 그 프레임만 건너뜀.
        // 연속으로 이어지면 장치가 굳은 것(뺐다 꽂아야 풀림). 장치가 빠진 것 같은 다른 오류는 바로 끊김.
        if (/stall/i.test(why) && ++this.stalls < UdmxOutput.MAX_STALLS) return
        this.lost(dev, why)
      })
  }

  /** 이만큼 연속 stall 이면 굳은 것으로 본다(약 0.5~1초). 시험에서 정상 장치의 연속 실패는 최대 2번 */
  static readonly MAX_STALLS = 20
  private stalls = 0
  stats = newStats()
  private driver: DriverState = 'none'
  private driverCheckedAt = 0
  /** 드라이버 상태 확인 방법(시험에서 바꿔 끼움) */
  check = checkDriver
  /** 드라이버를 설치했을 때 바로 다시 확인하게 */
  recheckDriver() { this.driverCheckedAt = 0 }

  private async connect() {
    if (this.opening || this.connected) return
    this.opening = true
    let dev: Device | undefined
    try {
      dev = await usb.findDeviceByIds(UDMX_VID, UDMX_PID)
      if (!dev) {
        // 드라이버가 없으면 usb 라이브러리 목록에 안 보인다 → 꽂혀 있는지 Windows 에 물어 구분(1초 걸려서 10초에 한 번만)
        if (Date.now() - this.driverCheckedAt > 10_000) { this.driverCheckedAt = Date.now(); this.driver = await this.check() }
        throw new Error(this.driver === 'missing' ? NO_DRIVER : 'uDMX 장치를 찾지 못했습니다 — USB(허브)에 꽂혀 있는지 확인')
      }
      await dev.open()
      await dev.claimInterface(0) // Windows(WinUSB)는 인터페이스를 잡아야 제어 전송이 됨(안 잡으면 'invalid state')
      if (!this.enabled) { await dev.close(); return } // 여는 사이에 출력을 끈 경우
      this.dev = dev
      this.path = 'uDMX'
      this.connected = true
      this.busy = false
      this.stalls = 0
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
    this.stats.drops++
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
