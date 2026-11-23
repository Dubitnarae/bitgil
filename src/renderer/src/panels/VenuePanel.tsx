import { useEffect, useState } from 'react'
import type { FixtureType, Show, Vec3, Venue } from '../../../core/engine/types'
import { editFixtureType, editVenue, type TypeEdit } from '../../../core/engine/patch'
import { floorY } from '../../../core/engine/visual'
import { send } from '../api'

/** 숫자 칸: 입력 중인 글자('1.' 등)는 그대로 두고, 숫자로 바꾼 값만 올린다(빈칸 = NaN → 저장 막힘) */
function Num({ value, onChange, step = 0.1 }: { value: number; onChange: (n: number) => void; step?: number }) {
  const [s, setS] = useState(String(value))
  return <input type="number" step={step} min={0} value={s}
    onChange={(e) => { setS(e.target.value); onChange(e.target.value === '' ? NaN : Number(e.target.value)) }} />
}

/** 3D에 그릴 치수 선: 지금 고르는 숫자 칸이 어디부터 어디까지인지 */
export type Mark = { a: Vec3; b: Vec3; text: string }
type Seg = (v: Venue) => number[] // a.x a.y a.z b.x b.y b.z
const P = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

/** 저장 전에 같은 검사 함수를 복사본에 돌려 오류 문구를 미리 보여 준다 */
function check(run: () => void) {
  try { run(); return '' } catch (e) { return e instanceof Error ? e.message : String(e) }
}

