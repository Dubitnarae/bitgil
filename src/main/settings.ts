import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FaderMode } from '../core/engine/engine'

export interface Settings {
  faderMode: FaderMode
  /** DMX 인터페이스 포트(예: COM5). 빈 값이면 자동 찾기 */
  dmxPort: string
  /** 프로그램을 켜자마자 실제 장비로 출력할지(기본: 출력 대기) */
  outputOnStart: boolean
  /** 편집 모드 PIN 해시('소금:해시'). 빈 값 = 아직 안 정함 */
  pinHash: string
  /** 폰 원격 켜기(기본 끔: 켜면 같은 Wi-Fi에서 접속 가능) */
  remoteOn: boolean
  /** 폰 원격 접속 코드(6자리). 빈 값이면 처음 켤 때 만든다 */
  remoteCode: string
  /** 자동 업데이트(기본 켬): 하루 한 번 새 버전 확인 → 받아 두고 끌 때 설치 */
  autoUpdate: boolean
  /** 마지막으로 업데이트를 확인한 날('YYYY-MM-DD') */
  lastUpdateCheck: string
}

const DEFAULTS: Settings = { faderMode: 'live', dmxPort: '', outputOnStart: false, pinHash: '', remoteOn: false, remoteCode: '', autoUpdate: true, lastUpdateCheck: '' }
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
