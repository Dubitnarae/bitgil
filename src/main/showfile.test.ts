import { describe, expect, it } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Show } from '../core/engine/types'
import { BACKUP_DIR, listBackups, loadShowFile, parseShow, restoreBackup, saveShowFile, SHOW_FILE } from './showfile'

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

describe('백업 되돌리기', () => {
  it('목록은 최근 것 먼저, 되돌리면 그 쇼가 되고 지금 쇼는 백업으로 남는다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bitgil-'))
    const show = (name: string, n: number) => ({ name, fixture_types: [], fixtures: [], scenes: Array(n).fill({}), cuelist: [], venue: {} }) as unknown as Show
    saveShowFile(dir, show('가', 1), new Date(2026, 10, 1, 9, 0, 0))
    saveShowFile(dir, show('나', 2), new Date(2026, 10, 2, 9, 0, 0))
    saveShowFile(dir, show('다', 3), new Date(2026, 10, 3, 9, 0, 0))
    writeFileSync(join(dir, BACKUP_DIR, 'show-20261101-000000000.bitgil.json'), '깨짐')
    const list = listBackups(dir)
    expect(list.map((b) => [b.when, b.scenes])).toEqual([['2026-11-03 09:00:00', 2], ['2026-11-02 09:00:00', 1], ['2026-11-01 00:00:00', -1]])
    expect(restoreBackup(dir, list[1].name, new Date(2026, 10, 4, 9, 0, 0)).name).toBe('가')
    expect(loadShowFile(dir, starter).name).toBe('가')
    expect(listBackups(dir)[0].scenes).toBe(3) // 되돌리기 직전 쇼(다)
    expect(() => restoreBackup(dir, '../show.bitgil.json')).toThrow()
    expect(() => restoreBackup(dir, list[2].name)).toThrow()
  })
})
