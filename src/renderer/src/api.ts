import type { Values } from '../../core/engine/types'
import type { Command } from '../../main/commands'

export interface State {
  live: Values
  preview: Values
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
      send(cmd: Command): void
      onState(cb: (s: State) => void): () => void
    }
  }
}

export const send = (c: Command) => window.bitgil.send(c)
