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
  chTest: { ch: number; value: number } | null // 채널 시험 중인 채널(null = 아님)
  master: number
  blackout: boolean
  fading: boolean
  output: {
    enabled: boolean // 출력 켜짐(false = 출력 대기)
    connected: boolean
    port: string // 지금 연결된 포트
    error: string
    preferred: string // 설정한 포트, 빈 값 = 자동
    type: import('../../main/dmx/enttec').DmxType
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
  quality: { set: import('../../main/quality').QualitySetting; used: import('../../main/quality').Quality; cores: number; memGB: number }
  editMode: boolean // false = 운영 모드
  pinSet: boolean
  pinEnabled: boolean // false = PIN 없이 편집 모드가 열림
  phone: { text: string; at: number } // 폰에서 마지막으로 누른 것(at = 시각, 0 = 아직 없음)
  remote: { on: boolean; code: string; urls: string[]; error: string; clients: number }
}

declare global {
  interface Window {
    bitgil: {
      getShow(): Promise<import('../../core/engine/types').Show>
      getState(): Promise<State>
      listPorts(): Promise<{ path: string; manufacturer?: string }[]>
      udmxDriverState(): Promise<import('../../main/dmx/udmx').DriverState>
      udmxInstallDriver(): Promise<string> // 빈 문자열 = Zadig 를 열었다 닫음
      send(cmd: Command): void
      unlock(pin: string): Promise<boolean>
      setPin(pin: string, current?: string): Promise<boolean>
      pinEnabled(on: boolean, pin?: string): Promise<boolean> // 끌 때는 현재 PIN 필요
      lock(): Promise<void>
      xhdImport(): Promise<string>
      xhdExport(): Promise<string>
      showExport(): Promise<string>
      showImport(): Promise<string>
      onState(cb: (s: State) => void): () => void
      onShow(cb: (s: import('../../core/engine/types').Show) => void): () => void
    }
  }
}

export const send = (c: Command) => window.bitgil.send(c)
