import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** 이만큼 지난 기록은 묻지 않는다(지난주 예배 상태로 이어가자고 묻지 않게) */
export const MAX_AGE_MS = 12 * 3600_000

/**
 * 갑자기 꺼졌을 때 이어가기 기록(%APPDATA%\빛길\last-state.json).
 * 켜져 있는 동안 몇 초마다 쓰고, 정상으로 끄면 지운다 → 다음에 켤 때 파일이 남아 있으면 갑자기 꺼졌던 것.
 */
export function makeLastState(file: string) {
  let last = ''
  let lastAt = 0
  let stopped = false // 지운 뒤(곧 꺼짐)에는 다시 쓰지 않는다
  return {
    /** 바뀌었을 때(같아도 10분마다 시각만 새로) 쓴다. 임시 파일에 쓰고 바꿔치기(쓰는 중에 꺼져도 깨지지 않게) */
    save(state: unknown, now = Date.now()) {
      const body = JSON.stringify(state)
      if (stopped || (body === last && now - lastAt < 600_000)) return
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file + '.tmp', JSON.stringify({ at: now, state }), 'utf-8')
      renameSync(file + '.tmp', file)
      last = body
      lastAt = now
    },
    /** 남아 있는 기록(너무 오래됐거나 깨졌으면 null) */
    load(now = Date.now()): { at: number; state: unknown } | null {
      try {
        if (!existsSync(file)) return null
        const j = JSON.parse(readFileSync(file, 'utf-8'))
        if (typeof j?.at !== 'number' || now - j.at > MAX_AGE_MS || now < j.at) return null
        return { at: j.at, state: j.state }
      } catch { return null }
    },
    clear() {
      stopped = true
      try { if (existsSync(file)) unlinkSync(file) } catch { /* 지우지 못해도 다음에 12시간 지나면 안 묻는다 */ }
    }
  }
}
