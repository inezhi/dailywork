import { _electron as electron } from 'playwright'
import { readFileSync } from 'node:fs'
const app = await electron.launch({
  executablePath: process.cwd() + '/apps/desktop/release/mac-arm64/Dailywork.app/Contents/MacOS/Dailywork',
  env: { ...process.env, DAILYWORK_DATA_DIR: '/tmp/dw-final-020' },
  timeout: 90000,
})
const win = await app.firstWindow({ timeout: 60000 })
await win.waitForTimeout(4000)
const info = await win.evaluate(() => {
  const body = getComputedStyle(document.body)
  const el = document.querySelector('.page-sub') ?? document.body
  const sub = getComputedStyle(el)
  return {
    dpr: devicePixelRatio,
    bodyFont: body.fontFamily,
    bodyWeight: body.fontWeight,
    bodySmoothing: body.webkitFontSmoothing,
    subColor: sub.color,
    subSize: sub.fontSize,
    interLoaded: document.fonts.check('14px "Inter Variable"'),
    sourceSerifLoaded: document.fonts.check('14px "Source Serif 4 Variable"'),
    fonts: Array.from(document.fonts).slice(0, 8).map((f) => `${f.family}:${f.weight}:${f.status}`),
  }
})
console.log(info)
if (await win.locator('.app').count()) {
  await win.screenshot({ path: 'design/qa/font-before.png' })
  await win.evaluate(() => { document.documentElement.style.webkitFontSmoothing = 'auto' })
  await win.waitForTimeout(200)
  await win.screenshot({ path: 'design/qa/font-auto.png' })
}
await app.close()
