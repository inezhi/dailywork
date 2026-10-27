import { _electron as electron } from 'playwright'
import { rmSync } from 'node:fs'
const dataDir = '/tmp/dailywork-first-run'
rmSync(dataDir, { recursive: true, force: true })
const app = await electron.launch({
  executablePath:
    '/Users/lingzhi/Documents/project/dailywork/apps/desktop/release/mac-arm64/Dailywork.app/Contents/MacOS/Dailywork',
  env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
  timeout: 90000,
})
const win = await app.firstWindow({ timeout: 60000 })
await win.waitForTimeout(3500)
await win.screenshot({ path: 'design/qa/first-run.png' })
console.log('first-run visible', await win.getByText('从一件小事开始').isVisible())
await app.close()
