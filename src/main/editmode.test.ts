import { describe, expect, it } from 'vitest'
import type { Show } from '../core/engine/types'
import { allowedInOperation, checkPin, EDIT_TIMEOUT_MS, EditMode, hashPin, isPin } from './editmode'

describe('편집 모드 PIN', () => {
  it('맞는 PIN만 통과하고, 저장 값에 PIN 숫자가 그대로 없다', () => {
    const h = hashPin('1234')
    expect(h).not.toContain('1234')
    expect(checkPin('1234', h)).toBe(true)
    expect(checkPin('1235', h)).toBe(false)
    expect(checkPin('1234', '')).toBe(false)
    expect(isPin('0123')).toBe(true)
    expect(isPin('123')).toBe(false)
    expect(isPin('12a4')).toBe(false)
  })

  it('10분 동안 조작이 없으면 닫히고, 조작하면 다시 10분', () => {
    const m = new EditMode()
    expect(m.isOpen(0)).toBe(false)
    m.open(0)
    m.touch(EDIT_TIMEOUT_MS - 1)
    expect(m.isOpen(EDIT_TIMEOUT_MS + 1000)).toBe(true)
    expect(m.isOpen(2 * EDIT_TIMEOUT_MS)).toBe(false)
    m.touch(2 * EDIT_TIMEOUT_MS) // 닫힌 뒤 조작은 다시 열지 않는다
    expect(m.isOpen(2 * EDIT_TIMEOUT_MS + 1)).toBe(false)
  })

  it('운영 모드에서는 임시 씬만 저장·고치기, 설정은 막음', () => {
    const show = { scenes: [{ id: 'P1-01', name: 'a' }, { id: 'T-01', name: 'b', temp: true }] } as unknown as Show
    expect(allowedInOperation({ t: 'saveScene', name: 'x', temp: true }, show)).toBe(true)
    expect(allowedInOperation({ t: 'saveScene', name: 'x' }, show)).toBe(false)
    expect(allowedInOperation({ t: 'saveScene', name: 'a', id: 'P1-01' }, show)).toBe(false)
    expect(allowedInOperation({ t: 'saveScene', name: 'b', id: 'T-01' }, show)).toBe(true)
    expect(allowedInOperation({ t: 'deleteScene', id: 'P1-01' }, show)).toBe(false)
    expect(allowedInOperation({ t: 'renameScene', id: 'T-01', name: 'c' }, show)).toBe(true)
    expect(allowedInOperation({ t: 'faderMode', mode: 'preview' }, show)).toBe(false)
    expect(allowedInOperation({ t: 'blackout', on: true }, show)).toBe(true)
    expect(allowedInOperation({ t: 'output', on: true }, show)).toBe(true)
  })
})
