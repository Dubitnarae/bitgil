import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { AdditiveBlending, Quaternion, Vector3 } from 'three'
import type { Fixture, FixtureType, Venue } from '../../../core/engine/types'
import { beamAngle, beamDirection, beamHit, fixtureColor } from '../../../core/engine/visual'
import { beamMaterial } from './beamMaterial'

interface Props {
  fixture: Fixture
  type: FixtureType
  values: Record<string, number> | undefined
  master: number
  venue: Venue
  selected: boolean
  onSelect: (id: string, add: boolean) => void
}

const UP = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)
const RING = Array.from({ length: 33 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2
  return [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3] as [number, number, number]
})

export function FixtureLight({ fixture: f, type, values, master, venue, selected, onSelect }: Props) {
  const mat = useMemo(beamMaterial, [])
  const c = fixtureColor(type, values, master)
  const d = beamDirection(f, type, values)
  const hit = beamHit(venue, f.position, d)
  const len = hit.distance
  const radius = len * Math.tan(((beamAngle(type, values) / 2) * Math.PI) / 180)
  const dir = new Vector3(d.x, d.y, d.z)
  const pos = new Vector3(f.position.x, f.position.y, f.position.z)
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
        <mesh>
          <boxGeometry args={[0.28, 0.22, 0.28]} />
          <meshBasicMaterial color={on ? color.map((x) => 0.25 + x * c.intensity * 0.75) as [number, number, number] : '#3a3d45'} />
        </mesh>
        {selected && (
          <mesh>
            <boxGeometry args={[0.42, 0.36, 0.42]} />
            <meshBasicMaterial color="#ffd23f" wireframe />
          </mesh>
        )}
        {!f.verified && <Line points={RING} color="#9aa3b5" dashed dashSize={0.08} gapSize={0.06} lineWidth={1} />}
        <Html center position={[0, f.mount === 'floor' ? -0.35 : 0.35, 0]} className={'label' + (selected ? ' sel' : '')}>{f.id}</Html>
      </group>
      {on && (
        <>
          <mesh position={pos.clone().addScaledVector(dir, len / 2)} quaternion={coneQ} material={mat}>
            <coneGeometry args={[radius, len, 24, 1, true]} />
          </mesh>
          <mesh position={[hit.point.x + hit.normal.x * 0.02, hit.point.y + hit.normal.y * 0.02, hit.point.z + hit.normal.z * 0.02]} quaternion={poolQ}>
            <circleGeometry args={[radius, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.55 * c.intensity} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}
