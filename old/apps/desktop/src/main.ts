import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell,
  dialog,
} from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

app.setName('Dailywork')
app.setAppUserModelId('com.dailywork.app')

const isDev = !app.isPackaged
const dataDir = process.env.DAILYWORK_DATA_DIR ?? join(app.getPath('appData'), 'Dailywork')
mkdirSync(dataDir, { recursive: true, mode: 0o700 })

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let serverUrl: string | null = null
let allowedOrigin: string | null = null

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
}

function stateFile(): string {
  return join(dataDir, 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')) as WindowState
  } catch {
    return { width: 1440, height: 960 }
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds()
    writeFileSync(stateFile(), JSON.stringify(bounds), { mode: 0o600 })
  } catch {
    // ignore
  }
}

function connectionFile(): string {
  return join(dataDir, 'connection.json')
}

function normalizeServerUrl(raw: string): string {
  const value = raw.trim()
  if (!value) throw new Error('请输入服务器地址')
  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new Error('服务器地址格式不正确')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('服务器地址必须以 http:// 或 https:// 开头')
  }
  if (!parsed.hostname) throw new Error('服务器地址缺少主机名')
  return parsed.origin
}

function readServerUrl(): string {
  const env = process.env.DAILYWORK_SERVER_URL
  if (env) {
    try {
      return normalizeServerUrl(env)
    } catch {
      // fall through to the saved value
    }
  }
  try {
    const raw = JSON.parse(readFileSync(connectionFile(), 'utf8')) as { serverUrl?: string }
    if (raw.serverUrl) return normalizeServerUrl(raw.serverUrl)
  } catch {
    // no saved connection yet
  }
  return 'http://127.0.0.1:47821'
}

function saveServerUrl(url: string): void {
  writeFileSync(connectionFile(), JSON.stringify({ serverUrl: url }, null, 2), { mode: 0o600 })
}

async function probeServer(url: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const body = (await res.json()) as { version?: string }
    return { ok: true, version: body.version }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '无法连接服务器' }
  }
}

async function waitForUrl(url: string, timeoutMs = 20_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1200) })
      if (res.ok || res.status === 404) return true
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

async function navigateToServer(url: string): Promise<void> {
  const normalized = normalizeServerUrl(url)
  serverUrl = normalized
  allowedOrigin = new URL(normalized).origin
  saveServerUrl(normalized)
  await mainWindow?.loadURL(normalized)
}

async function showConnectionScreen(): Promise<void> {
  await mainWindow?.loadFile(join(app.getAppPath(), 'connection.html'))
}

async function resolveAppUrl(): Promise<string | null> {
  if (isDev && !process.env.DAILYWORK_SERVER_URL) {
    const url = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'
    const ok = await waitForUrl(url, 30_000)
    if (!ok) throw new Error(`Vite 开发服务器未就绪：${url}`)
    return url
  }
  const url = readServerUrl()
  return (await waitForUrl(url, 5000)) ? url : null
}

async function createWindow(): Promise<void> {
  const state = loadWindowState()
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 620,
    title: '时序 · Dailywork',
    backgroundColor: '#F5F7FA',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      additionalArguments:
        app.isPackaged || Boolean(process.env.DAILYWORK_SERVER_URL)
          ? ['--dailywork-remote']
          : [],
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('resize', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })
  mainWindow.on('move', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowed =
      url.startsWith('file://') ||
      (allowedOrigin !== null && (() => {
        try {
          return new URL(url).origin === allowedOrigin
        } catch {
          return false
        }
      })())
    if (!isAllowed) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })

  try {
    const url = await resolveAppUrl()
    if (!url) {
      await showConnectionScreen()
    } else {
      const remote = !isDev || Boolean(process.env.DAILYWORK_SERVER_URL)
      serverUrl = url
      allowedOrigin = new URL(url).origin
      if (remote) saveServerUrl(url)
      await mainWindow.loadURL(url)
    }
    if (isDev && process.env.DAILYWORK_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } catch (error) {
    if (app.isPackaged) {
      await showConnectionScreen()
    } else {
      dialog.showErrorBox(
        '无法启动时序',
        `${error instanceof Error ? error.message : String(error)}\n\n客户端目录：${dataDir}`,
      )
    }
  }
}

function createTray(): void {
  const trayIconPath = join(process.resourcesPath, 'tray.png')
  const devIconPath = join(__dirname, '..', 'build', 'tray.png')
  const icon = nativeImage.createFromPath(existsSync(trayIconPath) ? trayIconPath : devIconPath)
  tray = new Tray(icon.resize({ width: 18, height: 18 }))
  tray.setToolTip('时序 · Dailywork')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开时序',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        },
      },
      {
        label: '今天',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
          void mainWindow?.webContents.executeJavaScript("window.location.href='/today'")
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide()
    else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      {
        label: '服务器',
        submenu: [
          {
            label: '服务器连接…',
            click: () => {
              void showConnectionScreen()
            },
          },
          {
            label: '重新连接',
            click: () => {
              void navigateToServer(readServerUrl()).catch(() => {
                void showConnectionScreen()
              })
            },
          },
        ],
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  )
}

ipcMain.handle('dailywork:reveal-data-dir', async () => {
  return shell.openPath(dataDir)
})
ipcMain.handle('dailywork:restart', () => {
  quitting = true
  app.relaunch()
  app.exit(0)
})
ipcMain.handle('dailywork:version', () => app.getVersion())
ipcMain.handle('dailywork:data-dir', () => dataDir)
ipcMain.handle('dailywork:server-url', () => serverUrl ?? readServerUrl())
ipcMain.handle('dailywork:connection-get', () => serverUrl ?? readServerUrl())
ipcMain.handle('dailywork:connection-test', async (_event, raw: string) => {
  try {
    const url = normalizeServerUrl(raw)
    const result = await probeServer(url)
    return { ...result, url }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '地址无效' }
  }
})
ipcMain.handle('dailywork:connection-save', async (_event, raw: string) => {
  try {
    const url = normalizeServerUrl(raw)
    const result = await probeServer(url)
    if (!result.ok) return { ...result, url }
    await navigateToServer(url)
    return { ...result, url }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '保存失败' }
  }
})
ipcMain.handle('dailywork:connection-open', () => showConnectionScreen())
ipcMain.handle('dailywork:pick-backup', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择 .dailywork 备份',
    properties: ['openFile'],
    filters: [{ name: 'Dailywork 备份', extensions: ['dailywork'] }],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    buildMenu()
    createTray()
    await createWindow()
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (!mainWindow) return
      if (mainWindow.isVisible()) mainWindow.hide()
      else {
        mainWindow.show()
        mainWindow.focus()
      }
    })
    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      } else {
        void createWindow()
      }
    })
  })

  app.on('before-quit', () => {
    quitting = true
    globalShortcut.unregisterAll()
  })

  app.on('window-all-closed', () => {
    // Keep running in the menu bar on macOS.
  })
}
