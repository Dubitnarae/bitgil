import { request } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Lockout, REMOTE_PORT, startRemote, type PhoneCmd } from './server'

describe('폰 원격', () => {
  it('코드를 5번 틀리면 1분 동안 맞는 코드도 거절', () => {
    const l = new Lockout()
    for (let i = 0; i < 4; i++) expect(l.check(false, 0)).toBe(false)
    expect(l.check(true, 0)).toBe(true) // 4번까지는 괜찮고, 맞으면 다시 0부터
    for (let i = 0; i < 5; i++) l.check(false, 0)
    expect(l.check(true, 59_000)).toBe(false)
    expect(l.check(true, 60_000)).toBe(true)
  })

  it('코드가 맞을 때만 명령을 받고, 상태를 보낸다', async () => {
    const got: PhoneCmd[] = []
    const r = startRemote({
      code: () => '123456',
      state: () => ({ scene: '찬양', cue: 0, total: 2, next: '말씀', blackout: false, master: 1, fading: false, output: false, edit: false }),
      run: (c) => got.push(c),
      unlock: (pin) => pin === '1234',
      setup: (c) => ((c as { t: string }).t === 'find' ? '' : '안 되는 명령'),
      appDir: '.', api: () => null,
      onError: (m) => { throw new Error(m) }
    })
    try {
      const base = `http://127.0.0.1:${REMOTE_PORT}`
      expect((await fetch(base + '/')).status).toBe(200)
      expect((await fetch(base + '/cmd?code=000000&c=next', { method: 'POST' })).status).toBe(401)
      expect((await fetch(base + '/cmd?code=123456&c=next', { method: 'POST' })).status).toBe(204)
      expect((await fetch(base + '/cmd?code=123456&c=blackout&on=1', { method: 'POST' })).status).toBe(204)
      expect((await fetch(base + '/cmd?code=123456&c=이상한', { method: 'POST' })).status).toBe(400)
      expect(got).toEqual([{ c: 'next' }, { c: 'blackout', on: true }])
      // 폰 설정 모드: PIN, 명령 JSON(오류 문구는 그대로 돌려줌)
      expect((await fetch(base + '/unlock?code=123456&pin=0000', { method: 'POST' })).status).toBe(403)
      expect((await fetch(base + '/unlock?code=123456&pin=1234', { method: 'POST' })).status).toBe(204)
      expect((await fetch(base + '/setup?code=123456', { method: 'POST', body: '{"t":"find","id":"1-1"}' })).status).toBe(204)
      const bad = await fetch(base + '/setup?code=123456', { method: 'POST', body: '{"t":"editVenue"}' })
      expect([bad.status, await bad.text()]).toEqual([400, '안 되는 명령'])
      expect((await fetch(base + '/setup?code=123456', { method: 'POST', body: '{깨짐' })).status).toBe(400)
      const ev = await fetch(base + '/events?code=123456')
      const first = await ev.body!.getReader().read()
      expect(new TextDecoder().decode(first.value)).toContain('"scene":"찬양"')
    } finally {
      r.close()
    }
  })

  it('PIN 잠금 중에는 PIN 검사 없이 403, 실패 횟수는 접속 IP별', async () => {
    let asked = 0
    const r = startRemote({
      code: () => '123456',
      state: () => ({ scene: '', cue: -1, total: 0, next: '', blackout: false, master: 1, fading: false, output: false, edit: false }),
      run: () => {},
      unlock: (pin) => { asked++; return pin === '1234' },
      setup: () => '',
      appDir: '.', api: () => null,
      onError: (m) => { throw new Error(m) }
    })
    // 보내는 쪽 주소를 정해서 다른 폰인 척한다(127.x.x.x 는 모두 이 컴퓨터)
    const unlock = (from: string, pin: string) => new Promise<number>((ok, fail) =>
      request({ host: '127.0.0.1', port: REMOTE_PORT, localAddress: from, method: 'POST', path: `/unlock?code=123456&pin=${pin}`, agent: false },
        (res) => { res.resume(); ok(res.statusCode!) }).on('error', fail).end())
    try {
      for (let i = 0; i < 5; i++) expect(await unlock('127.0.0.1', '0000')).toBe(403)
      expect(await unlock('127.0.0.1', '1234')).toBe(403) // 잠김: 맞는 PIN도 거절
      expect(asked).toBe(5) // 잠긴 뒤에는 PIN 검사를 부르지도 않음
      expect(await unlock('127.0.0.2', '1234')).toBe(204) // 다른 폰은 잠기지 않음
    } finally {
      r.close()
    }
  })

  it('원격 전체 화면: 화면 파일·연결 스크립트·기능 호출(코드 필요)·PIN 잠금', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bitgil-app-'))
    writeFileSync(join(dir, 'index.html'), '<html><head><title>빛길</title></head></html>')
    const calls: unknown[] = []
    const r = startRemote({
      code: () => '123456',
      state: () => ({ scene: '', cue: -1, total: 0, next: '', blackout: false, master: 1, fading: false, output: false, edit: false }),
      run: () => {}, unlock: () => false, setup: () => '',
      appDir: dir,
      api: (name, args) => { calls.push([name, ...args]); return name === 'unlock' ? args[0] === '1234' : { ok: name } },
      onError: (m) => { throw new Error(m) }
    })
    const base = `http://127.0.0.1:${REMOTE_PORT}`
    const post = (path: string, args: unknown[]) => fetch(base + path, { method: 'POST', body: JSON.stringify(args) })
    try {
      const html = await (await fetch(base + '/app/')).text()
      expect(html).toContain('<head><script src="./bridge.js"></script>')
      expect(await (await fetch(base + '/app/bridge.js')).text()).toContain('window.bitgil=b')
      expect((await fetch(base + '/app/..%2f..%2fpackage.json')).status).toBe(404) // 폴더 밖 파일 막음
      expect((await post('/api/getShow?code=000000', [])).status).toBe(401)
      expect(await (await post('/api/send?code=123456', [{ t: 'blackout', on: true }])).json()).toEqual({ ok: 'send' })
      expect(calls).toEqual([['send', { t: 'blackout', on: true }]])
      expect((await post('/api/send?code=123456', {} as never)).status).toBe(400) // 인자는 배열만
      for (let i = 0; i < 5; i++) expect(await (await post('/api/unlock?code=123456', ['0000'])).json()).toBe(false)
      expect(await (await post('/api/unlock?code=123456', ['1234'])).json()).toBe(false) // PIN 5번 틀려 잠김
      const ev = await fetch(base + '/app-events?code=123456')
      const rd = ev.body!.getReader()
      await rd.read()
      r.push('show', '{"a":1}')
      expect(new TextDecoder().decode((await rd.read()).value)).toBe('event: show\ndata: {"a":1}\n\n')
    } finally {
      r.close()
      rmSync(dir, { recursive: true })
    }
  })
})
