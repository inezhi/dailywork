import { _electron as electron } from 'playwright'
import { existsSync, readFileSync, rmSync } from 'node:fs'

const dataDir = '/tmp/dailywork-packaged-qa'
rmSync(dataDir, { recursive: true, force: true })
const executablePath =
  process.cwd() + '/apps/desktop/release/mac-arm64/Dailywork.app/Contents/MacOS/Dailywork'

async function launch() {
  const app = await electron.launch({
    executablePath,
    env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
    timeout: 90000,
  })
  const window = await app.firstWindow({ timeout: 60000 })
  await window.waitForTimeout(5000)
  return { app, window }
}

let { app, window } = await launch()
console.log('url', window.url())
console.log('title', await window.title())
console.log('runtime', existsSync(`${dataDir}/runtime.json`) ? readFileSync(`${dataDir}/runtime.json`, 'utf8').slice(0, 200) : 'MISSING')
console.log('body', (await window.evaluate(() => document.body.innerText)).slice(0, 300))
await window.screenshot({ path: 'design/qa/packaged-today.png' })

await window.getByRole('button', { name: /新建任务/ }).first().click()
await window.getByPlaceholder('要做什么？').fill('打包验收：创建任务')
await window.getByRole('button', { name: '创建任务' }).click()
await window.locator('.drawer').waitFor({ timeout: 15000 })
await window.waitForTimeout(800)
await window.screenshot({ path: 'design/qa/packaged-drawer.png' })
await window.locator('.drawer .drawer-close').click()
await window.waitForTimeout(600)
await app.close()

;({ app, window } = await launch())
const text = await window.evaluate(() => document.body.innerText)
console.log('after restart contains task:', text.includes('打包验收：创建任务'))
await window.screenshot({ path: 'design/qa/packaged-restart.png' })
await app.close()