/** 공간·조명 종류 수정(편집 모드 전용): 방·무대·좌석 단·배튼·소품 치수, 조명 종류의 빛 각도·팬·틸트 범위 */
export function VenuePanel({ show, onDraft }: { show: Show; onDraft: (p: { venue: Venue; mark: Mark | null } | null) => void }) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState<{ label: string; seg: Seg } | null>(null)
  const [d, setD] = useState<Venue>(() => structuredClone(show.venue))
  const [gen, setGen] = useState(0) // 되돌리기 때 숫자 칸을 새로 그리기 위한 번호
  const upd = (f: (v: Venue) => void) => setD((cur) => { const c = structuredClone(cur); f(c); return c })
  const reset = () => { setD(structuredClone(show.venue)); setGen(gen + 1) }
  // seg = 이 숫자가 3D에서 재는 구간(칸을 누르면 노란 선으로 보인다)
  const n = (label: string, value: number, set: (v: Venue, x: number) => void, seg: Seg, name = label) => (
    <label key={label} className={focus?.label === name ? 'on' : ''} onFocus={() => setFocus({ label: name, seg })}>
      {label} <Num key={gen} value={value} onChange={(x) => upd((v) => set(v, x))} />
    </label>
  )
  const error = open ? check(() => editVenue({ ...show }, d)) : ''
  // 열려 있는 동안 3D는 고치는 중인 공간(오류면 저장된 공간)과 치수 선을 보여 준다
  useEffect(() => {
    if (!open) return onDraft(null)
    const venue = error ? show.venue : d
    let c: number[] | undefined
    try { c = focus?.seg(venue) } catch { c = undefined } // 빼기로 사라진 줄
    onDraft({ venue, mark: c && c.every(Number.isFinite) ? { a: P(c[0], c[1], c[2]), b: P(c[3], c[4], c[5]), text: focus!.label } : null })
  }, [open, d, focus, error, show.venue])
  useEffect(() => () => onDraft(null), [])

  if (!open) {
    return (
      <section className="panel">
        <h3>공간·조명 종류 수정 <button className="close" onClick={() => { reset(); setOpen(true) }}>열기</button></h3>
      </section>
    )
  }

  const changed = JSON.stringify(d) !== JSON.stringify(show.venue)

  return (
    <section className="panel venue">
      <h3>공간·조명 종류 수정 <button className="close" onClick={() => setOpen(false)}>닫기</button></h3>
      <p className="hint">단위 m. 기준점 = 왼쪽 벽·정면 벽 모서리 통로 바닥. x 오른쪽 · z 좌석 쪽. 숫자 칸을 누르면 3D에 그 길이가 노란 선으로 보입니다. 고치는 값은 3D에 바로 보이고, [공간 저장]을 눌러야 쇼 파일에 남습니다.</p>
      <div className="settings">
        <div className="group">
          <h4>방</h4>
          <div className="apply">
            {n('길이 x', d.room.length_x, (v, x) => { v.room.length_x = x }, (v) => [0, 0.05, v.room.width_z, v.room.length_x, 0.05, v.room.width_z], '방 길이 x')}
            {n('폭 z', d.room.width_z, (v, x) => { v.room.width_z = x }, (v) => [v.room.length_x, 0.05, 0, v.room.length_x, 0.05, v.room.width_z], '방 폭 z')}
            {n('처마 높이', d.room.eave_height, (v, x) => { v.room.eave_height = x }, (v) => [v.room.length_x, 0, 0, v.room.length_x, v.room.eave_height, 0])}
            {n('지붕 꼭대기', d.room.ridge_height, (v, x) => { v.room.ridge_height = x }, (v) => [v.room.length_x, 0, v.room.width_z / 2, v.room.length_x, v.room.ridge_height, v.room.width_z / 2])}
          </div>
        </div>
        <div className="group">
          <h4>무대(강대)</h4>
          <div className="apply">
            {n('z 시작', d.stage.z_from, (v, x) => { v.stage.z_from = x }, (v) => [v.room.length_x / 2, v.stage.height, 0, v.room.length_x / 2, v.stage.height, v.stage.z_from], '무대 z 시작')}
            {n('z 끝', d.stage.z_to, (v, x) => { v.stage.z_to = x }, (v) => [v.room.length_x / 2, v.stage.height, 0, v.room.length_x / 2, v.stage.height, v.stage.z_to], '무대 z 끝')}
            {n('높이', d.stage.height, (v, x) => { v.stage.height = x }, (v) => [v.room.length_x / 2, 0, v.stage.z_to, v.room.length_x / 2, v.stage.height, v.stage.z_to], '무대 높이')}
          </div>
        </div>
        <div className="group">
          <h4>좌석 단</h4>
          {d.seating_tiers.map((t, i) => (
            <div className="apply" key={i}>
              <b>{i + 1}단</b>
              {n(`z 시작 `, t.z_from, (v, x) => { v.seating_tiers[i].z_from = x }, (v) => { const s = v.seating_tiers[i]; return [v.room.length_x / 2, s.height, 0, v.room.length_x / 2, s.height, s.z_from] }, `${i + 1}단 z 시작`)}
              {n(`z 끝 `, t.z_to, (v, x) => { v.seating_tiers[i].z_to = x }, (v) => { const s = v.seating_tiers[i]; return [v.room.length_x / 2, s.height, 0, v.room.length_x / 2, s.height, s.z_to] }, `${i + 1}단 z 끝`)}
              {n(`높이 `, t.height, (v, x) => { v.seating_tiers[i].height = x }, (v) => { const s = v.seating_tiers[i]; return [v.room.length_x / 2, 0, s.z_from, v.room.length_x / 2, s.height, s.z_from] }, `${i + 1}단 높이`)}
            </div>
          ))}
        </div>
        <div className="group">
          <h4>배튼(천장 조명 줄)</h4>
          <p className="hint">배튼을 옮겨도 조명 위치는 따로입니다(조명 찾기에서 고치기).</p>
          {d.battens.map((b, i) => (
            <div className="apply" key={b.id}>
              <b>{b.id}</b>
              {n('z 위치', b.z, (v, x) => { v.battens[i].z = x }, (v) => { const t = v.battens[i]; return [t.x_from, t.height, 0, t.x_from, t.height, t.z] }, `${b.id} z 위치`)}
              {n('x 시작', b.x_from, (v, x) => { v.battens[i].x_from = x }, (v) => { const t = v.battens[i]; return [0, t.height, t.z, t.x_from, t.height, t.z] }, `${b.id} x 시작`)}
              {n('x 끝', b.x_to, (v, x) => { v.battens[i].x_to = x }, (v) => { const t = v.battens[i]; return [0, t.height, t.z, t.x_to, t.height, t.z] }, `${b.id} x 끝`)}
              {n('높이', b.height, (v, x) => { v.battens[i].height = x }, (v) => { const t = v.battens[i], m = (t.x_from + t.x_to) / 2; return [m, floorY(v, t.z), t.z, m, t.height, t.z] }, `${b.id} 높이`)}
            </div>
          ))}
        </div>
        <div className="group">
          <h4>소품 상자</h4>
          <p className="hint">x·z = 상자 가운데. 높이 0이면 3D에 그리지 않습니다(자리 표시만).</p>
          {d.props.map((p, i) => (
            <div className="apply" key={p.id}>
              <input className="name" value={p.label} onChange={(e) => upd((v) => { v.props[i].label = e.target.value })} />
              {n('x', p.x, (v, x) => { v.props[i].x = x }, (v) => { const o = v.props[i], y = floorY(v, o.z); return [0, y, o.z, o.x, y, o.z] }, `${p.label} x`)}
              {n('z', p.z, (v, x) => { v.props[i].z = x }, (v) => { const o = v.props[i], y = floorY(v, o.z); return [o.x, y, 0, o.x, y, o.z] }, `${p.label} z`)}
              {n('폭', p.w, (v, x) => { v.props[i].w = x }, (v) => { const o = v.props[i], y = floorY(v, o.z) + o.h; return [o.x - o.w / 2, y, o.z + o.d / 2, o.x + o.w / 2, y, o.z + o.d / 2] }, `${p.label} 폭`)}
              {n('깊이', p.d, (v, x) => { v.props[i].d = x }, (v) => { const o = v.props[i], y = floorY(v, o.z) + o.h; return [o.x + o.w / 2, y, o.z - o.d / 2, o.x + o.w / 2, y, o.z + o.d / 2] }, `${p.label} 깊이`)}
              {n('높이', p.h, (v, x) => { v.props[i].h = x }, (v) => { const o = v.props[i], y = floorY(v, o.z); return [o.x + o.w / 2, y, o.z + o.d / 2, o.x + o.w / 2, y + o.h, o.z + o.d / 2] }, `${p.label} 높이`)}
              <button onClick={() => upd((v) => { v.props.splice(i, 1) })}>빼기</button>
            </div>
          ))}
          <button onClick={() => upd((v) => { v.props.push({ id: 'prop-' + Date.now(), label: '새 소품', x: v.room.length_x / 2, z: 1, w: 1, d: 1, h: 1 }) })}>소품 추가</button>
        </div>
        {error && <p className="warn">{error}</p>}
        <div className="apply">
          <button className="go" disabled={!!error || !changed} onClick={() => send({ t: 'editVenue', venue: d })}>공간 저장</button>
          <button disabled={!changed} onClick={reset}>되돌리기</button>
        </div>
        <div className="group">
          <h4>조명 종류 (빛 각도·움직임 범위, 추정값)</h4>
          {show.fixture_types.map((t) => <TypeRow key={t.id + JSON.stringify([t.beam_deg, t.pan_deg, t.tilt_deg])} t={t} />)}
        </div>
      </div>
    </section>
  )
}

