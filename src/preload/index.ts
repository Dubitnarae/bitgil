import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bitgil', {
  getShow: () => ipcRenderer.invoke('show:get'),
  getState: () => ipcRenderer.invoke('state:get'),
  send: (cmd: unknown) => ipcRenderer.send('cmd', cmd),
  onState: (cb: (s: unknown) => void) => {
    const h = (_e: unknown, s: unknown) => cb(s)
    ipcRenderer.on('state', h)
    return () => ipcRenderer.off('state', h)
  }
})
