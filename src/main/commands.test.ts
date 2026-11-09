import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { Engine } from '../core/engine/engine'
import { runCommand } from './commands'
import { allowedInOperation } from './editmode'

const show = JSON.parse(readFileSync('data/starter-show.bitgil.json', 'utf-8'))

describe('기본 조명 씬', () => {
  it('정하면 쇼에 저장되고 [기본 조명]이 그 씬을 켠다', () => {
    const e = new Engine(structuredClone(show))
    const id = e.show.scenes[2].id
    expect(runCommand(e, { t: 'defaultScene', id }, 0)).toBe('showChanged')
    expect(e.show.default_scene).toBe(id)
    e.blackout = true
    runCommand(e, { t: 'default' }, 0)
    expect(e.blackout).toBe(false)
    expect(e.currentFaders(10_000)[id]).toBe(1)
  })
  it('없는 씬은 거부, 운영 모드에서는 막힘', () => {
    const e = new Engine(structuredClone(show))
    expect(() => runCommand(e, { t: 'defaultScene', id: 'X' }, 0)).toThrow()
    expect(allowedInOperation({ t: 'defaultScene', id: 'P1-01' }, e.show)).toBe(false)
  })
})
