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
  output: { name: string; connected: boolean }
  frame: number[]
}

declare global {
  interface Window {
    bitgil: {
      getShow(): Promise<import('../../core/engine/types').Show>
      getState(): Promise<State>
      send(cmd: Command): void
      onState(cb: (s: State) => void): () => void
    }
  }
}

export const send = (c: Command) => window.bitgil.send(c)
