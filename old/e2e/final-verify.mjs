import { _electron as electron } from 'playwright'
import { existsSync, readFileSync, rmSync } from 'node:fs'

const dataDir = '/tmp/dailywork-final-qa'
rmSync(dataDir, { recursive: true, force: true })
const executablePath = '/tmp/dw-dmg/Dailywork.app/Contents/MacOS/Dailywork'

async function launch() {
  const app = await electron.launch({
    executablePath,
    env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
    timeout: 90000,
  })
  const win = await app.firstWindow({ timeout: 60000 })
  await win.waitForTimeout(4200)
  return { app, win }
}

let { app, win } = await launch()
console.log('first run guide', await win.getByRole('heading', { name: '从一件小事开始', exact: true }).isVisible())
await win.screenshot({ path: 'design/qa/final-first-run.png' })
const quickAdd = win.getByLabel('快速添加任务')
await quickAdd.fill('验收：完成第一件事')
await quickAdd.press('Enter')
await win.locator('.task-row', { hasText: '验收：完成第一件事' }).first().waitFor({ timeout: 10000 })
await win.waitForTimeout(500)

// Enable LAN and pair from the LAN IP (not loopback).
await win.evaluate(async () => {
  await fetch('/api/ops/settings.update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ general: { lanEnabled: true } }),
  })
})
const lan = await win.evaluate(async () => {
  const res = await fetch('/api/ops/lan.info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  return (await res.json()).data
})
const url = lan.urls[0]
const pair = await fetch(`${url}/api/pair`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: lan.pairingCode }),
})
const cookie = pair.headers.get('set-cookie')?.split(';')[0] ?? ''
console.log('paired', pair.status, 'lan', url)
const lanToday = await fetch(`${url}/api/ops/today.get`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: '{}',
})
console.log('lan today', lanToday.status, (await lanToday.json()).ok)
const token1 = readFileSync(`${dataDir}/server-token`, 'utf8').trim()
await app.close()

;({ app, win } = await launch())
const text = await win.evaluate(() => document.body.innerText)
console.log('task persisted', text.includes('验收：完成第一件事'))
const token2 = readFileSync(`${dataDir}/server-token`, 'utf8').trim()
console.log('token persisted', token1 === token2)
const lan2 = await win.evaluate(async () => {
  const res = await fetch('/api/ops/lan.info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  return (await res.json()).data
})
const url2 = lan2.urls[0]
const again = await fetch(`${url2}/api/ops/today.get`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: '{}',
})
console.log('paired cookie survives restart', again.status, (await again.json()).ok)
await win.screenshot({ path: 'design/qa/final-restart.png' })
await app.close()
console.log('backups', existsSync(`${dataDir}/backups`))
