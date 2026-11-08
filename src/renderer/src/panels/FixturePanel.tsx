import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'

const ATTRS: [string, string][] = [
  ['dimmer', '밝기'], ['red', '빨강'], ['green', '초록'], ['blue', '파랑'], ['white', '흰색'],
  ['pan', '팬(좌우)'], ['tilt', '틸트(위아래)'], ['zoom', '줌'], ['shutter', '셔터']
]

interface Props { show: Show; st: State; selected: string[]; setSelected: (ids: string[]) => void }

export function FixturePanel({ show, st, selected, setSelected }: Props) {
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
      <p className="hint">
        {selected.length ? `선택: ${selected.join(', ')}` : '3D 화면에서 조명을 누르세요 (Shift·Ctrl+클릭 = 여러 개)'}
      </p>
      {selected.length > 0 && ATTRS.map(([a, label]) => {
        const ids = selected.filter((id) => hasAttr(id, a))
        if (!ids.length) return null
        const v = st.preview[ids[0]]?.[a] ?? 0
        const set = (value: number) => send({ t: 'set', ids, attr: a, value })
        return (
          <label key={a} className="slider">
            <span>{label}</span>
            <input type="range" min={0} max={255} value={v} onChange={(e) => set(Number(e.target.value))} />
            <input type="number" min={0} max={255} value={v} onChange={(e) => set(Number(e.target.value))} />
          </label>
        )
      })}
    </section>
  )
}
