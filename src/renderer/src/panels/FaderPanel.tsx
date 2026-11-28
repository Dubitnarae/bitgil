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
        {show.scenes.some((s) => s.effects?.length) && (
          <label className={'effrate' + (st.effectRate !== 1 ? ' changed' : '')} title="돌고 있는 효과(〰) 전체를 한 번에 빠르게·느리게. 저장한 효과 속도는 그대로이고, 프로그램을 다시 켜면 1배로 돌아옵니다">
            〰 효과 속도
            <input type="range" min={0} max={300} step={5} value={Math.round(st.effectRate * 100)}
              onChange={(e) => send({ t: 'effectRate', value: Number(e.target.value) / 100 })} />
            <span>{st.effectRate === 0 ? '멈춤' : `×${st.effectRate.toFixed(2)}`}</span>
            {st.effectRate !== 1 && <button onClick={() => send({ t: 'effectRate', value: 1 })}>1배로</button>}
          </label>
        )}
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
