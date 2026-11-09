import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { AdditiveBlending, Quaternion, Vector3 } from 'three'
import type { Fixture, FixtureType, Venue } from '../../../core/engine/types'
import { beamAngle, beamDirection, beamHit, fixtureColor } from '../../../core/engine/visual'
import { beamMaterial } from './beamMaterial'
import { FixtureBody, floorLift, shapeOf } from './FixtureBody'

interface Props {
  fixture: Fixture
  type: FixtureType
  values: Record<string, number> | undefined
  master: number
  venue: Venue
  selected: boolean
  onSelect: (id: string, add: boolean) => void
  segments: number
}

const UP = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)
const RING = Array.from({ length: 33 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2
  return [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3] as [number, number, number]
})

export function FixtureLight({ fixture: f, type, values, master, venue, selected, onSelect, segments }: Props) {
  const mat = useMemo(beamMaterial, [])
  const c = fixtureColor(type, values, master)
  const d = beamDirection(f, type, values)
  const shape = shapeOf(type)
  const p0 = { ...f.position, y: f.position.y + (f.mount === 'floor' ? floorLift(shape) : 0) }
  const hit = beamHit(venue, p0, d)
  const len = hit.distance
  const radius = len * Math.tan(((beamAngle(type, values) / 2) * Math.PI) / 180)
  const dir = new Vector3(d.x, d.y, d.z)
  const pos = new Vector3(p0.x, p0.y, p0.z)
  const coneQ = new Quaternion().setFromUnitVectors(UP, dir.clone().negate()) // 원뿔 꼭짓점이 조명 쪽
  const poolQ = new Quaternion().setFromUnitVectors(Z, new Vector3(hit.normal.x, hit.normal.y, hit.normal.z))
  const on = c.intensity > 0.01 && c.r + c.g + c.b > 0.01
  const color: [number, number, number] = [c.r, c.g, c.b]
  mat.uniforms.color.value.setRGB(c.r, c.g, c.b)
  mat.uniforms.opacity.value = 0.35 * c.intensity

  return (
    <group>
      <group position={pos}>
        <mesh onClick={(e) => { e.stopPropagation(); onSelect(f.id, e.shiftKey || e.ctrlKey) }}>
          <sphereGeometry args={[0.32, 8, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        <FixtureBody shape={shape} dir={dir} mount={f.mount} lens={on ? `rgb(${color.map((x) => Math.round(255 * (0.25 + x * c.intensity * 0.75))).join(',')})` : '#1b1d22'} />
        {selected && (
          <mesh>
            <boxGeometry args={[0.55, 0.55, 0.55]} />
            <meshBasicMaterial color="#ffd23f" wireframe />
          </mesh>
        )}
        {!f.verified && <Line points={RING} color="#9aa3b5" dashed dashSize={0.08} gapSize={0.06} lineWidth={1} />}
        <Html center position={[0, f.mount === 'floor' ? -0.5 : 0.4, 0]} className={'label' + (selected ? ' sel' : '')}>{f.id}</Html>
      </group>
      {on && (
        <>
          <mesh position={pos.clone().addScaledVector(dir, len / 2)} quaternion={coneQ} material={mat}>
            <coneGeometry args={[radius, len, segments, 1, true]} />
          </mesh>
          <mesh position={[hit.point.x + hit.normal.x * 0.02, hit.point.y + hit.normal.y * 0.02, hit.point.z + hit.normal.z * 0.02]} quaternion={poolQ}>
            <circleGeometry args={[radius, segments + 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.55 * c.intensity} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}
