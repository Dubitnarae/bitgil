import { contextBridge, ipcRenderer } from 'electron'

// 이름은 메인의 api 와 원격 전체 화면 연결 스크립트(src/main/remote/page.ts BRIDGE)와 같아야 한다
const call = (name: string) => (...args: unknown[]) => ipcRenderer.invoke('api', name, ...args)

contextBridge.exposeInMainWorld('bitgil', {
  getShow: call('getShow'),
  getState: call('getState'),
  listPorts: call('listPorts'),
  udmxDriverState: call('udmxDriverState'),
  udmxInstallDriver: call('udmxInstallDriver'),
  send: (cmd: unknown) => ipcRenderer.send('cmd', cmd),
  unlock: call('unlock'),
  setPin: call('setPin'),
  pinEnabled: call('pinEnabled'),
  lock: call('lock'),
  xhdImport: call('xhdImport'),
  xhdExport: call('xhdExport'),
  showExport: call('showExport'),
  showImport: call('showImport'),
  onShow: (cb: (s: unknown) => void) => {
    const h = (_e: unknown, s: unknown) => cb(s)
    ipcRenderer.on('show', h)
    return () => ipcRenderer.off('show', h)
  },
  onState: (cb: (s: unknown) => void) => {
    const h = (_e: unknown, s: unknown) => cb(s)
    ipcRenderer.on('state', h)
    return () => ipcRenderer.off('state', h)
  }
})
