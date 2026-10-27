/// <reference lib="dom" />
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dailywork', {
  platform: process.platform,
  remote: process.argv.includes('--dailywork-remote'),
  revealDataDir: () => ipcRenderer.invoke('dailywork:reveal-data-dir'),
  restart: () => ipcRenderer.invoke('dailywork:restart'),
  version: () => ipcRenderer.invoke('dailywork:version'),
  dataDir: () => ipcRenderer.invoke('dailywork:data-dir'),
  serverUrl: () => ipcRenderer.invoke('dailywork:server-url'),
  pickBackup: () => ipcRenderer.invoke('dailywork:pick-backup') as Promise<string | null>,
  connection: {
    get: () => ipcRenderer.invoke('dailywork:connection-get') as Promise<string>,
    test: (url: string) =>
      ipcRenderer.invoke('dailywork:connection-test', url) as Promise<{
        ok: boolean
        url?: string
        version?: string
        error?: string
      }>,
    save: (url: string) =>
      ipcRenderer.invoke('dailywork:connection-save', url) as Promise<{
        ok: boolean
        url?: string
        version?: string
        error?: string
      }>,
    open: () => ipcRenderer.invoke('dailywork:connection-open'),
  },
})

window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('desktop')
})
