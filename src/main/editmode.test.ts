import { describe, expect, it } from 'vitest'
import type { Show } from '../core/engine/types'
import { allowedInOperation, canSetPinEnabled, canUnlock, checkPin, EDIT_TIMEOUT_MS, EditMode, hashPin, isPin } from './editmode'

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

  it("'PIN 사용'이 꺼져 있으면 PIN 없이 열리고, 켜져 있으면 맞는 PIN만", () => {
    const pinHash = hashPin('1234')
    expect(canUnlock('', { pinEnabled: false, pinHash })).toBe(true)
    expect(canUnlock('', { pinEnabled: false, pinHash: '' })).toBe(true)
    expect(canUnlock('', { pinEnabled: true, pinHash })).toBe(false)
    expect(canUnlock('0000', { pinEnabled: true, pinHash })).toBe(false)
    expect(canUnlock('1234', { pinEnabled: true, pinHash })).toBe(true)
    expect(canUnlock('1234', { pinEnabled: true, pinHash: '' })).toBe(false) // PIN을 아직 안 정함
  })

  it("'PIN 사용' 끄기는 현재 PIN이 맞아야 하고, 켜기는 확인 없이(PIN이 있어야)", () => {
    const pinHash = hashPin('1234')
    expect(canSetPinEnabled(false, '', pinHash)).toBe(false)
    expect(canSetPinEnabled(false, '0000', pinHash)).toBe(false)
    expect(canSetPinEnabled(false, '1234', pinHash)).toBe(true)
    expect(canSetPinEnabled(true, '', pinHash)).toBe(true)
    expect(canSetPinEnabled(true, '', '')).toBe(false) // PIN이 없으면 먼저 새 PIN 정하기
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
    expect(allowedInOperation({ t: 'autoUpdate', on: false }, show)).toBe(false)
    expect(allowedInOperation({ t: 'pinEnabled', on: false }, show)).toBe(false)
    expect(allowedInOperation({ t: 'pinEnabled', on: true }, show)).toBe(false)
    expect(allowedInOperation({ t: 'updateChoice', choice: 'skip' }, show)).toBe(true)
    expect(allowedInOperation({ t: 'setCuelist', list: [] }, show)).toBe(false)
    expect(allowedInOperation({ t: 'editVenue', venue: {} as never }, show)).toBe(false)
    expect(allowedInOperation({ t: 'editFixtureType', id: 'wash', edit: {} }, show)).toBe(false)
    expect(allowedInOperation({ t: 'cue', index: 0 }, show)).toBe(true)
    expect(allowedInOperation({ t: 'blackout', on: true }, show)).toBe(true)
    expect(allowedInOperation({ t: 'quality', set: 'low' }, show)).toBe(true) // 화면 품질은 PIN 없이
    expect(allowedInOperation({ t: 'output', on: true }, show)).toBe(true)
  })
})
