import type { Show, Values } from './types'
import { value16 } from './values'

/**
 * 512채널 DMX 프레임 만들기. DMX 채널 번호 = address + offset - 1.
 * 전체 밝기(master 0~1)와 블랙아웃은 밝기(dimmer) 채널에만 곱한다.
 */
export function buildFrame(show: Show, values: Values, master = 1, blackout = false): Uint8Array {
  const frame = new Uint8Array(512)
  const types = new Map(show.fixture_types.map((t) => [t.id, t]))
  const m = blackout ? 0 : Math.min(1, Math.max(0, master))
  for (const f of show.fixtures) {
    const type = types.get(f.type)
    const v = values[f.id]
    // 값이 없는 조명은 건드리지 않는다(프레임은 0으로 시작). 주소가 겹쳐도 켜진 조명이 꺼진 조명에 덮이지 않게.
    if (!type || !v) continue
    const dim = Math.round(value16(v, 'dimmer') * m)
    for (const c of type.channels) {
      const ch = f.address + c.offset - 1
      if (ch < 1 || ch > 512) continue
      let val = v[c.attr] ?? 0
      if (c.attr === 'dimmer') val = dim >> 8
      if (c.attr === 'dimmer_fine') val = dim & 255
      frame[ch - 1] = val
    }
  }
  return frame
}

/** Enttec DMX USB Pro 전송 메시지: 7E 06 길이L 길이H [00 + 512채널] E7 */
export function enttecPacket(frame: Uint8Array): Uint8Array {
  const len = frame.length + 1
  const p = new Uint8Array(len + 5)
  p.set([0x7e, 0x06, len & 255, len >> 8, 0x00])
  p.set(frame, 5)
  p[p.length - 1] = 0xe7
  return p
}
