import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { makeErrorLog } from './errorlog'

it('오류 로그: 파일에 남기고, 같은 오류는 1분에 한 번만', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'bitgil-')), 'sub', 'error.log') // 폴더가 없어도 만든다
  const log = makeErrorLog(file)
  const err = new Error('깨짐')
  log('출력 루프', err, 0)
  log('출력 루프', err, 25) // 되풀이 → 건너뜀
  log('출력 루프', '다른 오류', 50)
  log('출력 루프', err, 100_000)
  const lines = readFileSync(file, 'utf-8').split('\n').filter((l) => /^\d{4}-/.test(l))
  expect(lines).toHaveLength(3)
  expect(lines[0]).toContain('출력 루프: Error: 깨짐')
})
