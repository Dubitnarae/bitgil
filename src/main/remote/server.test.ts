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
      state: () => ({ scene: '찬양', cue: 0, total: 2, next: '말씀', blackout: false, master: 1, fading: false, output: false }),
      run: (c) => got.push(c),
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
      const ev = await fetch(base + '/events?code=123456')
      const first = await ev.body!.getReader().read()
      expect(new TextDecoder().decode(first.value)).toContain('"scene":"찬양"')
    } finally {
      r.close()
    }
  })
})
