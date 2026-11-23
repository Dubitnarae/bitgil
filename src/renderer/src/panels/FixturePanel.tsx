import { useState } from 'react'
import type { NamedColor, Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'
import { aimSave, aimStart, aimUndo, canUndo, type Aim } from '../aim'
import { PALETTE, hexToRgbw, paletteWith, rgbwToHex, sameColor } from '../../../core/engine/color'

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
  const [colorName, setColorName] = useState('')
  const hasAttr = (id: string, a: string) => {
    const f = show.fixtures.find((x) => x.id === id)
    return !!f && !!types.get(f.type)?.channels.some((c) => c.attr === a)
  }
  return (
    <section className="panel">
      <h3>조명 선택</h3>
      <div className="chips">
        {show.groups.map((g) => (
          // 배튼 그룹(RD1~3)은 저장된 목록 대신 지금 그 배튼에 달린 조명으로(자리 바꾸기 뒤에도 맞게)
          <button key={g.id} onClick={() => setSelected(show.venue.battens.some((b) => b.id === g.id)
            ? show.fixtures.filter((f) => f.batten === g.id).map((f) => f.id) : g.members)}>{g.label}</button>
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
        {aim && <button disabled={!canUndo(aim, st.editMode)} onClick={() => setAim(aimUndo(aim))}
          title="한 번 전으로(여러 번 가능): 무빙은 원래 팬·틸트로(미리보기), 고정 조명은 찍은 조준점을, [저장] 바로 뒤면 저장 전 방향·조준점으로 되돌림(편집 모드)">
          되돌리기{aim.history.length ? ` (${aim.history.length})` : ''}</button>}
        {aim && unsaved > 0 && <button className="aimbtn on" disabled={!st.editMode} onClick={() => setAim(aimSave(aim, show))}
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
        const cur = COLOR.map((a) => o[a] ?? 0) as NamedColor['rgbw']
        const mine = show.colors ?? []
        const colors = paletteWith(mine)
        const now = colors.find((c) => sameColor(c.rgbw, cur, hasAttr(rgbIds[0], 'white')))
        const saveColor = () => {
          const name = colorName.trim()
          if (!name) return
          const builtIn = PALETTE.some((c) => c.name === name)
          if (builtIn && !confirm(`기본 색 '${name}' 값을 지금 색으로 바꿀까요? (실물에 맞춘 값으로 쓰기)`)) return
          send({ t: 'setColors', list: [...mine.filter((c) => c.name !== name), { name, rgbw: cur }] })
          setColorName('')
        }
        const removeColor = (c: NamedColor) => {
          const base = PALETTE.some((p) => p.name === c.name)
          if (confirm(base ? `'${c.name}'을 기본 값으로 되돌릴까요?` : `내 색 '${c.name}'을 지울까요?`)) send({ t: 'setColors', list: mine.filter((m) => m.name !== c.name) })
        }
        return (
          <div className="palette">
            {colors.map((c) => (
              <button key={c.name} className={'swatch' + (c.mine ? ' mine' : '') + (c === now ? ' on' : '')}
                title={`${c.name}${c.mine ? ' (내 값, 오른쪽 클릭 = ' + (PALETTE.some((p) => p.name === c.name) ? '기본 값으로)' : '지우기)') : ''} — 누르면 고른 조명 색이 바뀝니다(미리보기, [적용] 필요)`}
                aria-label={c.name} style={{ background: rgbwToHex(c.rgbw) }} onClick={() => put(c.rgbw)}
                onContextMenu={c.mine ? (e) => { e.preventDefault(); removeColor(c) } : undefined} />
            ))}
            <input type="color" title="원하는 색 고르기" aria-label="원하는 색 고르기"
              value={rgbwToHex(cur)} onChange={(e) => put(hexToRgbw(e.target.value))} />
            <div className="apply">
              <span className="hint">지금: <b>{now ? now.name : rgbwToHex(cur)}</b></span>
              <input className="name" value={colorName} placeholder="색 이름" maxLength={20} onChange={(e) => setColorName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveColor()} />
              <button disabled={!colorName.trim()} onClick={saveColor}
                title="지금 색(아래 빨강·초록·파랑·흰색 값)을 팔레트에 저장. '따뜻한 흰색'·'호박색'처럼 기본 색 이름으로 저장하면 그 버튼 값이 바뀝니다">내 색 저장</button>
            </div>
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
