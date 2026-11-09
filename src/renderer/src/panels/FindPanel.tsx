import { useState } from 'react'
import type { Fixture, Show } from '../../../core/engine/types'
import { overlaps, type FixtureEdit } from '../../../core/engine/patch'
import type { State } from '../api'
import { send } from '../api'

const DIRS: [Fixture['direction'], string][] = [
  ['down', '천장 · 아래로'], ['aimed', '천장 · 한 곳을 겨눔'], ['up', '바닥 · 위로'], ['pan_tilt', '바닥 · 무빙(팬·틸트)']
]

interface Props { show: Show; st: State; selected: string[] }

/** 조명 찾기(편집 모드 전용): 조명 하나만 바로 켜서 실물과 맞춰 보고, 다르면 고친다. */
export function FindPanel({ show, st, selected }: Props) {
  const list = show.fixtures
  const i = list.findIndex((f) => f.id === st.find)
  const go = (id: string | null) => send({ t: 'find', id })
  const nextUnverified = () => {
    for (let k = 1; k <= list.length; k++) {
      const f = list[(i + k) % list.length]
      if (!f.verified) return go(f.id)
    }
  }

  if (!st.find) {
    const start = selected[0] ?? list.find((f) => !f.verified)?.id ?? list[0].id
    return (
      <section className="panel">
        <h3>조명 찾기</h3>
        <p className="hint">
          조명 하나만 흰색으로 바로 켜고 나머지는 끕니다(실제 조명이 바로 바뀝니다).
          [찾기 끝]을 누르면 원래 조명으로 돌아갑니다. 예배가 없는 날 [출력 켜기] 후 하세요.
        </p>
        <button className="go" onClick={() => go(start)}>조명 찾기 시작 ({start})</button>
        <p className="hint">확인됨 {list.filter((f) => f.verified).length} / {list.length}대</p>
      </section>
    )
  }

  const f = list[i]
  return (
    <section className="panel find">
      <h3>
        조명 찾기 · 지금 켜진 조명 <span className="badge">{f.id}</span>
        <button className="close" onClick={() => go(null)}>찾기 끝</button>
      </h3>
      {!st.output.enabled && <p className="warn">출력 대기 중이라 실제 조명은 안 켜집니다. 위 [출력 켜기]를 누르세요.</p>}
      {st.blackout && <p className="warn">블랙아웃 중이라 조명이 꺼져 있습니다.</p>}
      <div className="apply">
        <button onClick={() => go(list[(i - 1 + list.length) % list.length].id)}>◀ 이전</button>
        <button onClick={() => go(list[(i + 1) % list.length].id)}>다음 ▶</button>
        <button onClick={nextUnverified}>다음 미확인 ▶</button>
      </div>
      <div className="chips findlist">
        {list.map((x) => (
          <button key={x.id} className={(x.id === f.id ? 'act ' : '') + (x.verified ? 'ok' : '')} onClick={() => go(x.id)}
            title={x.verified ? '확인됨' : '아직 확인 안 됨'}>{x.verified ? '✓' : ''}{x.id}</button>
        ))}
      </div>
      <FixtureEditor key={f.id + JSON.stringify(f)} show={show} f={f} />
    </section>
  )
}

