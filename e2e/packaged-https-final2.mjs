import { _electron as electron } from 'playwright'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const dataDir = '/tmp/dailywork-final-https'
const app = await electron.launch({
  executablePath: '/Users/lingzhi/Documents/project/dailywork/apps/desktop/release/mac-arm64/Dailywork.app/Contents/MacOS/Dailywork',
  env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
  timeout: 90000,
})
const win = await app.firstWindow({ timeout: 60000 })
await win.waitForTimeout(3500)
const lan = await win.evaluate(async () => {
  const res = await fetch('/api/ops/lan.info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  return (await res.json()).data
})
console.log('lan', lan)
const url = lan.urls[0]
const pair = await fetch(`${url}/api/pair`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: lan.pairingCode }),
})
const cookie = pair.headers.get('set-cookie')?.split(';')[0] ?? ''
const today = await fetch(`${url}/api/ops/today.get`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: '{}',
})
console.log('https pair', pair.status, 'today', today.status, (await today.json()).ok)
await win.goto(`${new URL(win.url()).origin}/settings`).catch(() => {})
await win.waitForTimeout(700)
await win.getByRole('button', { name: '通用' }).click()
await win.waitForTimeout(500)
await win.screenshot({ path: 'design/qa/final-https-settings.png' })
await app.close()
