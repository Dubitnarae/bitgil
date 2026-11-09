import { Html, Line } from '@react-three/drei'
import type { Venue as V } from '../../../core/engine/types'
import { floorY } from '../../../core/engine/visual'

// 높은 단일수록 조금씩 밝게
const TIER_COLORS = ['#4c505b', '#5b606c', '#6a707d', '#79808e']

/** 예배당 공간: 바닥(무대·통로·좌석 단), 왼쪽·정면 벽, 배튼, 소품, 지붕 윤곽. 오른쪽·뒤쪽 벽은 보기 위해 비워 둔다. */
export function Venue({ venue }: { venue: V }) {
  const { length_x: X, width_z: Z, eave_height: H, ridge_height: R } = venue.room
  const block = (z0: number, z1: number, h: number, color: string, key: string) => (
    <mesh key={key} position={[X / 2, Math.max(h, 0.02) / 2 - (h ? 0 : 0.02), (z0 + z1) / 2]}>
      <boxGeometry args={[X, Math.max(h, 0.02), z1 - z0]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
  const roof: [number, number, number][] = [[0, H, 0], [0, R, Z / 2], [0, H, Z], [X, H, Z], [X, R, Z / 2], [X, H, 0], [0, H, 0]]

  return (
    <group>
      {block(0, Z, 0, '#373a41', 'floor')}
      {block(venue.stage.z_from, venue.stage.z_to, venue.stage.height, '#5a4632', 'stage')}
      {venue.seating_tiers.map((t, i) => block(t.z_from, t.z_to, t.height, TIER_COLORS[i % TIER_COLORS.length], 'tier' + i))}
      {/* 단 앞 모서리 선: 어두운 화면에서도 계단 모양이 보이게 */}
      {/* 무대는 좌석 쪽(z_to)이 앞, 좌석 단은 무대 쪽(z_from)이 앞 */}
      {[[venue.stage.z_to, venue.stage.height], ...venue.seating_tiers.map((t) => [t.z_from, t.height])].map(([z, h], i) => (
        <Line key={'edge' + i} points={[[0, h, z], [X, h, z]]} color="#a8aebb" lineWidth={1.5} />
      ))}
      {/* 왼쪽 벽(글씨 벽) */}
      <mesh position={[0, H / 2, Z / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[Z, H]} />
        <meshLambertMaterial color="#3b3e46" />
      </mesh>
      {/* 정면 벽(무대 뒤) */}
      <mesh position={[X / 2, H / 2, 0]}>
        <planeGeometry args={[X, H]} />
        <meshLambertMaterial color="#40434b" />
      </mesh>
      <Line points={roof} color="#555b66" lineWidth={1} />
      <Line points={[[0, R, Z / 2], [X, R, Z / 2]]} color="#555b66" lineWidth={1} />
      {venue.battens.map((b) => (
        <group key={b.id}>
          <mesh position={[(b.x_from + b.x_to) / 2, b.height, b.z]}>
            <boxGeometry args={[b.x_to - b.x_from, 0.05, 0.05]} />
            <meshBasicMaterial color="#8a8f99" />
          </mesh>
          <Html position={[b.x_from - 0.4, b.height, b.z]} center className="label dim">{b.id}</Html>
        </group>
      ))}
      {venue.props.filter((p) => p.h > 0).map((p) => {
        const y = floorY(venue, p.z)
        return (
          <group key={p.id}>
            <mesh position={[p.x, y + p.h / 2, p.z]}>
              <boxGeometry args={[p.w, p.h, p.d]} />
              <meshLambertMaterial color="#6b5a48" />
            </mesh>
            <Html position={[p.x, y + p.h + 0.2, p.z]} center className="label dim">{p.label}</Html>
          </group>
        )
      })}
      {venue.text_panels.map((t) => (
        <group key={t.fixture}>
          <mesh position={[0.01, t.y_center, t.z_center]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.4, 1.0]} />
            <meshLambertMaterial color="#6d717b" />
          </mesh>
          <Html position={[0.05, t.y_center, t.z_center]} center className="label dim">{t.label}</Html>
        </group>
      ))}
    </group>
  )
}