function FixtureEditor({ show, f }: { show: Show; f: Fixture }) {
  const type = show.fixture_types.find((t) => t.id === f.type)
  const count = type?.channel_count ?? 1
  const [addr, setAddr] = useState(String(f.address))
  const [pos, setPos] = useState({ x: String(f.position.x), y: String(f.position.y), z: String(f.position.z) })
  // 조준점이 없으면 조명 바로 아래 바닥을 처음 값으로
  const aim0 = f.aim ?? { x: f.position.x, y: 0, z: f.position.z }
  const [aim, setAim] = useState({ x: String(aim0.x), y: String(aim0.y), z: String(aim0.z) })
  const sameLine = show.fixtures.filter((o) => o.id !== f.id && (o.batten ?? '') === (f.batten ?? ''))
  const [other, setOther] = useState(sameLine[0]?.id ?? '')
  const clash = overlaps(show, f.id)
  const edit = (e: FixtureEdit) => send({ t: 'editFixture', id: f.id, edit: e })
  const a = Number(addr)
  const addrOk = Number.isInteger(a) && a >= 1 && a + count - 1 <= 512

  return (
    <div className="settings">
      <div className="group">
        <h4>확인</h4>
        <p className="hint">{type?.label} · DMX {f.address}~{f.address + count - 1} · {f.batten ?? '바닥'}</p>
        <label className="radio">
          <input type="checkbox" checked={f.verified} onChange={(e) => edit({ verified: e.target.checked })} />
          {' '}실물과 맞음(확인됨) — 3D의 점선 테두리가 사라집니다
        </label>
      </div>
      <div className="group">
        <h4>DMX 주소</h4>
        <div className="apply">
          <input type="number" min={1} max={513 - count} value={addr} onChange={(e) => setAddr(e.target.value)} />
          <button disabled={!addrOk || a === f.address} onClick={() => edit({ address: a })}>주소 바꾸기</button>
        </div>
        {!addrOk && <p className="warn">주소는 1~{513 - count} 사이로 넣으세요.</p>}
        {clash.length > 0 && <p className="warn">채널이 겹치는 조명: {clash.join(', ')}</p>}
      </div>
      <div className="group">
        <h4>3D 위치 (m)</h4>
        <p className="hint">x 오른쪽 · y 높이 · z 좌석 쪽 (왼쪽 벽·정면 벽 모서리 통로 바닥 기준)</p>
        <div className="apply">
          {(['x', 'y', 'z'] as const).map((k) => (
            <label key={k}>{k} <input type="number" step={0.1} value={pos[k]} onChange={(e) => setPos({ ...pos, [k]: e.target.value })} /></label>
          ))}
          <button onClick={() => edit({ position: { x: Number(pos.x), y: Number(pos.y), z: Number(pos.z) } })}>위치 저장</button>
        </div>
      </div>
      <div className="group">
        <h4>설치 방향</h4>
        <select value={f.direction} onChange={(e) => edit({ direction: e.target.value as Fixture['direction'] })}>
          {DIRS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        {f.direction === 'aimed' && <>
          <p className="hint">조준점(빛이 닿는 곳, m){f.aim ? '' : ' — 아직 없음, 저장하면 3D 빛이 그쪽을 향합니다'}</p>
          <div className="apply">
            {(['x', 'y', 'z'] as const).map((k) => (
              <label key={k}>{k} <input type="number" step={0.1} min={0} value={aim[k]} onChange={(e) => setAim({ ...aim, [k]: e.target.value })} /></label>
            ))}
            <button disabled={(['x', 'y', 'z'] as const).some((k) => aim[k] === '' || Number(aim[k]) < 0)}
              onClick={() => edit({ aim: { x: Number(aim.x), y: Number(aim.y), z: Number(aim.z) } })}>조준점 저장</button>
          </div>
        </>}
      </div>
      <div className="group">
        <h4>다른 조명과 자리 바꾸기</h4>
        <p className="hint">켜진 조명이 3D에서 다른 조명 자리에 있으면, 그 조명과 위치·방향을 맞바꿉니다(주소는 그대로).</p>
        <div className="apply">
          <select value={other} onChange={(e) => setOther(e.target.value)}>
            {sameLine.length > 0 && <optgroup label={`같은 줄 (${f.batten ?? '바닥'})`}>{sameLine.map((o) => <option key={o.id} value={o.id}>{o.id}</option>)}</optgroup>}
            <optgroup label="다른 줄">
              {show.fixtures.filter((o) => o.id !== f.id && !sameLine.includes(o)).map((o) => <option key={o.id} value={o.id}>{o.id} ({o.batten ?? '바닥'})</option>)}
            </optgroup>
          </select>
          <button disabled={!other} onClick={() => send({ t: 'swapFixtures', a: f.id, b: other })}>자리 바꾸기</button>
        </div>
      </div>
    </div>
  )
}

/** 채널 시험(편집 모드 전용): DMX 채널 하나만 바로 내보내 주소·배선을 확인한다. 나머지 채널은 모두 0. */
export function ChannelTest({ st }: { st: State }) {
  const [ch, setCh] = useState(1)
  const [value, setValue] = useState(255)
  const t = st.chTest
  const go = (c: number, v = value) => send({ t: 'chTest', ch: ((c - 1 + 512) % 512) + 1, value: v })
  if (!t) return (
    <section className="panel">
      <h3>채널 시험</h3>
      <p className="hint">DMX 채널 하나만 바로 켜고 나머지는 모두 끕니다(실제 조명이 바로 바뀝니다).
        밝기 채널이 따로 있는 조명은 그 채널만으로는 안 켜질 수 있습니다 — 그때는 위 조명 찾기를 쓰세요.</p>
      <div className="apply">
        <label>채널 <input type="number" min={1} max={512} value={ch} onChange={(e) => setCh(Number(e.target.value))} /></label>
        <button className="go" onClick={() => go(ch)}>시험 시작</button>
      </div>
    </section>
  )
  return (
    <section className="panel find">
      <h3>채널 시험 · 지금 켜진 채널 <span className="badge">{t.ch}</span>
        <button className="close" onClick={() => { setCh(t.ch); send({ t: 'chTest', ch: null }) }}>시험 끝</button></h3>
      {!st.output.enabled && <p className="warn">출력 대기 중이라 실제 조명은 안 켜집니다. 위 [출력 켜기]를 누르세요.</p>}
      {st.blackout && <p className="warn">블랙아웃 중이라 0으로 나갑니다.</p>}
      <div className="apply">
        <button onClick={() => go(t.ch - 1)}>◀ 이전</button>
        <button onClick={() => go(t.ch + 1)}>다음 ▶</button>
        <label>값 <input type="range" min={0} max={255} value={t.value}
          onChange={(e) => { const v = Number(e.target.value); setValue(v); go(t.ch, v) }} /> {t.value}</label>
      </div>
    </section>
  )
}
