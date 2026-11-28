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
  /** 줌 값 0 = 가장 넓게(실물 확인한 기구만 true) */
  zoom_wide_at_0?: boolean
  /** 기능 점검에서 '실물과 같음'으로 표시한 채널(attr) */
  checked?: string[]
  mount: string
  pan_deg?: number
  tilt_deg?: number
  /** 3D 팬 방향 보정(도, 위에서 볼 때 반시계 +). 설치 방향 때문에 실물과 돌아가 있을 때 */
  pan_offset_deg?: number
  /** 실물 팬·틸트가 3D와 반대로 움직이면 true(기능 점검에서 고름) */
  pan_invert?: boolean
  tilt_invert?: boolean
  /** 셔터 255 = 지속 점등·0 = 꺼짐(true). 없으면 0 = 점등·255 = 꺼짐. 그 사이는 스트로브 */
  shutter_open_at_255?: boolean
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
  /** 운영 중에 저장한 임시 씬(정식 씬과 구분해 표시) */
  temp?: boolean
  /** 씬 효과(씬 값이 기준, 시간에 따라 바뀜). 계산은 effects.ts */
  effects?: Effect[]
  /** 저장할 때 찍은 3D 미리보기 그림(작은 JPEG data URL). 씬 버튼·폰에 보임 */
  thumb?: string
}

/** 씬 효과 하나. 크기·퍼짐 0~100%, 속도 = 1분에 몇 번, 반복 = 조명 줄 안 물결 수, fixtures = 물결 순서
 *  wave = 밝기 물결, flash = 깜빡임(켜짐/꺼짐), color = 색 돌기(색 있는 조명만), circle = 무빙 원(팬·틸트 조명만) */
export interface Effect {
  type: 'wave' | 'flash' | 'color' | 'circle'
  fixtures: string[]
  size: number
  speed: number
  repeat: number
  spread: number
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
  cuelist: CueStep[] // 지금 쓰는 순서 목록
  /** 지금 쓰는 순서 목록 이름(없으면 '기본 순서') */
  cuelist_name?: string
  /** 안 쓰고 있는 다른 순서 목록들(예배 종류별). 고르면 cuelist 와 자리를 바꾼다 — 예전 빛길도 그대로 읽게 */
  other_cuelists?: { name: string; cuelist: CueStep[] }[]
  default_scene?: string
  /** 내 색(색 팔레트에 저장). 기본 색과 같은 이름이면 그 값을 바꾼다 */
  colors?: NamedColor[]
}

export interface NamedColor { name: string; rgbw: [number, number, number, number] }

/** 순서 목록 한 줄: 어떤 씬을 몇 초 페이드로 */
/** auto = 자동 진행 중 이 줄이 나간 뒤 n초 지나면 다음 줄로(없으면 자동 진행이 여기서 멈춤) */
export interface CueStep { scene: string; fade: number; auto?: number }

/** 조명 id → 속성 이름 → 0~255 */
export type Values = Record<string, Record<string, number>>
