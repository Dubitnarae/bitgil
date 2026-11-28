import type { Show } from '../../core/engine/types'
import type { State } from './api'

/** 따라하기 한 단계. target = 깜빡여 짚어 줄 버튼(data-guide 값) */
export interface Step { title: string; text: string; done: boolean; target: string }

/** 처음 쓰는 사람용 따라하기: 지금 상태만 보고 단계마다 됐는지 판단 */
export function guideSteps(st: State, show: Show): Step[] {
  const o = st.output
  const def = show.scenes.find((s) => s.id === show.default_scene) ?? show.scenes[0]
  const on = (id?: string) => !!id && (st.faders[id] ?? 0) > 0 && !st.blackout
  const cue = show.cuelist[st.cue]
  return [
    {
      title: '출력 켜기',
      text: !o.enabled ? '위쪽 [출력 켜기]를 누르세요. 옆 칸이 "출력 중"으로 바뀌면 실제 조명으로 나갑니다.'
        : !o.connected ? '출력은 켰지만 장비가 연결되지 않았습니다. 노트북의 DMX USB 선을 확인하세요(꽂으면 2초 안에 저절로 이어짐).'
        : `출력 중(${o.port})입니다.`,
      done: o.enabled && o.connected,
      target: 'output'
    },
    {
      title: '기본 조명 켜기',
      text: st.blackout ? '블랙아웃이 켜져 있습니다. 위쪽 [블랙아웃 해제]를 먼저 누르세요.'
        : `위쪽 [기본 조명]을 누르세요(키보드 H). 평소 조명${def ? `(${def.name})` : ''}이 바로 켜집니다. 급할 때도 이 버튼입니다.`,
      done: on(def?.id),
      target: st.blackout ? 'blackout' : 'default'
    },
    show.cuelist.length
      ? {
          title: '순서대로 진행',
          text: st.pending ? '미리보기에 올라갔습니다. 초록 [적용]을 누르면 실제 조명이 바뀝니다.'
            : '순서 목록 [다음 ▶]을 누르면 다음 순서가 미리보기(3D)에 올라갑니다. 확인하고 [적용]을 누르세요.',
          done: !!cue && on(cue.scene) && !st.pending,
          target: st.pending ? 'apply' : 'next'
        }
      : {
          title: '씬 켜기',
          text: st.pending ? '미리보기에 올라갔습니다. 초록 [적용]을 누르면 실제 조명이 바뀝니다.'
            : '순서 목록이 비어 있습니다. 씬 버튼을 하나 누르면 미리보기(3D)에 올라가고, [적용]을 누르면 실제 조명이 바뀝니다.',
          done: show.scenes.some((s) => s.id !== def?.id && on(s.id)) && !st.pending,
          target: st.pending ? 'apply' : 'scenes'
        }
  ]
}
