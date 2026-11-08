import { useState } from 'react'
import type { CueStep, Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'

interface Props { show: Show; st: State; setFade: (n: number) => void }

/** 순서 목록: [다음]은 다음 줄을 미리보기에 올리고 페이드 시간을 맞춘다. 실제 조명은 [적용]으로. */
export function CuePanel({ show, st, setFade }: Props) {
  const [editing, setEditing] = useState(false)
  const [add, setAdd] = useState('')
  const list = show.cuelist
  const name = (id: string) => show.scenes.find((s) => s.id === id)?.name ?? id
  const load = (i: number) => { send({ t: 'cue', index: i }); setFade(list[i].fade) }
  const save = (l: CueStep[]) => send({ t: 'setCuelist', list: l })
  const move = (i: number, d: number) => {
    const l = [...list]
    ;[l[i], l[i + d]] = [l[i + d], l[i]]
    save(l)
  }
  const edit = editing && st.editMode
  const next = st.cue + 1

  return (
    <section className="panel">
      <h3>
        순서 목록
        {st.editMode && <button className="close" onClick={() => setEditing(!editing)}>{edit ? '편집 닫기' : '순서 편집'}</button>}
      </h3>
      {list.length === 0 ? (
        <p className="hint">순서 목록이 비어 있습니다. [편집 모드]에서 씬을 차례대로 추가하세요.</p>
      ) : (
        <>
          <p className="hint">[다음]은 다음 순서를 미리보기에 올립니다. [적용]을 눌러야 실제 조명이 바뀝니다.</p>
          <div className="apply">
            <button disabled={st.cue <= 0} onClick={() => load(st.cue - 1)}>◀ 이전</button>
            <button className="go" disabled={next >= list.length} onClick={() => load(next)}>
              다음 ▶ {next < list.length ? `${next + 1}. ${name(list[next].scene)}` : '(끝)'}
            </button>
          </div>
        </>
      )}
      <ol className="cuelist">
        {list.map((c, i) => (
          <li key={i} className={i === st.cue ? 'on' : ''}>
            <button className="cue" title="누르면 이 순서를 미리보기에 올립니다" onClick={() => load(i)}>
              {i + 1}. {name(c.scene)}
            </button>
            {edit ? (
              <>
                <input type="number" min={0} max={60} step={0.5} defaultValue={c.fade} key={c.fade} title="페이드 초"
                  onBlur={(e) => Number(e.target.value) !== c.fade && save(list.map((x, j) => (j === i ? { ...x, fade: Number(e.target.value) } : x)))} />
                <button disabled={i === 0} onClick={() => move(i, -1)} title="위로">↑</button>
                <button disabled={i === list.length - 1} onClick={() => move(i, 1)} title="아래로">↓</button>
                <button onClick={() => save(list.filter((_, j) => j !== i))}>빼기</button>
              </>
            ) : (
              <span className="hint">{c.fade}초</span>
            )}
          </li>
        ))}
      </ol>
      {edit && (
        <div className="apply">
          <select value={add} onChange={(e) => setAdd(e.target.value)}>
            <option value="">씬 고르기…</option>
            {show.scenes.map((s) => <option key={s.id} value={s.id}>{s.temp ? '임시 · ' : ''}{s.name}</option>)}
          </select>
          <button disabled={!add} onClick={() => { save([...list, { scene: add, fade: show.scenes.find((s) => s.id === add)!.fade_seconds }]); setAdd('') }}>
            맨 끝에 추가
          </button>
        </div>
      )}
    </section>
  )
}
