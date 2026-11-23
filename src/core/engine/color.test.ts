import { describe, expect, it } from 'vitest'
import { cleanColors, hexToRgbw, paletteWith, rgbwToHex, sameColor } from './color'

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

describe('내 색', () => {
  it('같은 이름은 기본 색 값을 바꾸고, 새 이름은 뒤에', () => {
    const p = paletteWith([{ name: '호박색', rgbw: [255, 100, 0, 30] }, { name: '내 보라', rgbw: [90, 0, 200, 0] }])
    expect(p.find((c) => c.name === '호박색')).toEqual({ name: '호박색', rgbw: [255, 100, 0, 30], mine: true })
    expect(p.at(-1)).toEqual({ name: '내 보라', rgbw: [90, 0, 200, 0], mine: true })
    expect(p.find((c) => c.name === '빨강')?.mine).toBe(false)
  })
  it('지금 색 찾기: W 없는 조명은 W를 더한 값', () => {
    expect(sameColor([255, 120, 20, 200], [255, 120, 20, 200], true)).toBe(true)
    expect(sameColor([255, 120, 20, 200], [255, 255, 220], false)).toBe(true)
    expect(sameColor([255, 0, 0, 0], [255, 1, 0, 0], true)).toBe(false)
  })
  it('저장 전 정리: 빈 이름 빼기·값 자르기·같은 이름은 나중 것', () => {
    expect(cleanColors([{ name: ' ', rgbw: [1, 2, 3, 4] }, { name: ' a ', rgbw: [300, -5, 1.6, 'x'] }, { name: 'a', rgbw: [1, 1, 1, 1] }]))
      .toEqual([{ name: 'a', rgbw: [1, 1, 1, 1] }])
    expect(() => cleanColors('x')).toThrow()
  })
})
