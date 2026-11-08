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

/**
 * Enttec DMX USB Pro 실제 출력. 출력이 켜졌을 때만 포트를 열고 보낸다.
 * 끊기면 connected=false, 2초마다 다시 연결한다. 연결되면 다음 send(현재 LIVE 프레임)부터 나간다.
 */
export class EnttecProOutput implements DmxOutput {
  readonly name = 'Enttec 출력'
  connected = false
  enabled = false
  path = ''
  error = ''
  private port: SerialPort | null = null
  private opening = false
  private busy = false

  constructor(public preferred = '') {
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

  send(frame: Uint8Array) {
    // 앞 전송이 아직 안 끝났으면 건너뛴다(장비가 막혔을 때 쌓이지 않게)
    if (!this.enabled || !this.connected || !this.port || this.busy) return
    this.busy = true
    this.port.write(Buffer.from(enttecPacket(frame)), () => { this.busy = false })
  }

  private async connect() {
    if (this.opening || this.connected) return
    this.opening = true
    try {
      const path = pickPort(await listPorts(), this.preferred)
      if (!path) throw new Error(this.preferred ? `${this.preferred} 포트가 없습니다` : 'DMX 인터페이스를 찾지 못했습니다')
      const port = new SerialPort({ path, baudRate: 115200, autoOpen: false })
      await new Promise<void>((ok, fail) => port.open((err) => (err ? fail(err) : ok())))
      if (!this.enabled) { port.close(); return } // 여는 사이에 출력을 끈 경우
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
