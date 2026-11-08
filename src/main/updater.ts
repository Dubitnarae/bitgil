import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

// 안전 규칙: 새 버전은 받아 두기만 하고, 운영 중에는 설치하지 않는다. 사용자가 프로그램을 끌 때 설치된다.
export const update = { text: '' }

export function startUpdater() {
  if (!app.isPackaged) return // 개발 모드에선 확인 안 함
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('download-progress', (p) => (update.text = `새 버전 받는 중 ${Math.round(p.percent)}%`))
  autoUpdater.on('update-downloaded', (i) => (update.text = `새 버전 v${i.version} 받아 둠 — 프로그램을 끌 때 설치됩니다`))
  autoUpdater.on('error', (err) => { update.text = ''; console.error('업데이트 확인 실패', err) }) // 인터넷 없어도 운영엔 영향 없음
  autoUpdater.checkForUpdates().catch(() => {})
}
