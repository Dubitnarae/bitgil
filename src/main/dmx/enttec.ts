import { SerialPort } from 'serialport'
import { enttecPacket } from '../../core/engine/frame'
import type { DmxOutput } from './output'

export interface PortInfo { path: string; manufacturer?: string; vendorId?: string }

/** 포트 고르기: 설정에 정한 포트가 있으면 그것, 없으면 FTDI·ENTTEC·DMXking 으로 보이는 첫 포트 */
export function pickPort(ports: PortInfo[], preferred: string): string | undefined {
  if (preferred) return ports.find((p) => p.path === preferred)?.path
  return ports.find((p) => /ftdi|enttec|dmxking/i.test(p.manufacturer ?? '') || p.vendorId?.toLowerCase() === '0403')?.path
}

export const listPorts = (): Promise<PortInfo[]> => SerialPort.list()

/** 인터페이스 종류. pro = Enttec DMX USB Pro 호환(장비가 DMX 신호를 만듦), open = FTDI 칩만 있는 Open DMX 호환(Lixada 등, 컴퓨터가 신호 시간을 맞춤) */
export type DmxType = 'pro' | 'open'

/**
 * USB-DMX 실제 출력. 출력이 켜졌을 때만 포트를 열고 보낸다.
 * 끊기면 connected=false, 2초마다 다시 연결한다. 연결되면 다음 send(현재 LIVE 프레임)부터 나간다.
 */
export class UsbDmxOutput implements DmxOutput {
  readonly name = 'USB-DMX 출력'
  connected = false
  enabled = false
  path = ''
  error = ''
  private port: SerialPort | null = null
  private opening = false
  private busy = false

  constructor(public preferred = '', public type: DmxType = 'pro') {
    setInterval(() => { if (this.enabled && !this.connected) void this.connect() }, 2000)
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (on) void this.connect()
    else this.close()
  }

  setPreferred(path: string) {
    this.preferred = path
    this.close()
    if (this.enabled) void this.connect()
  }

  setType(type: DmxType) {
    this.type = type
    this.close()
    if (this.enabled) void this.connect()
  }

  send(frame: Uint8Array) {
    // 앞 전송이 아직 안 끝났으면 건너뛴다(장비가 막혔을 때 쌓이지 않게)
    const port = this.port
    if (!this.enabled || !this.connected || !port || this.busy) return
    this.busy = true
    const done = () => { this.busy = false }
    if (this.type === 'pro') return void port.write(Buffer.from(enttecPacket(frame)), done)
    // Open DMX: 브레이크(선을 잠깐 0으로, USB 왕복 시간만큼 → 88µs 이상) → 시작 코드 0 + 512채널
    // drain = 실제로 선에 다 나갈 때까지 기다림. 안 기다리면 다음 브레이크가 앞 프레임 끝 채널을 잘라 먹는다
    port.set({ brk: true }, () => port.set({ brk: false }, () =>
      port.write(Buffer.concat([Buffer.of(0), Buffer.from(frame)]), () => port.drain(done))))
  }

  private async connect() {
    if (this.opening || this.connected) return
    this.opening = true
    try {
      const path = pickPort(await listPorts(), this.preferred)
      if (!path) throw new Error(this.preferred ? `${this.preferred} 포트가 없습니다` : 'DMX 인터페이스를 찾지 못했습니다')
      // Pro 는 속도 값이 의미 없음. Open DMX 는 DMX 규격 그대로 250000bps, 8비트, 정지 비트 2
      const port = new SerialPort(this.type === 'pro'
        ? { path, baudRate: 115200, autoOpen: false }
        : { path, baudRate: 250000, dataBits: 8, stopBits: 2, parity: 'none', autoOpen: false })
      await new Promise<void>((ok, fail) => port.open((err) => (err ? fail(err) : ok())))
      if (!this.enabled) { port.close(); return } // 여는 사이에 출력을 끈 경우
      // FreeStyler·Enttec 예제·OLA 의 Open DMX 처럼 RTS 를 내린다(serialport 는 열 때 RTS 를 올려 둠)
      if (this.type === 'open') await new Promise<void>((ok) => port.set({ rts: false }, () => ok()))
      port.on('close', () => this.lost(port, '연결이 끊겼습니다'))
      port.on('error', (err) => this.lost(port, err.message))
      this.port = port
      this.path = path
      this.connected = true
      this.busy = false
      this.error = ''
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err)
    } finally {
      this.opening = false
    }
  }

  private lost(port: SerialPort, why: string) {
    if (this.port !== port) return
    this.port = null
    this.connected = false
    if (this.enabled) this.error = why
    if (port.isOpen) port.close()
  }

  private close() {
    const p = this.port
    this.port = null
    this.connected = false
    this.error = ''
    if (p?.isOpen) p.close()
  }
}
