import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * 오류를 파일 끝에 한 줄씩 붙이는 함수를 만든다.
 * 같은 오류가 1분 안에 되풀이되면 건너뛴다(출력 루프는 초당 40번 돌아서 파일이 금방 커지므로).
 * shortcut: 파일 크기 제한 없음(1분에 오류 종류당 한 번), 로그가 수 MB로 커지면 오래된 줄 지우기 추가
 */
export function makeErrorLog(file: string) {
  let lastText = ''
  let lastAt = 0
  return (what: string, err: unknown, now = Date.now()) => {
    const text = `${what}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`
    if (text === lastText && now - lastAt < 60_000) return
    lastText = text
    lastAt = now
    console.error(text)
    try {
      mkdirSync(dirname(file), { recursive: true })
      appendFileSync(file, `${new Date(now).toISOString()} ${text}\n`, 'utf-8')
    } catch { /* 로그를 못 써도 조명 출력은 계속 */ }
  }
}
