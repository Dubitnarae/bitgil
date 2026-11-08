import { Quaternion, Vector3 } from 'three'
import type { FixtureType } from '../../../core/engine/types'

// 조명 몸체 모양. 머리는 원점(회전 중심)에 두고 빛은 아래(-y)로 나가게 그린 뒤 빛 방향으로 돌린다.
// 크기는 실물 비슷하게 추정(m). 종류(kind)마다 모양 하나: 사진 5종(무빙·파·프레넬·프로파일·둥근 투광).

const BODY = '#8a909c'
const DARK = '#5c616c'
const DOWN = new Vector3(0, -1, 0)

type Shape = 'moving' | 'par' | 'fresnel' | 'profile' | 'flood'
export const shapeOf = (t: FixtureType): Shape =>
  t.kind === 'moving_head' ? 'moving'
    : t.kind === 'spot_white' ? 'fresnel'
    : t.kind === 'spot_rgbw_gobo' ? 'profile'
    : t.kind === 'flood_white' ? 'flood'
    : 'par'

/** 바닥 조명은 위치가 바닥 높이라서 받침 높이만큼 머리를 올린다 */
export const floorLift = (shape: Shape) => (shape === 'moving' ? 0.33 : 0.23)

const Body = ({ c = BODY }: { c?: string }) => <meshLambertMaterial color={c} />
const Lens = ({ y, r, lens }: { y: number; r: number; lens: string }) => (
  <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <circleGeometry args={[r, 24]} />
    <meshBasicMaterial color={lens} />
  </mesh>
)

/** 빛이 나가는 머리 부분(-y 방향으로 빛) */
function Head({ shape, lens }: { shape: Shape; lens: string }) {
  switch (shape) {
    case 'par': // 짧고 넓은 통 + 앞면 LED 알
      return (
        <group>
          <mesh><cylinderGeometry args={[0.14, 0.14, 0.12, 20]} /><Body /></mesh>
          <Lens y={-0.061} r={0.125} lens={DARK} />
          {LEDS.map(([x, z], i) => (
            <mesh key={i} position={[x, -0.063, z]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.022, 10]} />
              <meshBasicMaterial color={lens} />
            </mesh>
          ))}
        </group>
      )
    case 'fresnel': // 통 + 앞 렌즈 + 날개 4장
      return (
        <group>
          <mesh><cylinderGeometry args={[0.11, 0.12, 0.3, 20]} /><Body /></mesh>
          <mesh position={[0, 0.17, 0]}><boxGeometry args={[0.16, 0.06, 0.16]} /><Body c={DARK} /></mesh>
          <Lens y={-0.151} r={0.1} lens={lens} />
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
              <mesh position={[0, -0.22, 0.15]} rotation={[-0.45, 0, 0]}>
                <boxGeometry args={[0.2, 0.14, 0.006]} /><Body c={DARK} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'profile': // 굵은 뒤통 + 가는 앞 통(긴 몸)
      return (
        <group>
          <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.1, 0.1, 0.22, 18]} /><Body /></mesh>
          <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[0.075, 0.075, 0.26, 18]} /><Body /></mesh>
          <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.12, 0.12, 0.05, 18]} /><Body c={DARK} /></mesh>
          <Lens y={-0.261} r={0.065} lens={lens} />
        </group>
      )
    case 'flood': // 방열판 달린 둥근 몸
      return (
        <group>
          <mesh><cylinderGeometry args={[0.13, 0.15, 0.24, 24]} /><Body c={DARK} /></mesh>
          {FINS.map((a, i) => (
            <mesh key={i} position={[Math.cos(a) * 0.145, 0.02, Math.sin(a) * 0.145]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.03, 0.18, 0.008]} /><Body />
            </mesh>
          ))}
          <Lens y={-0.121} r={0.13} lens={lens} />
        </group>
      )
    case 'moving': // 둥근 머리
      return (
        <group>
          <mesh rotation={[0, 0, 0]}><cylinderGeometry args={[0.12, 0.1, 0.22, 20]} /><Body /></mesh>
          <Lens y={-0.111} r={0.11} lens={lens} />
        </group>
      )
  }
}

const LEDS: [number, number][] = [[0, 0], ...Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2
  return [Math.cos(a) * 0.07, Math.sin(a) * 0.07] as [number, number]
})]
const FINS = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2)

/** 몸체 전체: 받침(요크)은 좌우로만 돌고, 머리는 빛 방향으로 향한다 */
export function FixtureBody({ shape, dir, mount, lens }: { shape: Shape; dir: Vector3; mount: string; lens: string }) {
  const headQ = new Quaternion().setFromUnitVectors(DOWN, dir)
  const yaw = Math.abs(dir.x) + Math.abs(dir.z) > 1e-3 ? Math.atan2(dir.x, dir.z) : 0
  const w = shape === 'par' ? 0.17 : shape === 'moving' ? 0.15 : 0.14 // 받침 팔 간격(반)
  const up = mount === 'floor' ? -1 : 1 // 받침이 붙는 쪽: 천장 = 위, 바닥 = 아래
  const armLen = shape === 'moving' ? 0.2 : mount === 'floor' ? 0.22 : 0.3 // 천장: 배튼(위치보다 약 0.3m 위)까지
  return (
    <group>
      <group rotation={[0, yaw, 0]}>
        {[-w, w].map((x) => (
          <mesh key={x} position={[x, (up * armLen) / 2, 0]}><boxGeometry args={[0.02, armLen, 0.05]} /><Body c={DARK} /></mesh>
        ))}
        <mesh position={[0, up * armLen, 0]}><boxGeometry args={[w * 2 + 0.02, 0.02, 0.05]} /><Body c={DARK} /></mesh>
        {shape === 'moving' && (
          <mesh position={[0, -armLen - 0.07, 0]}><boxGeometry args={[0.36, 0.12, 0.26]} /><Body /></mesh>
        )}
      </group>
      <group quaternion={headQ}><Head shape={shape} lens={lens} /></group>
    </group>
  )
}
