import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { makeLastState, MAX_AGE_MS } from './laststate'

it('이어가기 기록: 쓰고 읽고, 오래됐거나 깨졌으면 없음, 지우면 없음', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'bitgil-')), 'sub', 'last-state.json')
  const ls = makeLastState(file)
  expect(ls.load()).toBeNull()
  ls.save({ a: 1 }, 1000)
  expect(ls.load(2000)).toEqual({ at: 1000, state: { a: 1 } })
  ls.save({ a: 1 }, 5000) // 같은 내용은 다시 안 씀(시각도 그대로)
  expect(ls.load(6000)?.at).toBe(1000)
  ls.save({ a: 1 }, 1000 + 600_000) // 같아도 10분 지나면 시각만 새로
  expect(ls.load(1000 + 600_000)?.at).toBe(1000 + 600_000)
  expect(ls.load(1000 + 600_000 + MAX_AGE_MS + 1)).toBeNull()
  ls.clear()
  expect(existsSync(file)).toBe(false)
  writeFileSync(file, '{깨짐')
  expect(ls.load()).toBeNull()
})
