import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { notesText, today } from './releaseNotes'

// 새 버전은 사용자가 고른 대로만: [받아 두고 끌 때 설치] / [나중에] / [이 버전 건너뛰기].
// 받아 둔 것도 운영 중에는 설치하지 않고 프로그램을 끌 때 설치한다(안전 규칙).
// 확인은 하루에 한 번만(설정 lastUpdateCheck), 설정에서 자동 업데이트를 끄면 확인하지 않는다.
export const update = {
  text: '',
  /** 켤 때 찾은 새 버전(화면이 안내 상자로 묻는다). 고르면 null */
  notice: null as null | { version: string; notes: string }
}
export type UpdateChoice = 'install' | 'later' | 'skip'

export function startUpdater(opt: { on: boolean; lastCheck: string; skip: string; checked: (day: string) => void }) {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = opt.on
  if (!app.isPackaged || !opt.on || opt.lastCheck === today()) return
  autoUpdater.on('update-not-available', () => opt.checked(today()))
  autoUpdater.on('update-available', (i) => {
    opt.checked(today())
    if (i.version !== opt.skip) update.notice = { version: i.version, notes: notesText(i.releaseNotes) }
  })
  autoUpdater.on('download-progress', (p) => (update.text = `새 버전 받는 중 ${Math.round(p.percent)}%`))
  autoUpdater.on('update-downloaded', (i) => (update.text = `새 버전 v${i.version} 준비됨 — 프로그램을 끄면 설치`))
  autoUpdater.on('error', (err) => { update.text = ''; console.error('업데이트 확인 실패', err) }) // 인터넷 없어도 운영엔 영향 없음, 다음 실행 때 다시 확인
  autoUpdater.checkForUpdates().catch(() => {})
}

/** 안내 상자에서 고른 것. 건너뛸 버전을 돌려주면 설정에 저장한다 */
export function chooseUpdate(choice: UpdateChoice): string | undefined {
  const n = update.notice
  update.notice = null
  if (!n) return
  if (choice === 'install') {
    update.text = `새 버전 v${n.version} 받는 중`
    autoUpdater.downloadUpdate().catch(() => (update.text = ''))
  }
  if (choice === 'skip') return n.version
}

/** 설정에서 자동 업데이트를 끄면 받아 둔 것도 끌 때 설치하지 않는다 */
export function setAutoInstall(on: boolean) { autoUpdater.autoInstallOnAppQuit = on }
