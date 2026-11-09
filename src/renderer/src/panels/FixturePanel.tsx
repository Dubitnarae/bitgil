import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'

const ATTRS: [string, string][] = [
  ['dimmer', '밝기'], ['red', '빨강'], ['green', '초록'], ['blue', '파랑'], ['white', '흰색'],
  ['pan', '팬(좌우)'], ['tilt', '틸트(위아래)'], ['zoom', '줌'], ['shutter', '셔터']
]

interface Props {
  show: Show; st: State; selected: string[]; setSelected: (ids: string[]) => void
  /** 빛 위치 찍기: null = 꺼짐, 문자열 = 켜짐(마지막 결과) */
  aimMsg: string | null; setAimMsg: (m: string | null) => void
}

export function FixturePanel({ show, st, selected, setSelected, aimMsg, setAimMsg }: Props) {
  const types = new Map(show.fixture_types.map((t) => [t.id, t]))
  const hasAttr = (id: string, a: string) => {
    const f = show.fixtures.find((x) => x.id === id)
    return !!f && !!types.get(f.type)?.channels.some((c) => c.attr === a)
  }
  return (
    <section className="panel">
      <h3>조명 선택</h3>
      <div className="chips">
        {show.groups.map((g) => (
          <button key={g.id} onClick={() => setSelected(g.members)}>{g.label}</button>
        ))}
        <button onClick={() => setSelected(show.fixtures.map((f) => f.id))}>전체</button>
        <button onClick={() => setSelected([])}>선택 해제</button>
      </div>
      <button className="clear" onClick={() => send({ t: 'clearManual', ids: selected })}
        title="손으로 조정한 값을 지우고 씬 페이더 값으로 돌아갑니다(미리보기, [적용] 필요)">
        {selected.length ? '선택 조명 수동 조정 지우기' : '수동 조정 모두 지우기'}
      </button>
      <p className="hint">
        {selected.length ? `선택: ${selected.join(', ')}` : '3D 화면에서 조명을 누르세요 (Shift·Ctrl+클릭 = 여러 개)'}
      </p>
      {selected.length > 0 && <>
        <button className={'aimbtn' + (aimMsg !== null ? ' on' : '')} onClick={() => setAimMsg(aimMsg === null ? '' : null)}
          title="켜고 3D 화면의 바닥·벽·무대를 누르면 고른 조명이 그곳을 비춥니다">
          {aimMsg !== null ? '빛 위치 찍기 끄기' : '빛 위치 찍기'}
        </button>
        {aimMsg !== null && <p className="hint">{aimMsg || '3D 화면에서 비출 곳(바닥·벽·무대)을 누르세요. 무빙은 그쪽으로 돌고([적용] 필요), 고정 조명은 편집 모드에서 조준점이 저장됩니다.'}</p>}
      </>}
      {selected.length > 0 && ATTRS.map(([a, label]) => {
        const ids = selected.filter((id) => hasAttr(id, a))
        if (!ids.length) return null
        const v = st.previewOut[ids[0]]?.[a] ?? 0
        const manual = st.preview[ids[0]]?.[a] !== undefined
        const set = (value: number) => send({ t: 'set', ids, attr: a, value })
        return (
          <label key={a} className="slider">
            <span title={manual ? '손으로 조정한 값(씬보다 우선)' : '씬에서 온 값'}>{label}{manual ? ' ✎' : ''}</span>
            <input type="range" min={0} max={255} value={v} onChange={(e) => set(Number(e.target.value))} />
            <input type="number" min={0} max={255} value={v} onChange={(e) => set(Number(e.target.value))} />
          </label>
        )
      })}
    </section>
  )
}
