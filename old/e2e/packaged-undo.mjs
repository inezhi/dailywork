import { _electron as electron } from 'playwright'
import { rmSync } from 'node:fs'
const dataDir = '/tmp/dw-undo'
rmSync(dataDir, { recursive: true, force: true })
const app = await electron.launch({
  executablePath: '/tmp/dw-dmg/Dailywork.app/Contents/MacOS/Dailywork',
  env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
  timeout: 90000,
})
const win = await app.firstWindow({ timeout: 60000 })
await win.waitForTimeout(4000)
await win.getByLabel('快速添加任务').fill('将被撤销的任务')
await win.getByLabel('快速添加任务').press('Enter')
await win.locator('.task-row', { hasText: '将被撤销的任务' }).waitFor()
await win.keyboard.press('Meta+k')
await win.locator('.palette-input input').fill('')
await win.getByText('撤销上一步任务操作').click()
await win.waitForTimeout(1200)
const count = await win.locator('.task-row', { hasText: '将被撤销的任务' }).count()
const toast = await win.locator('.toast').last().innerText().catch(() => '')
console.log('task count after undo', count, 'toast', toast)
await app.close()
