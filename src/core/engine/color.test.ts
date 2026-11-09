import { describe, expect, it } from 'vitest'
import { hexToRgbw, rgbwToHex } from './color'

describe('색 변환', () => {
  it('공통 흰 부분은 W로 옮긴다', () => {
    expect(hexToRgbw('#ffffff')).toEqual([0, 0, 0, 255])
    expect(hexToRgbw('#ff8040')).toEqual([191, 64, 0, 64])
    expect(hexToRgbw('#0000ff')).toEqual([0, 0, 255, 0])
  })
  it('화면 표시는 W를 더해 되돌린다', () => {
    expect(rgbwToHex(hexToRgbw('#ff8040'))).toBe('#ff8040')
    expect(rgbwToHex([255, 120, 20, 200])).toBe('#ffffdc')
  })
})
