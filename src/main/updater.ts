import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { notesText, today } from './releaseNotes'

// 안전 규칙: 새 버전은 받아 두기만 하고, 운영 중에는 설치하지 않는다. 사용자가 프로그램을 끌 때 설치된다.
// 확인은 하루에 한 번만(설정 lastUpdateCheck), 설정에서 자동 업데이트를 끄면 확인도 설치도 안 한다.
export const update = {
  text: '',
  /** 켤 때 알릴 새 버전(화면이 안내 창으로 보여 줌) */
  notice: null as null | { version: string; notes: string }
}

export function startUpdater(opt: { on: boolean; lastCheck: string; checked: (day: string) => void }) {
  autoUpdater.autoInstallOnAppQuit = opt.on
  if (!app.isPackaged || !opt.on || opt.lastCheck === today()) return
  autoUpdater.autoDownload = true
  autoUpdater.on('update-not-available', () => opt.checked(today()))
  autoUpdater.on('update-available', (i) => {
    opt.checked(today())
    update.notice = { version: i.version, notes: notesText(i.releaseNotes) }
    update.text = `새 버전 v${i.version} 받는 중`
  })
  autoUpdater.on('download-progress', (p) => (update.text = `새 버전 받는 중 ${Math.round(p.percent)}%`))
  autoUpdater.on('update-downloaded', (i) => (update.text = `새 버전 v${i.version} 준비됨 — 프로그램을 끄면 설치`))
  autoUpdater.on('error', (err) => { update.text = ''; console.error('업데이트 확인 실패', err) }) // 인터넷 없어도 운영엔 영향 없음, 다음 실행 때 다시 확인
  autoUpdater.checkForUpdates().catch(() => {})
}

/** 설정에서 자동 업데이트를 끄면 받아 둔 것도 끌 때 설치하지 않는다 */
export function setAutoInstall(on: boolean) { autoUpdater.autoInstallOnAppQuit = on }
