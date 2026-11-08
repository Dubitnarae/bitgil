import { createServer, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { timingSafeEqual } from 'node:crypto'
import { PAGE } from './page'

/** 폰에 보여줄 상태 */
export interface PhoneState {
  scene: string // 지금 나가는 씬 이름
  cue: number // 순서 목록 위치(-1 = 시작 전)
  total: number
  next: string // 다음 줄 씬 이름, 없으면 ''
  blackout: boolean
  master: number
  fading: boolean
  output: boolean // 실제 장비로 나가는 중
}

/** 폰에서 오는 명령 3가지 */
export type PhoneCmd = { c: 'next' } | { c: 'default' } | { c: 'blackout'; on: boolean }

export const REMOTE_PORT = 8130

/** 코드를 5번 틀리면 1분 동안 맞는 코드도 받지 않는다(같은 Wi-Fi 누군가가 코드를 하나씩 맞춰 보는 것 막기) */
export class Lockout {
  private fails = 0
  private until = 0
  check(ok: boolean, now: number): boolean {
    if (now < this.until) return false
    if (ok) { this.fails = 0; return true }
    if (++this.fails >= 5) { this.fails = 0; this.until = now + 60_000 }
    return false
  }
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/** 이 노트북의 같은 Wi-Fi 주소들(폰 주소창에 칠 것) */
export function lanUrls(): string[] {
  return Object.values(networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')) // 169.254 = 연결 안 된 자동 주소
    .map((n) => `http://${n!.address}:${REMOTE_PORT}`)
}

/**
 * 폰 원격 서버. 폰 화면(GET /), 상태 실시간 보내기(GET /events, SSE), 버튼 명령(POST /cmd).
 * 모든 요청은 ?code=원격 접속 코드 가 맞아야 한다(화면 HTML만 예외).
 */
export function startRemote(opts: {
  code: () => string
  state: () => PhoneState
  run: (c: PhoneCmd) => void
  onError: (msg: string) => void
}) {
  const lock = new Lockout()
  const clients = new Set<ServerResponse>()
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(PAGE)
    }
    if (!lock.check(same(url.searchParams.get('code') ?? '', opts.code()), Date.now())) {
      res.writeHead(401)
      return res.end()
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return res.write(`data: ${JSON.stringify(opts.state())}\n\n`)
    }
    if (req.method === 'POST' && url.pathname === '/cmd') {
      const c = url.searchParams.get('c')
      if (c === 'next' || c === 'default') opts.run({ c })
      else if (c === 'blackout') opts.run({ c, on: url.searchParams.get('on') === '1' })
      else { res.writeHead(400); return res.end() }
      res.writeHead(204)
      return res.end()
    }
    res.writeHead(404)
    res.end()
  })
  server.on('error', (err: NodeJS.ErrnoException) =>
    opts.onError(err.code === 'EADDRINUSE' ? `${REMOTE_PORT}번 포트를 다른 프로그램이 쓰고 있습니다` : String(err.message)))
  server.listen(REMOTE_PORT, '0.0.0.0')

  // 상태가 바뀌었을 때만 폰에 보낸다(초당 최대 4번). 15초마다 빈 줄을 보내 연결이 끊기지 않게.
  let last = ''
  let quiet = 0
  const timer = setInterval(() => {
    const json = JSON.stringify(opts.state())
    const msg = json !== last ? `data: ${json}\n\n` : ++quiet >= 60 ? ':\n\n' : ''
    if (msg) { quiet = 0; for (const r of clients) r.write(msg) }
    last = json
  }, 250)

  return {
    clients: () => clients.size,
    close() {
      clearInterval(timer)
      server.close()
      server.closeAllConnections()
    }
  }
}
