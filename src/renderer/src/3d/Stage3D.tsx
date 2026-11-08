import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
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
  return (
    <Canvas frameloop="demand" dpr={1} camera={{ position: [X * 0.8, 8, Z + 6], fov: 50 }} onPointerMissed={onClear}>
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
      <OrbitControls target={[X / 2, 1.5, Z / 3]} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  )
}
