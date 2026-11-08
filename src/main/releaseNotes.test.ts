import { describe, expect, it } from 'vitest'
import { notesText, today } from './releaseNotes'

describe('릴리스 설명 글로 바꾸기', () => {
  it('GitHub HTML을 줄 글로', () => {
    const html = '<p>3D 화면 개선</p>\n<ul>\n<li>무빙 &amp; 파</li>\n<li>렌즈 색</li>\n</ul>'
    expect(notesText(html)).toBe('3D 화면 개선\n- 무빙 & 파\n- 렌즈 색')
  })
  it('없거나 목록이어도 동작', () => {
    expect(notesText(null)).toBe('')
    expect(notesText([{ version: '1', note: '<p>가</p>' }, { version: '2', note: '나' }])).toBe('가\n나')
  })
  it('오늘 날짜', () => expect(today(new Date(2026, 10, 8))).toBe('2026-11-08'))
})
