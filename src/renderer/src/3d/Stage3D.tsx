import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as Controls } from 'three-stdlib'
import type { Show, Values } from '../../../core/engine/types'
import { Venue } from './Venue'
import { FixtureLight } from './FixtureLight'

interface Props {
  show: Show
  values: Values
  master: number
  selected: string[]
  onSelect: (id: string, add: boolean) => void
  onClear: () => void
}

/** 3D 화면: 엔진 값을 받아 그리기만 한다. 값이 바뀔 때만 다시 그린다(내장 그래픽 배려). */
export function Stage3D({ show, values, master, selected, onSelect, onClear }: Props) {
  const { length_x: X, width_z: Z } = show.venue.room
  const types = new Map(show.fixture_types.map((t) => [t.id, t]))
  const home = { position: [X * 0.8, 8, Z + 6] as const, target: [X / 2, 1.5, Z / 3] as const }
  const ctrl = useRef<Controls>(null)
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
    <Canvas frameloop="demand" dpr={1} camera={{ position: [...home.position], fov: 50 }} onPointerMissed={onClear}>
      <color attach="background" args={['#0d0f13']} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#8090b0', '#202020', 0.6]} />
      <Venue venue={show.venue} />
      {show.fixtures.map((f) => {
        const type = types.get(f.type)
        return type && (
          <FixtureLight key={f.id} fixture={f} type={type} values={values[f.id]} master={master}
            venue={show.venue} selected={selected.includes(f.id)} onSelect={onSelect} />
        )
      })}
      <OrbitControls ref={ctrl} target={[...home.target]} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
    <button className="resetview" onClick={resetView} title="돌리거나 확대한 화면을 처음 위치로">원위치</button>
    </>
  )
}
