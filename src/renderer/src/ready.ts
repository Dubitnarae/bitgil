import type { Show } from '../../core/engine/types'
import type { State } from './api'

export type Level = 'ok' | 'warn' | 'bad' | 'info'
export interface Check { name: string; level: Level; text: string }

/** 예배 준비 점검: 지금 상태만 보고 판단(장비·파일을 새로 건드리지 않음) */
export function readyChecks(st: State, show: Show): Check[] {
  const o = st.output
  const def = show.scenes.find((s) => s.id === show.default_scene)
  const r = st.remote
  return [
    {
      name: '출력',
      ...(!o.enabled ? { level: 'warn' as Level, text: '출력 대기 중입니다. 위쪽 [출력 켜기]를 눌러야 조명이 나갑니다.' }
        : !o.connected ? { level: 'bad' as Level, text: `DMX 장비가 연결되지 않았습니다. USB 선을 확인해 주세요.${o.error ? ' — ' + o.error : ''}` }
        : st.blackout ? { level: 'warn' as Level, text: `출력 중(${o.port})이지만 블랙아웃이 켜져 있습니다.` }
        : { level: 'ok' as Level, text: `출력 중 · ${o.port}${st.master < 1 ? ` · 전체 밝기 ${Math.round(st.master * 100)}%` : ''}` })
    },
    {
      name: '쇼 파일',
      ...(st.saveError ? { level: 'bad' as Level, text: st.saveError }
        : { level: 'ok' as Level, text: `저장 문제 없음 · 씬 ${show.scenes.length}개 · 순서 ${show.cuelist.length}줄` })
    },
    {
      name: '기본 조명',
      ...(def ? { level: 'ok' as Level, text: `${def.name} (H 키)` }
        : { level: 'warn' as Level, text: `아직 안 정했습니다. 지금은 첫 씬(${show.scenes[0]?.name ?? '없음'})이 켜집니다. 편집 모드 → 설정에서 고르세요.` })
    },
    {
      name: 'PIN',
      ...(!st.pinEnabled || !st.pinSet ? { level: 'warn' as Level, text: '꺼져 있습니다. 누구나 편집 모드를 열 수 있습니다(예배 중 실수 주의).' }
        : st.editMode ? { level: 'warn' as Level, text: '켜져 있지만 지금 편집 모드가 열려 있습니다. 예배 전 [편집 모드 닫기]를 권합니다.' }
        : { level: 'ok' as Level, text: '켜짐 · 운영 모드' })
    },
    {
      name: '폰 원격',
      ...(!r.on ? { level: 'info' as Level, text: '꺼져 있습니다(폰으로 조작하지 않으면 괜찮음).' }
        : r.error ? { level: 'bad' as Level, text: r.error }
        : { level: 'ok' as Level, text: `켜짐 · 접속 코드 ${r.code} · 연결된 기기 ${r.clients}대${r.urls[0] ? ' · ' + r.urls[0] : ''}` })
    }
  ]
}
