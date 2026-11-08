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
  cue: number // 순서 목록에서 마지막으로 미리보기에 올린 줄(-1 = 시작 전)
  find: string | null // 조명 찾기 중인 조명(null = 찾기 아님)
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
  version: string
  update: {
    text: string // 상단에 보일 상태(빈 값 = 알릴 것 없음)
    notice: { version: string; notes: string } | null // 켤 때 찾은 새 버전
    on: boolean // 설정: 자동 업데이트
    lastCheck: string // 마지막 확인 날
  }
  editMode: boolean // false = 운영 모드
  pinSet: boolean
  remote: { on: boolean; code: string; urls: string[]; error: string; clients: number }
}

declare global {
  interface Window {
    bitgil: {
      getShow(): Promise<import('../../core/engine/types').Show>
      getState(): Promise<State>
      listPorts(): Promise<{ path: string; manufacturer?: string }[]>
      send(cmd: Command): void
      unlock(pin: string): Promise<boolean>
      setPin(pin: string, current?: string): Promise<boolean>
      lock(): Promise<void>
      onState(cb: (s: State) => void): () => void
      onShow(cb: (s: import('../../core/engine/types').Show) => void): () => void
    }
  }
}

export const send = (c: Command) => window.bitgil.send(c)
