import { describe, expect, it } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Show } from '../core/engine/types'
import { BACKUP_DIR, loadShowFile, parseShow, saveShowFile, SHOW_FILE } from './showfile'

const starter = 'data/starter-show.bitgil.json'

describe('쇼 파일 저장', () => {
  it('파일이 없으면 시작 데이터를 읽고, 저장하면 그 파일을 읽는다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bitgil-'))
    const show = loadShowFile(dir, starter)
    expect(show.scenes.length).toBeGreaterThan(0)
    show.name = '바꾼 이름'
    saveShowFile(dir, show)
    expect(loadShowFile(dir, starter).name).toBe('바꾼 이름')
    expect(readdirSync(dir)).not.toContain(SHOW_FILE + '.tmp')
  })

  it('저장할 때마다 이전 파일을 백업하고 최근 10개만 남긴다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bitgil-'))
    const show = { name: '0' } as Show
    for (let i = 0; i <= 13; i++) {
      show.name = String(i)
      saveShowFile(dir, show, new Date(2026, 10, 8, 12, 0, i))
    }
    const backups = readdirSync(join(dir, BACKUP_DIR)).sort()
    expect(backups.length).toBe(10)
    // 마지막 백업 = 마지막 저장 직전 파일(12), 가장 오래된 남은 백업 = 3
    expect(JSON.parse(readFileSync(join(dir, BACKUP_DIR, backups[9]), 'utf-8')).name).toBe('12')
    expect(JSON.parse(readFileSync(join(dir, BACKUP_DIR, backups[0]), 'utf-8')).name).toBe('3')
  })
  it('쇼 파일이 깨졌으면 가장 최근 백업으로 연다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bitgil-'))
    const show = { name: 'A' } as Show
    saveShowFile(dir, show, new Date(2026, 10, 8, 12, 0, 0))
    show.name = 'B'
    saveShowFile(dir, show, new Date(2026, 10, 8, 12, 0, 1)) // 백업 = A
    writeFileSync(join(dir, SHOW_FILE), '{깨진 파일')
    expect(loadShowFile(dir, starter).name).toBe('A')
  })
})

describe('쇼 파일 가져오기 검사', () => {
  it('빛길 쇼는 통과, 다른 JSON·깨진 파일은 막는다', () => {
    const text = readFileSync(starter, 'utf-8')
    expect(parseShow(text).scenes.length).toBeGreaterThan(0)
    expect(() => parseShow('{"scenes":[]}')).toThrow('빛길 쇼 파일이 아닙니다')
    expect(() => parseShow('{깨짐')).toThrow()
  })
})
