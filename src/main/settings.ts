import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FaderMode } from '../core/engine/engine'

export interface Settings {
  faderMode: FaderMode
}

const DEFAULTS: Settings = { faderMode: 'live' }
const dir = () => join(app.getPath('appData'), '빛길')
const file = () => join(dir(), 'settings.json')

export function loadSettings(): Settings {
  try {
    if (existsSync(file())) return { ...DEFAULTS, ...JSON.parse(readFileSync(file(), 'utf-8')) }
  } catch (err) {
    console.error('설정 파일을 읽지 못해 기본값을 씁니다', err)
  }
  return { ...DEFAULTS }
}

/** 임시 파일에 쓴 뒤 바꿔치기(저장 중 꺼져도 파일이 깨지지 않게) */
export function saveSettings(s: Settings) {
  mkdirSync(dir(), { recursive: true })
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf-8')
  renameSync(tmp, file())
}
