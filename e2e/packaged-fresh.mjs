import { _electron as electron } from 'playwright'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'

const dataDir = '/tmp/dailywork-packaged-fresh'
rmSync(dataDir, { recursive: true, force: true })
const executablePath =
  '/Users/lingzhi/Documents/project/dailywork/apps/desktop/release/mac-arm64/Dailywork.app/Contents/MacOS/Dailywork'
const app = await electron.launch({
  executablePath,
  env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
  timeout: 90000,
})
const win = await app.firstWindow({ timeout: 60000 })
await win.waitForTimeout(4500)
await win.screenshot({ path: 'design/qa/packaged-fresh.png' })

console.log('runtime', readFileSync(`${dataDir}/runtime.json`, 'utf8').slice(0, 240))
console.log('data files', readdirSync(dataDir))
console.log('backups', readdirSync(`${dataDir}/backups`))

// welcome document exists
await win.getByRole('link', { name: '文档' }).first().click()
await win.waitForTimeout(1500)
console.log('welcome visible', await win.getByText('欢迎使用时序').first().isVisible())

// enable LAN through the settings UI
await win.goto(`${new URL(win.url()).origin}/settings`).catch(() => {})
await win.waitForTimeout(700)
await win.getByRole('button', { name: '通用' }).click()
const lanToggle = win.locator('.setting-row', { hasText: '局域网访问' }).locator('.toggle')
await lanToggle.click()
await win.waitForTimeout(900)
const lan = await win.evaluate(async () => {
  const res = await fetch('/api/ops/lan.info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  return (await res.json()).data
})
console.log('lan', lan)
await win.screenshot({ path: 'design/qa/packaged-lan.png' })
await app.close()
