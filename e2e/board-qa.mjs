import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://127.0.0.1:5173/board', { waitUntil: 'networkidle' })
const card = page.locator('.kb-card', { hasText: '完成领域层的任务状态机' }).first()
const target = page.locator('.kb-col', { hasText: '进行中' }).first()
console.log('before card count', await card.count())
const box = await card.boundingBox(); const tbox = await target.boundingBox()
if (box && tbox) {
  await page.mouse.move(box.x + 30, box.y + 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 30, box.y + 30 + 10, { steps: 3 })
  await page.mouse.move(tbox.x + 80, tbox.y + 80, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(1200)
}
console.log('moved?', await page.locator('.kb-col', { hasText: '进行中' }).locator('.kb-card', { hasText: '完成领域层的任务状态机' }).count())
console.log('errors', errors)
await browser.close()
