import { describe, expect, it } from 'vitest'
import { smooth, soundFactor } from './sound'

describe('소리 반응 배율', () => {
  it('조용하면 최소 밝기, 크면 100%', () => {
    expect(soundFactor(0, 50, 0.4)).toBeCloseTo(0.4)
    expect(soundFactor(1, 50, 0.4)).toBe(1)
  })
  it('예민할수록 같은 소리에 더 밝다', () => {
    expect(soundFactor(0.01, 100, 0)).toBeGreaterThan(soundFactor(0.01, 0, 0))
  })
  it('최소 밝기·감도 범위를 벗어나도 0~1', () => {
    expect(soundFactor(0.5, 500, 2)).toBe(1)
    expect(soundFactor(0, -10, -1)).toBe(0)
  })
  it('밝아질 때가 어두워질 때보다 빠르다', () => {
    expect(smooth(0, 1) - 0).toBeGreaterThan(1 - smooth(1, 0))
  })
})
