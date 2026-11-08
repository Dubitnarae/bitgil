import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import type { Show } from '../core/engine/types'
import { mergeScenes, scenesToXhd, xhdToScenes } from './xhd'

const starter = (): Show => JSON.parse(readFileSync('data/starter-show.bitgil.json', 'utf-8'))
const REAL = '기존 저장파일/261108 기존백업.XHD' // 공개 저장소라 커밋 안 됨 → 있을 때만 시험

/** 콘솔 조명 1번(주소 1, 3채널)만 있고 P1-01 리플레이 하나가 기록된 작은 가짜 백업 */
function fake() {
  const b = Buffer.alloc(0x595c00 + 0x1800)
  b.write('H3_1024S_SHOW_SH', 0, 'latin1')
  b.writeUInt16LE(1, 0x40)
  b[0x130] = 1
  b[0x12400 + 0x0c] = 3
  for (let ch = 1; ch <= 3; ch++) b.writeUInt16LE(10 + ch, 0xac0 + 2 * (ch - 1))
  b[0x21c00] = 1
  const r = 0x595c00
  b[r + 0x2ad + 1] = 7
  b[r + 0x325 + 11] = 1; b[r + 0xba5 + 11] = 200 // 채널 1 = 200
  return b
}
const tiny = (): Show => ({
  name: 't', venue: {} as Show['venue'], groups: [], cuelist: [], scenes: [],
  fixture_types: [{ id: 'x', label: '', kind: 'par', channel_count: 3, beam_deg: [20, 20], mount: 'ceiling',
    channels: ['dimmer', 'red', 'green'].map((attr, i) => ({ offset: i + 1, attr, label: attr, mix: 'LTP' as const, fade: true })) }],
  fixtures: [{ id: '1-1', address: 1, universe: 1, type: 'x', position: { x: 0, y: 0, z: 0 }, mount: 'ceiling', direction: 'down', aim: null, verified: true }]
})

describe('콘솔 백업(.XHD)', () => {
  it('리플레이를 씬으로 읽고, 고친 씬을 다시 써 넣으면 그대로 읽힌다', () => {
    const show = tiny()
    const sc = xhdToScenes(fake(), show)
    expect(sc).toEqual([{ id: 'P1-01', name: 'P1-01', fade_seconds: 2, values: { '1-1': { dimmer: 200 } } }])
    expect(mergeScenes(show, sc)).toEqual({ replaced: 0, added: 1 })
    show.scenes[0].values = { '1-1': { red: 9, green: 300 } }
    show.scenes.push({ id: 'U-01', name: '찬양', fade_seconds: 2, values: {} })
    const out = scenesToXhd(fake(), show)
    expect(out.written).toEqual(['P1-01'])
    expect(out.skipped).toEqual(['찬양(U-01)'])
    expect(xhdToScenes(out.buf, show)[0].values).toEqual({ '1-1': { red: 9, green: 255 } })
    expect(mergeScenes(show, xhdToScenes(out.buf, show))).toEqual({ replaced: 1, added: 0 })
  })

  it('XHD가 아니면 거절한다', () => {
    expect(() => xhdToScenes(Buffer.alloc(100), tiny())).toThrow('XHD')
  })

  it.skipIf(!existsSync(REAL))('실제 백업: 시작 데이터 씬과 같고, 안 고치고 내보내면 원본과 같다', () => {
    const buf = readFileSync(REAL)
    const show = starter()
    const sc = xhdToScenes(buf, show)
    for (const s of show.scenes) expect(sc.find((x) => x.id === s.id)?.values, s.id).toEqual(s.values)
    const out = scenesToXhd(buf, show)
    expect(out.written.length).toBe(show.scenes.length)
    expect(out.unpatched).toBe(0)
    expect(Buffer.compare(out.buf, buf)).toBe(0)
  })
})
