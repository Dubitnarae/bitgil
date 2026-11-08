import { app, BrowserWindow, ipcMain } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Show } from '../core/engine/types'
import { Engine } from '../core/engine/engine'
import { VirtualOutput } from './dmx/output'
import { EnttecProOutput, listPorts } from './dmx/enttec'
import { runCommand, type Command } from './commands'
import { loadSettings, saveSettings } from './settings'

// shortcut: 지금은 시작 데이터만 읽음, 쇼 파일 저장·열기(문서\빛길, 백업 10개)는 다음 단계
const show: Show = JSON.parse(readFileSync(join(app.getAppPath(), 'data/starter-show.bitgil.json'), 'utf-8'))
const engine = new Engine(show)
const output = new VirtualOutput() // 채널 모니터용, 항상 마지막 프레임을 기억
const settings = loadSettings()
engine.faderMode = settings.faderMode
// 시작 기본은 '출력 대기'(장비로 안 보냄). 설정에서 '시작할 때 바로 출력'을 켰을 때만 바로 내보낸다.
const enttec = new EnttecProOutput(settings.dmxPort)
enttec.setEnabled(settings.outputOnStart)
let win: BrowserWindow | null = null

// DMX 출력 루프: 화면 그리기와 따로, 초당 40번(25ms) 일정하게 보낸다
setInterval(() => {
  const frame = engine.frame(Date.now())
  output.send(frame)
  enttec.send(frame)
}, 25)

function buildState() {
  const now = Date.now()
  return {
    live: engine.output(now),
    preview: engine.preview,
    previewOut: engine.previewOutput(),
    faders: engine.currentFaders(now),
    previewFaders: engine.previewFaders,
    faderMode: engine.faderMode,
    pending: engine.pending,
    master: engine.master,
    blackout: engine.blackout,
    fading: engine.fading,
    output: {
      enabled: enttec.enabled,
      connected: enttec.connected,
      port: enttec.path,
      error: enttec.error,
      preferred: enttec.preferred,
      onStart: settings.outputOnStart
    },
    frame: Array.from(output.last)
  }
}

// 화면에는 바뀌었을 때만 상태를 보낸다(초당 최대 20번). 처음 상태는 화면이 준비되면 직접 가져간다(state:get).
let lastSent = ''
setInterval(() => {
  if (!win) return
  const state = buildState()
  const json = JSON.stringify(state)
  if (json !== lastSent) win.webContents.send('state', state)
  lastSent = json
}, 50)

ipcMain.handle('show:get', () => show)
ipcMain.handle('state:get', () => buildState())
ipcMain.handle('ports:list', () => listPorts())
ipcMain.on('cmd', (_e, c: Command) => {
  try {
    // shortcut: 설정은 아직 PIN 없이 바꿀 수 있음, 편집 모드(PIN)를 만들 때 편집 모드에서만 허용
    if (c.t === 'output') return enttec.setEnabled(c.on)
    if (c.t === 'dmxPort') { enttec.setPreferred(c.path); return saveSettings({ ...settings, dmxPort: (settings.dmxPort = c.path) }) }
    if (c.t === 'outputOnStart') return saveSettings({ ...settings, outputOnStart: (settings.outputOnStart = c.on) })
    runCommand(engine, c, Date.now())
    if (c.t === 'faderMode') saveSettings({ ...settings, faderMode: (settings.faderMode = c.mode) })
  } catch (err) { console.error(err) }
})

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    title: '빛길',
    backgroundColor: '#111318',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  win.removeMenu()
  win.on('closed', () => (win = null))
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
})

app.on('window-all-closed', () => app.quit())
