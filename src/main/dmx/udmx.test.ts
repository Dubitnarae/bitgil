import { describe, expect, it } from 'vitest'
import { UdmxOutput } from './udmx'

/** 실제 장치 대신 제어 전송만 기록하는 가짜 장치를 꽂는다 */
function fake(fail = false) {
  const out = new UdmxOutput()
  const log: { setup: object; data: Uint8Array }[] = []
  let closed = false
  const dev = {
    nativeControlTransferOut: (setup: object, _timeout: number, data: Uint8Array) => {
      log.push({ setup, data })
      return fail ? Promise.reject(new Error('device disconnected')) : Promise.resolve(512)
    },
    close: () => { closed = true; return Promise.resolve() }
  }
  Object.assign(out, { dev, enabled: true, connected: true })
  return { out, log, isClosed: () => closed }
}
const frame = new Uint8Array(512).fill(7)
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('UdmxOutput', () => {
  it('SetChannelRange: 0x40(vendor·장치), 요청 2, 채널 수 512, 시작 0, 데이터 = 512채널', () => {
    const { out, log } = fake()
    out.send(frame)
    expect(log[0].setup).toEqual({ requestType: 'vendor', recipient: 'device', request: 2, value: 512, index: 0 })
    expect(log[0].data.length).toBe(512)
    expect(log[0].data[511]).toBe(7)
  })

  it('앞 전송이 안 끝났으면 건너뛰고, 끝나면 다음 프레임을 보낸다', async () => {
    const { out, log } = fake()
    out.send(frame)
    out.send(frame)
    expect(log.length).toBe(1)
    await tick()
    out.send(frame)
    expect(log.length).toBe(2)
  })

  it('전송이 실패하면(장치 빠짐) 연결 끊김으로 바꾸고 장치를 닫는다 → 2초 재연결 대상', async () => {
    const { out, isClosed } = fake(true)
    out.send(frame)
    await tick()
    expect(out.connected).toBe(false)
    expect(out.error).toContain('연결이 끊겼습니다')
    expect(isClosed()).toBe(true)
  })

  /** 정해 둔 결과 순서대로 응답하는 장치(true = stall) */
  function stally(results: boolean[]) {
    const out = new UdmxOutput()
    let i = 0
    const dev = {
      nativeControlTransferOut: () => (results[i++] ? Promise.reject(new Error('controlTransferOut error: endpoint stalled')) : Promise.resolve(512)),
      close: () => Promise.resolve()
    }
    Object.assign(out, { dev, enabled: true, connected: true })
    return out
  }

  it('가끔 한 번씩 나는 stall 은 그 프레임만 건너뛰고 연결을 유지한다(허브 거친 장치)', async () => {
    const out = stally([true, false, true, true, false])
    for (let k = 0; k < 5; k++) { out.send(frame); await tick() }
    expect(out.connected).toBe(true)
    expect(out.error).toBe('')
  })

  it('stall 이 연속으로 이어지면 굳은 것 → 끊김 + 뺐다 꽂으라고 알린다', async () => {
    const out = stally(Array(UdmxOutput.MAX_STALLS).fill(true))
    for (let k = 0; k < UdmxOutput.MAX_STALLS - 1; k++) { out.send(frame); await tick() }
    expect(out.connected).toBe(true)
    out.send(frame); await tick()
    expect(out.connected).toBe(false)
    expect(out.error).toContain('뺐다 다시 꽂아')
  })

  it('출력이 꺼져 있으면 보내지 않는다', () => {
    const { out, log } = fake()
    out.setEnabled(false)
    out.send(frame)
    expect(log.length).toBe(0)
  })
})
