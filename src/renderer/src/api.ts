import type { Values } from '../../core/engine/types'
import type { Command } from '../../main/commands'
import type { FaderMode } from '../../core/engine/engine'

export interface State {
  live: Values
  preview: Values
  previewOut: Values
  faders: Record<string, number>
  previewFaders: Record<string, number>
  faderMode: FaderMode
  pending: boolean
  master: number
  blackout: boolean
  fading: boolean
  output: {
    enabled: boolean // 출력 켜짐(false = 출력 대기)
    connected: boolean
    port: string // 지금 연결된 포트
    error: string
    preferred: string // 설정한 포트, 빈 값 = 자동
    onStart: boolean
  }
  frame: number[]
  saveError: string
}

declare global {
  interface Window {
    bitgil: {
      getShow(): Promise<import('../../core/engine/types').Show>
      getState(): Promise<State>
      listPorts(): Promise<{ path: string; manufacturer?: string }[]>
      send(cmd: Command): void
      onState(cb: (s: State) => void): () => void
      onShow(cb: (s: import('../../core/engine/types').Show) => void): () => void
    }
  }
}

export const send = (c: Command) => window.bitgil.send(c)
