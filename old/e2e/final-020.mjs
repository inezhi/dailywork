import { _electron as electron } from 'playwright'
import { readFileSync, rmSync } from 'node:fs'
const dataDir = '/tmp/dw-final-020'
rmSync(dataDir, { recursive: true, force: true })
const executablePath = '/tmp/dw-dmg2/Dailywork.app/Contents/MacOS/Dailywork'
async function launch() {
  const app = await electron.launch({ executablePath, env: { ...process.env, DAILYWORK_DATA_DIR: dataDir }, timeout: 90000 })
  const win = await app.firstWindow({ timeout: 60000 })
  await win.waitForTimeout(4000)
  return { app, win }
}
let { app, win } = await launch()
await win.locator('.auth-shell').waitFor({ timeout: 15000 })
const authText = await win.locator('.auth-shell').innerText()
console.log('auth length', authText.length, 'register default', await win.locator('.auth-heading h2').innerText())
await win.getByPlaceholder('你的用户名').fill('reviewer')
await win.getByPlaceholder('至少 8 位').fill('review-pass-123')
await win.getByPlaceholder('再输入一次').fill('review-pass-123')
await win.locator('.auth-submit').click()
await win.locator('.app').waitFor({ timeout: 20000 })
await win.waitForTimeout(500)
console.log('avatar', await win.locator('.topbar .avatar').innerText())
await win.screenshot({ path: 'design/qa/final-020-today.png' })
await win.getByLabel('快速添加任务').fill('新版本的第一个任务')
await win.getByLabel('快速添加任务').press('Enter')
await win.locator('.task-row', { hasText: '新版本的第一个任务' }).waitFor()
await win.goto(`${new URL(win.url()).origin}/settings`).catch(() => {})
await win.waitForTimeout(800)
await win.getByRole('button', { name: '关于' }).click()
await win.getByRole('button', { name: '查看全部版本' }).click()
await win.locator('.modal').waitFor()
await win.waitForTimeout(400)
const releaseText = await win.locator('.modal').innerText()
console.log('release versions', releaseText.includes('v0.2.0'), releaseText.includes('v0.1.0'))
await win.screenshot({ path: 'design/qa/final-020-releases.png' })
await app.close()

;({ app, win } = await launch())
const text = await win.evaluate(() => document.body.innerText)
console.log('session persists', !text.includes('你的用户名'), 'task persists', text.includes('新版本的第一个任务'))
await win.screenshot({ path: 'design/qa/final-020-restart.png' })

// LAN: base URL should show pairing for an unpaired browser.
await win.evaluate(async () => {
  await fetch('/api/ops/settings.update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ general: { lanEnabled: true } }) })
})
const lan = await win.evaluate(async () => {
  const res = await fetch('/api/ops/lan.info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  return (await res.json()).data
})
const base = lan.httpUrls[0] ?? lan.urls[0]
const baseRes = await fetch(base + '/today')
const baseHtml = await baseRes.text()
console.log('lan base is pair page', baseHtml.includes('配对这台设备'))
const pair = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: lan.pairingCode }) })
const cookie = pair.headers.get('set-cookie')?.split(';')[0] ?? ''
const today = await fetch(`${base}/api/ops/today.get`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}' })
console.log('lan pair/today', pair.status, today.status, (await today.json()).ok)
await app.close()
