import { describe, expect, it } from 'vitest'
import { autoQuality, resolveQuality } from './quality'

describe('화면 품질', () => {
  it('자동: 코어·메모리로 고른다', () => {
    expect(autoQuality(4, 16)).toBe('low')
    expect(autoQuality(8, 7.8)).toBe('normal')
    expect(autoQuality(6, 7.8)).toBe('normal')
    expect(autoQuality(2, 4)).toBe('low')
    expect(autoQuality(6, 16)).toBe('normal')
    expect(autoQuality(8, 15.8)).toBe('high')
    expect(autoQuality(16, 32)).toBe('high')
  })
  it('직접 고르면 그대로', () => {
    expect(resolveQuality('low', 16, 32)).toBe('low')
    expect(resolveQuality('auto', 16, 32)).toBe('high')
  })
})
