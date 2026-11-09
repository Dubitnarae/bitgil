import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as Controls } from 'three-stdlib'
import type { Show, Values, Vec3 } from '../../../core/engine/types'
import { Venue } from './Venue'
import { FixtureLight } from './FixtureLight'
import { PRESETS, type Quality } from '../../../main/quality'

interface Props {
  show: Show
  values: Values
  master: number
  selected: string[]
  onSelect: (id: string, add: boolean) => void
  onClear: () => void
  /** 빛 위치 찍기 중일 때만: 바닥·벽·소품을 누른 지점 */
  onPoint?: (p: Vec3) => void
  /** 화면 품질(설정): 해상도·계단 현상·원뿔 조각 수 */
  quality: Quality
}

/** 3D 화면: 엔진 값을 받아 그리기만 한다. 값이 바뀔 때만 다시 그린다(내장 그래픽 배려). */
export function Stage3D({ show, values, master, selected, onSelect, onClear, onPoint, quality }: Props) {
  const { length_x: X, width_z: Z } = show.venue.room
  const types = new Map(show.fixture_types.map((t) => [t.id, t]))
  const home = { position: [X * 0.8, 8, Z + 6] as const, target: [X / 2, 1.5, Z / 3] as const }
  const ctrl = useRef<Controls>(null)
  const q = PRESETS[quality]
  /** 카메라를 처음 보던 자리로 되돌린다 */
  const resetView = () => {
    const c = ctrl.current
    if (!c) return
    c.object.position.set(...home.position)
    c.target.set(...home.target)
    c.update()
  }
  return (
    <>
    {/* key: 계단 현상 설정은 처음 만들 때만 정해져서 품질이 바뀌면 다시 만든다 */}
    <Canvas key={quality} frameloop="demand" dpr={q.dpr} gl={{ antialias: q.antialias }} camera={{ position: [...home.position], fov: 50 }} onPointerMissed={onClear}>
      <color attach="background" args={['#0d0f13']} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#8090b0', '#202020', 0.6]} />
      {/* 찍기 중이 아니면 손잡이를 달지 않는다(빈 곳 클릭 = 선택 해제가 그대로 동작) */}
      <group onClick={onPoint && ((e) => {
        e.stopPropagation() // 맨 앞에 닿은 면 하나만
        if (e.delta > 5) return // 화면을 돌리려고 끈 것
        const r = (n: number) => Math.round(n * 100) / 100
        onPoint({ x: r(e.point.x), y: r(e.point.y), z: r(e.point.z) })
      })}>
        <Venue venue={show.venue} />
      </group>
      {show.fixtures.map((f) => {
        const type = types.get(f.type)
        return type && (
          <FixtureLight key={f.id} fixture={f} type={type} values={values[f.id]} master={master}
            venue={show.venue} selected={selected.includes(f.id)} onSelect={onSelect} segments={q.segments} />
        )
      })}
      <OrbitControls ref={ctrl} target={[...home.target]} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
    <button className="resetview" onClick={resetView} title="돌리거나 확대한 화면을 처음 위치로">원위치</button>
    </>
  )
}
