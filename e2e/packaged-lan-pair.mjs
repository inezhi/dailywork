import { _electron as electron } from 'playwright'
import { readFileSync } from 'node:fs'

const dataDir = '/tmp/dailywork-packaged-fresh'
const app = await electron.launch({
  executablePath:
    '/Users/lingzhi/Documents/project/dailywork/apps/desktop/release/mac-arm64/Dailywork.app/Contents/MacOS/Dailywork',
  env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
  timeout: 90000,
})
const win = await app.firstWindow({ timeout: 60000 })
await win.waitForTimeout(3500)
const lan = await win.evaluate(async () => {
  const res = await fetch('/api/ops/lan.info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  return (await res.json()).data
})
console.log('lan', lan)
const url = lan.urls[0]
const pairRes = await fetch(`${url}/api/pair`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: lan.pairingCode }),
})
const cookie = pairRes.headers.get('set-cookie')?.split(';')[0] ?? ''
console.log('pair', pairRes.status, cookie.slice(0, 24) + '…')
const today = await fetch(`${url}/api/ops/today.get`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: '{}',
})
const json = await today.json()
console.log('lan today', today.status, json.ok, json.data?.date)
const denied = await fetch(`${url}/api/ops/today.get`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
})
console.log('without cookie', denied.status)
await app.close()
