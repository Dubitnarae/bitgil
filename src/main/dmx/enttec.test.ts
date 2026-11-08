import { describe, expect, it } from 'vitest'
import { pickPort } from './enttec'

const ports = [
  { path: 'COM1', manufacturer: '(표준 포트 유형)' },
  { path: 'COM5', manufacturer: 'FTDI', vendorId: '0403' },
  { path: 'COM7', manufacturer: 'Microsoft', vendorId: '0403' }
]

describe('pickPort', () => {
  it('설정이 비면 FTDI 포트를 자동으로 고른다', () => expect(pickPort(ports, '')).toBe('COM5'))
  it('제조사 이름이 없어도 FTDI 장치 번호(0403)로 찾는다', () => expect(pickPort(ports.slice(2), '')).toBe('COM7'))
  it('설정한 포트를 우선한다', () => expect(pickPort(ports, 'COM7')).toBe('COM7'))
  it('설정한 포트가 없으면 다른 포트로 바꾸지 않는다', () => expect(pickPort(ports, 'COM9')).toBeUndefined())
  it('후보가 없으면 없음', () => expect(pickPort(ports.slice(0, 1), '')).toBeUndefined())
})
