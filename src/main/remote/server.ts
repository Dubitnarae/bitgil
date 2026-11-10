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
  edit: boolean // 편집 모드 열림(폰 설정 모드를 쓸 수 있음)
  setup?: PhoneSetup // 편집 모드일 때만
}

/** 폰 설정 모드에 보낼 조명 정보(편집 모드일 때만) */
export interface PhoneSetup {
  find: string | null
  chTest: { ch: number; value: number } | null
  fixtures: { id: string; type: string; address: number; count: number; verified: boolean; batten: string; direction: string; position: { x: number; y: number; z: number }; aim: { x: number; y: number; z: number } | null; clash: string[] }[]
}

/** 폰에서 오는 명령 3가지 */
export type PhoneCmd = { c: 'next' } | { c: 'default' } | { c: 'blackout'; on: boolean }

export const REMOTE_PORT = 8130

/** 코드를 5번 틀리면 1분 동안 맞는 코드도 받지 않는다(같은 Wi-Fi 누군가가 코드를 하나씩 맞춰 보는 것 막기) */
export class Lockout {
  private fails = 0
  private until = 0
  locked(now: number): boolean { return now < this.until }
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
  /** 폰 설정 모드: PIN 이 맞으면 편집 모드를 연다 */
  unlock: (pin: string) => boolean
  /** 폰 설정 모드 명령(JSON). 오류 문구를 돌려준다(빈 값 = 됨) */
  setup: (cmd: unknown) => string
  onError: (msg: string) => void
}) {
  const lock = new Lockout()
  // PIN도 5번 틀리면 1분 잠김. 접속 IP별로 센다(한 폰이 틀려도 다른 폰은 안 잠김)
  // shortcut: IP 목록을 지우지 않는다(같은 Wi-Fi 기기 수만큼만 생김), 인터넷에 열게 되면 정리 필요
  const pinLocks = new Map<string, Lockout>()
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
    if (req.method === 'POST' && url.pathname === '/unlock') {
      const ip = req.socket.remoteAddress ?? ''
      const l = pinLocks.get(ip) ?? new Lockout()
      pinLocks.set(ip, l)
      const now = Date.now()
      // 잠긴 동안에는 PIN 검사 자체를 하지 않는다(검사하면 맞는 PIN일 때 403을 주면서도 편집 모드가 열려 버림)
      res.writeHead(!l.locked(now) && l.check(opts.unlock(url.searchParams.get('pin') ?? ''), now) ? 204 : 403)
      return res.end()
    }
    if (req.method === 'POST' && url.pathname === '/setup') {
      let body = ''
      req.on('data', (d) => { body += d; if (body.length > 10_000) req.destroy() })
      req.on('end', () => {
        let err: string
        try { err = opts.setup(JSON.parse(body)) } catch { err = '명령 형식이 이상합니다' }
        res.writeHead(err ? 400 : 204, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end(err)
      })
      return
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
