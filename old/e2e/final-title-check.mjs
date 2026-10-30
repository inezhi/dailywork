import { _electron as electron } from 'playwright'
import { rmSync } from 'node:fs'
const dataDir = '/tmp/dw-final-title'
rmSync(dataDir, { recursive: true, force: true })
const app = await electron.launch({
  executablePath: '/tmp/dw-dmg/Dailywork.app/Contents/MacOS/Dailywork',
  env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
  timeout: 90000,
})
const win = await app.firstWindow({ timeout: 60000 })
await win.waitForTimeout(4000)
console.log('guide title', await win.getByText('上手只要三步').isVisible())
await win.screenshot({ path: 'design/qa/final-first-run.png' })
await app.close()
