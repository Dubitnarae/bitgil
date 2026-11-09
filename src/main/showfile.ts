import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Show } from '../core/engine/types'

/** 사용자 쇼 파일과 백업 폴더(문서\빛길 안) */
export const SHOW_FILE = 'show.bitgil.json'
export const BACKUP_DIR = '백업'
export const KEEP_BACKUPS = 10

/**
 * 사용자 쇼 파일을 읽는다. 아직 없으면 시작 데이터를 쓴다(저장은 처음 바뀔 때).
 * 파일이 깨져 있으면 최근 백업부터 차례로 시도한다(예배 직전에 프로그램이 안 켜지는 일이 없게).
 */
export function loadShowFile(dir: string, starterPath: string): Show {
  const file = join(dir, SHOW_FILE)
  if (!existsSync(file)) return JSON.parse(readFileSync(starterPath, 'utf-8'))
  const bdir = join(dir, BACKUP_DIR)
  const backups = existsSync(bdir) ? readdirSync(bdir).filter((n) => n.endsWith('.bitgil.json')).sort().reverse().map((n) => join(bdir, n)) : []
  for (const f of [file, ...backups]) {
    try { return JSON.parse(readFileSync(f, 'utf-8')) } catch (err) { console.error('쇼 파일을 읽지 못함:', f, err) }
  }
  return JSON.parse(readFileSync(starterPath, 'utf-8'))
}

/**
 * 저장: 지금 파일을 백업 폴더에 복사(최근 10개만 남김)한 뒤,
 * 임시 파일에 쓰고 바꿔치기한다(저장 중 꺼져도 파일이 깨지지 않게).
 */
export function saveShowFile(dir: string, show: Show, now = new Date()) {
  const file = join(dir, SHOW_FILE)
  const bdir = join(dir, BACKUP_DIR)
  mkdirSync(bdir, { recursive: true })
  if (existsSync(file)) {
    copyFileSync(file, join(bdir, `show-${stamp(now)}.bitgil.json`))
    const old = readdirSync(bdir).filter((n) => /^show-\d{8}-\d{9}\.bitgil\.json$/.test(n)).sort()
    for (const n of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) unlinkSync(join(bdir, n))
  }
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(show, null, 2), 'utf-8')
  renameSync(tmp, file)
}

/** 20261108-204450123 (이름순 = 시간순) */
function stamp(d: Date) {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}`
}

/** 가져올 쇼 파일 검사: 빛길 쇼 형식이 아니면 이유를 던진다(USB로 옮긴 파일이 깨졌거나 다른 파일일 때) */
export function parseShow(text: string): Show {
  const s = JSON.parse(text)
  for (const k of ['fixture_types', 'fixtures', 'scenes', 'cuelist'] as const) {
    if (!Array.isArray(s?.[k])) throw new Error(`빛길 쇼 파일이 아닙니다 (${k} 없음)`)
  }
  if (!s.venue || typeof s.venue !== 'object') throw new Error('빛길 쇼 파일이 아닙니다 (venue 없음)')
  return s
}
