import { useEffect, useState } from 'react'
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
  // 자동 진행 남은 초는 화면에서 1초마다 다시 센다(상태는 넘어갈 시각만 옴)
  // shortcut: 원격 화면은 그 기기 시계로 세므로 시계가 다르면 남은 초가 어긋남, 문제 되면 메인에서 남은 ms 를 보낼 것
  const [, tick] = useState(0)
  useEffect(() => { if (st.autoAt === null) return; const h = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(h) }, [st.autoAt])
  const left = st.autoAt === null ? 0 : Math.max(0, Math.ceil((st.autoAt - Date.now()) / 1000))

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
          <div className="apply">
            {st.autoAt !== null
              ? <button className="on" onClick={() => send({ t: 'autoCue', on: false })}>■ 자동 멈춤 · 다음까지 {left}초</button>
              : <button disabled={next >= list.length} title="다음 줄부터 바로 실제 조명으로 나가고, 줄마다 정한 초가 지나면 다음 줄로 넘어갑니다. 초를 안 정한 줄에서 멈춥니다. 블랙아웃이나 순서를 손으로 고르면 멈춥니다."
                  onClick={() => send({ t: 'autoCue', on: true })}>▶ 자동 진행 (다음 줄부터 바로 실제 조명)</button>}
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
                <input type="number" min={0} max={3600} step={1} defaultValue={c.auto ?? 0} key={'a' + (c.auto ?? 0)} title="자동 진행: 이 줄이 나간 뒤 몇 초 지나면 다음 줄로 (0 = 여기서 멈춤)"
                  onBlur={(e) => Number(e.target.value) !== (c.auto ?? 0) && save(list.map((x, j) => (j === i ? { ...x, auto: Number(e.target.value) } : x)))} />
                <button disabled={i === 0} onClick={() => move(i, -1)} title="위로">↑</button>
                <button disabled={i === list.length - 1} onClick={() => move(i, 1)} title="아래로">↓</button>
                <button onClick={() => save(list.filter((_, j) => j !== i))}>빼기</button>
              </>
            ) : (
              <span className="hint">{c.fade}초{c.auto ? ` · 자동 ${c.auto}초` : ''}</span>
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
