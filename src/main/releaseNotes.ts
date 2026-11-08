/** GitHub 릴리스 설명(HTML 또는 글)을 화면에 보일 평범한 글로 바꾼다 */
export function notesText(notes: unknown): string {
  const raw = Array.isArray(notes)
    ? notes.map((n) => (n && typeof n === 'object' && 'note' in n ? String(n.note ?? '') : '')).join('\n')
    : typeof notes === 'string' ? notes : ''
  return raw
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())
    .join('\n').trim()
}

/** 오늘 날짜(내 컴퓨터 기준, 'YYYY-MM-DD') — 하루 한 번 확인용 */
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
