import { describe, expect, it } from 'vitest'
import { pickPort, UsbDmxOutput } from './enttec'

const ports = [
  { path: 'COM1', manufacturer: '(표준 포트 유형)' },
  { path: 'COM5', manufacturer: 'FTDI', vendorId: '0403' },
  { path: 'COM7', manufacturer: 'Microsoft', vendorId: '0403' }
]

describe('pickPort', () => {
  it('설정이 비면 FTDI 포트를 자동으로 고른다', () => expect(pickPort(ports, '')).toBe('COM5'))
  it('제조사 이름이 없어도 FTDI 장치 번호(0403)로 찾는다', () => expect(pickPort(ports.slice(2), '')).toBe('COM7'))
  it('설정한 포트를 우선한다', () => expect(pickPort(ports, 'COM7')).toBe('COM7'))
  it('설정한 포트가 없으면 다른 포트로 바꾸지 않는다', () => expect(pickPort(ports, 'COM9')).toBeUndefined())
  it('후보가 없으면 없음', () => expect(pickPort(ports.slice(0, 1), '')).toBeUndefined())
})

describe('UsbDmxOutput 전송 모양', () => {
  /** 실제 포트 대신 호출 순서만 기록하는 가짜 포트를 꽂는다 */
  function fake(type: 'pro' | 'open') {
    const out = new UsbDmxOutput('', type)
    const log: unknown[] = []
    const port = {
      set: (o: object, cb: () => void) => { log.push(o); cb() },
      write: (b: Buffer, cb: () => void) => { log.push(b); cb() },
      drain: (cb: () => void) => { log.push('drain'); cb() }
    }
    Object.assign(out, { port, enabled: true, connected: true })
    return { out, log }
  }
  const frame = new Uint8Array(512).fill(7)

  it('Open DMX: 브레이크 켜기 → 끄기 → 시작 코드 0 + 512채널', () => {
    const { out, log } = fake('open')
    out.send(frame)
    expect(log.slice(0, 2)).toEqual([{ brk: true }, { brk: false }])
    const b = log[2] as Buffer
    expect(b.length).toBe(513)
    expect(b[0]).toBe(0)
    expect(b[512]).toBe(7)
    expect(log[3]).toBe('drain') // 다 나간 뒤에야 다음 프레임(브레이크)을 허락
  })

  it('Pro: 브레이크 없이 7E 06 … E7 메시지 하나', () => {
    const { out, log } = fake('pro')
    out.send(frame)
    expect(log.length).toBe(1)
    const b = log[0] as Buffer
    expect([b[0], b[1], b[b.length - 1]]).toEqual([0x7e, 0x06, 0xe7])
  })
})
