import { describe, expect, it } from 'vitest'
import { readyChecks } from './ready'

const st = (o: any = {}) => ({
  blackout: false, master: 1, saveError: '', pinEnabled: true, pinSet: true, editMode: false,
  remote: { on: false, code: '123456', urls: [], error: '', clients: 0 }, ...o,
  output: { enabled: true, connected: true, port: 'COM5', error: '', ...o.output }
}) as any
const show = (o: any = {}) => ({ scenes: [{ id: 'a', name: '설교' }], cuelist: [], default_scene: 'a', ...o }) as any
const levels = (s: any, sh: any) => readyChecks(s, sh).map((c) => c.level)

describe('예배 준비 점검', () => {
  it('모두 정상이면 ok, 원격 꺼짐은 info', () => {
    expect(levels(st(), show())).toEqual(['ok', 'ok', 'ok', 'ok', 'info'])
  })
  it('문제마다 경고', () => {
    expect(levels(st({ output: { enabled: false } }), show())[0]).toBe('warn')
    expect(levels(st({ output: { connected: false } }), show())[0]).toBe('bad')
    expect(levels(st({ blackout: true }), show())[0]).toBe('warn')
    expect(levels(st({ saveError: 'x' }), show())[1]).toBe('bad')
    expect(levels(st(), show({ default_scene: undefined }))[2]).toBe('warn')
    expect(levels(st(), show({ default_scene: '지운씬' }))[2]).toBe('warn')
    expect(levels(st({ pinEnabled: false }), show())[3]).toBe('warn')
    expect(levels(st({ editMode: true }), show())[3]).toBe('warn')
    expect(levels(st({ remote: { on: true, error: '포트 사용 중', urls: [] } }), show())[4]).toBe('bad')
  })
})
