import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'

/** 씬 페이더 줄: 씬마다 페이더 하나. 콘솔처럼 올린 만큼 그 씬의 밝기가 나온다. */
export function FaderPanel({ show, st }: { show: Show; st: State }) {
  const live = st.faderMode === 'live'
  const levels = live ? st.faders : st.previewFaders
  return (
    <div className="faders">
      <div className="fader-head">
        <strong>씬 페이더</strong>
        <span className={'mode ' + st.faderMode}>{live ? '바로 반영' : '미리보기 → [적용]'}</span>
        <button onClick={() => send({ t: 'fadersDown' })}>모두 내리기</button>
      </div>
      <div className="fader-row">
        {show.scenes.map((s) => {
          const pct = Math.round((levels[s.id] ?? 0) * 100)
          return (
            <label key={s.id} className={'fader' + (pct > 0 ? ' up' : '')}>
              <span className="pct">{pct}%</span>
              <input type="range" min={0} max={100} value={pct} aria-label={`${s.name} 페이더`}
                onChange={(e) => send({ t: 'fader', id: s.id, value: Number(e.target.value) / 100 })} />
              <span className="name">{s.name}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
