import { _electron as electron } from 'playwright'

const app = await electron.launch({
  args: ['.'],
  cwd: '/Users/lingzhi/Documents/project/dailywork/apps/desktop',
  env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
  timeout: 60000,
})
const win = await app.firstWindow()
await win.waitForTimeout(2600)
await win.screenshot({ path: 'design/qa/electron-today.png' })
console.log('title', await win.title())
console.log('url', win.url())
console.log('bodyClass', await win.evaluate(() => document.body.className))
await app.close()