function TypeRow({ t }: { t: FixtureType }) {
  const moving = t.kind === 'moving_head'
  const [e, setE] = useState<Required<Pick<TypeEdit, 'beam_deg' | 'pan_deg' | 'tilt_deg'>>>({ beam_deg: [...t.beam_deg], pan_deg: t.pan_deg ?? 540, tilt_deg: t.tilt_deg ?? 270 })
  const edit: TypeEdit = moving ? e : { beam_deg: e.beam_deg }
  const error = check(() => editFixtureType({ fixture_types: [{ ...t }] } as Show, t.id, edit))
  const changed = JSON.stringify(e.beam_deg) !== JSON.stringify(t.beam_deg) || (moving && (e.pan_deg !== (t.pan_deg ?? 540) || e.tilt_deg !== (t.tilt_deg ?? 270)))
  return (
    <div>
      <div className="apply">
        <b>{t.label}</b>
        <label>빛 각도 <Num step={1} value={e.beam_deg[0]} onChange={(x) => setE({ ...e, beam_deg: [x, e.beam_deg[1]] })} /></label>
        <label>~ <Num step={1} value={e.beam_deg[1]} onChange={(x) => setE({ ...e, beam_deg: [e.beam_deg[0], x] })} />°</label>
        {moving && <label>팬 <Num step={1} value={e.pan_deg} onChange={(x) => setE({ ...e, pan_deg: x })} />°</label>}
        {moving && <label>틸트 <Num step={1} value={e.tilt_deg} onChange={(x) => setE({ ...e, tilt_deg: x })} />°</label>}
        <button disabled={!!error || !changed} onClick={() => send({ t: 'editFixtureType', id: t.id, edit })}>저장</button>
      </div>
      {error && <p className="warn">{error}</p>}
    </div>
  )
}
