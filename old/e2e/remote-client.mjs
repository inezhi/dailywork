import { _electron as electron } from 'playwright'
import { rmSync } from 'node:fs'

const executablePath = process.env.APP_PATH
const serverUrl = process.env.SERVER_URL ?? 'http://127.0.0.1:47821'
const dataDir = process.env.CLIENT_DATA_DIR ?? '/tmp/dw-remote-client'
if (!executablePath) throw new Error('APP_PATH is required')

rmSync(dataDir, { recursive: true, force: true })
const username = `remote${Date.now().toString().slice(-8)}`
const password = 'remote-pass-123'

async function launch(url = serverUrl) {
  const app = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      DAILYWORK_DATA_DIR: dataDir,
      DAILYWORK_SERVER_URL: url,
    },
    timeout: 90000,
  })
  const win = await app.firstWindow({ timeout: 60000 })
  await win.waitForTimeout(1500)
  return { app, win }
}

let { app, win } = await launch()
await win.locator('.auth-shell').waitFor({ timeout: 15000 })
await win.getByPlaceholder('你的用户名').fill(username)
await win.getByPlaceholder('至少 8 位').fill(password)
await win.getByPlaceholder('再输入一次').fill(password)
await win.locator('.auth-submit').click()
await win.locator('.app').waitFor({ timeout: 20000 })
await win.waitForTimeout(500)
console.log('registered', username)

const title = `Remote client ${Date.now()}`
await win.getByLabel('快速添加任务').fill(title)
await win.getByLabel('快速添加任务').press('Enter')
await win.locator('.task-row', { hasText: title }).waitFor({ timeout: 10000 })
await win.screenshot({ path: 'design/qa/remote-client-today.png' })
console.log('desktop task created', title)

const login = await fetch(`${serverUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password }),
})
const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
const list = await fetch(`${serverUrl}/api/ops/task.list`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: '{}',
})
const listBody = await list.json()
console.log(
  'server sees desktop task',
  list.ok,
  listBody?.data?.items?.some((item) => item.title === title),
)
await win.goto(`${serverUrl}/settings`).catch(() => {})
await win.waitForTimeout(800)
await win.getByRole('button', { name: '数据与备份' }).click()
await win.waitForTimeout(400)
const settingsText = await win.evaluate(() => document.body.innerText)
console.log('remote settings', settingsText.includes('当前服务端'), settingsText.includes('切换服务器'))
await win.screenshot({ path: 'design/qa/remote-client-settings.png' })
await app.close()

;({ app, win } = await launch())
await win.locator('.app').waitFor({ timeout: 20000 })
const text = await win.evaluate(() => document.body.innerText)
console.log('relaunch keeps session', !text.includes('你的用户名'), 'task visible', text.includes(title))
await app.close()

;({ app, win } = await launch('http://127.0.0.1:49999'))
await win.getByText('连接你的工作台').waitFor({ timeout: 15000 })
await win.screenshot({ path: 'design/qa/remote-client-connect.png' })
await win.locator('#server').fill(serverUrl)
await win.locator('#connect').click()
await win.locator('.app, .auth-shell').first().waitFor({ timeout: 15000 })
console.log('connection screen reconnects', await win.locator('.app').isVisible())
await app.close()
