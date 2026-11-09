import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'
import { aimSave, aimStart, aimUndo, type Aim } from '../aim'
import { PALETTE, hexToRgbw, rgbwToHex } from '../../../core/engine/color'

const ATTRS: [string, string][] = [
  ['dimmer', '밝기'], ['red', '빨강'], ['green', '초록'], ['blue', '파랑'], ['white', '흰색'],
  ['pan', '팬(좌우)'], ['tilt', '틸트(위아래)'], ['zoom', '줌'], ['shutter', '셔터']
]

const COLOR = ['red', 'green', 'blue', 'white']

interface Props {
  show: Show; st: State; selected: string[]; setSelected: (ids: string[]) => void
  /** 빛 위치 찍기: null = 꺼짐, 있으면 켜짐(마지막 결과·되돌리기) */
  aim: Aim | null; setAim: (a: Aim | null) => void
}

export function FixturePanel({ show, st, selected, setSelected, aim, setAim }: Props) {
  const types = new Map(show.fixture_types.map((t) => [t.id, t]))
  const unsaved = aim ? Object.keys(aim.drafts).length : 0
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
      {(selected.length > 0 || aim) && <>
        <button className={'aimbtn' + (aim ? ' on' : '')} onClick={() => {
          if (!aim) return setAim(aimStart())
          if (unsaved && !confirm(`저장하지 않은 고정 조명 조준점 ${unsaved}대를 버리고 끌까요?`)) return
          setAim(null)
        }} title="켜고 3D 화면의 바닥·벽·무대를 누르면 고른 조명이 그곳을 비춥니다">
          {aim ? '빛 위치 찍기 끄기' : '빛 위치 찍기'}
        </button>
        {aim && <button disabled={!aim.history.length} onClick={() => setAim(aimUndo(aim))}
          title="한 번 찍기 전으로(여러 번 가능): 무빙은 원래 팬·틸트로(미리보기), 고정 조명은 저장 안 한 조준점을 되돌림">
          되돌리기{aim.history.length ? ` (${aim.history.length})` : ''}</button>}
        {aim && unsaved > 0 && <button className="aimbtn on" disabled={!st.editMode} onClick={() => setAim(aimSave(aim))}
          title="찍은 고정 조명 조준점을 쇼 파일에 저장">저장 ({unsaved}대)</button>}
        {aim && <p className="hint">{!st.editMode && unsaved ? '편집 모드가 닫혀 저장할 수 없습니다. [편집 모드]를 다시 여세요. · ' : ''}
          {aim.msg || '3D 화면에서 비출 곳(바닥·벽·무대)을 누르세요. 무빙은 그쪽으로 돌고([적용] 필요), 고정 조명은 편집 모드에서 찍은 뒤 [저장]을 눌러야 저장됩니다.'}</p>}
      </>}
      {(() => {
        const rgbIds = selected.filter((id) => hasAttr(id, 'red'))
        if (!rgbIds.length) return null
        const withW = rgbIds.filter((id) => hasAttr(id, 'white'))
        const noW = rgbIds.filter((id) => !hasAttr(id, 'white'))
        const put = ([r, g, b, w]: number[]) => {
          if (withW.length) [r, g, b, w].forEach((value, i) => send({ t: 'set', ids: withW, attr: COLOR[i], value }))
          // 흰색 채널이 없는 조명은 W를 R·G·B에 더해서
          if (noW.length) [r + w, g + w, b + w].forEach((value, i) => send({ t: 'set', ids: noW, attr: COLOR[i], value: Math.min(255, value) }))
        }
        const o = st.previewOut[rgbIds[0]] ?? {}
        return (
          <div className="palette" title="누르면 고른 조명 색이 바뀝니다(미리보기, [적용] 필요)">
            {PALETTE.map((c) => (
              <button key={c.name} className="swatch" title={c.name} aria-label={c.name}
                style={{ background: rgbwToHex(c.rgbw) }} onClick={() => put(c.rgbw)} />
            ))}
            <input type="color" title="원하는 색 고르기" aria-label="원하는 색 고르기"
              value={rgbwToHex(COLOR.map((a) => o[a] ?? 0))} onChange={(e) => put(hexToRgbw(e.target.value))} />
          </div>
        )
      })()}
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
