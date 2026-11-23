import { describe, expect, it } from 'vitest'
import { keepLabels } from './declutter'

describe('이름표 겹침', () => {
  it('겹치면 우선순위 높은 것만, 안 겹치면 모두', () => {
    const b = (x: number, pri: number) => ({ x, y: 0, w: 20, h: 10, pri })
    expect(keepLabels([b(0, 1), b(10, 5), b(100, 0)])).toEqual([false, true, true])
    expect(keepLabels([b(0, 1), b(30, 0)])).toEqual([true, true])
  })
  it('숨긴 이름표 자리는 다른 것을 막지 않는다', () => {
    const b = (x: number, pri: number) => ({ x, y: 0, w: 20, h: 10, pri })
    // 가운데(15)는 왼쪽(0)에 밀려 숨고, 오른쪽(30)은 왼쪽과 안 겹치므로 보인다
    expect(keepLabels([b(0, 3), b(15, 2), b(30, 1)])).toEqual([true, false, true])
  })
})
