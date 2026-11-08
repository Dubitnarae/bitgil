import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Show } from '../core/engine/types'
import type { Command } from './commands'

/** 10분 동안 조작이 없으면 운영 모드로 돌아간다 */
export const EDIT_TIMEOUT_MS = 10 * 60 * 1000

export const isPin = (pin: string) => /^\d{4}$/.test(pin)

/** PIN은 '소금:해시'로만 저장한다(설정 파일에 숫자 그대로 남지 않게) */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(pin, salt, 32).toString('hex')
}

export function checkPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  return timingSafeEqual(scryptSync(pin, salt, 32), Buffer.from(hash, 'hex'))
}

/** 편집 모드 타이머: 마지막 조작 뒤 10분이 지나면 저절로 닫힌다 */
export class EditMode {
  private until = 0
  isOpen = (now: number) => now < this.until
  open = (now: number) => { this.until = now + EDIT_TIMEOUT_MS }
  close = () => { this.until = 0 }
  /** 편집 모드 중 조작이 있으면 10분을 다시 센다 */
  touch(now: number) { if (this.isOpen(now)) this.open(now) }
}

/** 운영 모드에서도 되는 명령인지. 정식 씬 저장·덮어쓰기·이름·삭제, 순서 목록 고치기, 설정은 편집 모드에서만. */
export function allowedInOperation(c: Command, show: Show): boolean {
  const isTemp = (id: string) => !!show.scenes.find((s) => s.id === id)?.temp
  switch (c.t) {
    case 'saveScene': return c.id ? isTemp(c.id) : !!c.temp
    case 'renameScene':
    case 'deleteScene': return isTemp(c.id)
    case 'setCuelist':
    case 'faderMode':
    case 'dmxPort':
    case 'outputOnStart':
    case 'remote': return false
    default: return true
  }
}
