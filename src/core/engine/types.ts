// 쇼 파일(*.bitgil.json) 형식. 설명은 docs/data-format.md
export interface Vec3 { x: number; y: number; z: number }

export interface Channel {
  offset: number
  attr: string
  label: string
  mix: 'HTP' | 'LTP'
  fade: boolean
  locate?: number
}

export interface FixtureType {
  id: string
  label: string
  kind: string
  channel_count: number
  channels: Channel[]
  beam_deg: [number, number]
  mount: string
  pan_deg?: number
  tilt_deg?: number
}

export interface Fixture {
  id: string
  address: number
  universe: number
  type: string
  position: Vec3
  mount: string
  direction: 'down' | 'up' | 'aimed' | 'pan_tilt'
  aim: Vec3 | null
  batten?: string
  verified: boolean
}

export interface Scene {
  id: string
  name: string
  fade_seconds: number
  values: Values
}

export interface Box { id: string; label: string; x: number; z: number; w: number; d: number; h: number }

export interface Venue {
  room: { length_x: number; width_z: number; eave_height: number; ridge_height: number }
  stage: { z_from: number; z_to: number; height: number }
  seating_tiers: { z_from: number; z_to: number; height: number }[]
  battens: { id: string; z: number; x_from: number; x_to: number; height: number }[]
  props: Box[]
  text_panels: { fixture: string; z_center: number; y_center: number; label: string }[]
}

export interface Show {
  name: string
  venue: Venue
  fixture_types: FixtureType[]
  fixtures: Fixture[]
  groups: { id: string; label: string; members: string[] }[]
  scenes: Scene[]
  cuelist: unknown[]
  default_scene?: string
}

/** 조명 id → 속성 이름 → 0~255 */
export type Values = Record<string, Record<string, number>>
