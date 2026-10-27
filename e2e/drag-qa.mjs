import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://127.0.0.1:5173/tasks', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /四象限/ }).click()
await page.waitForTimeout(400)
const card = page.locator('.matrix-item').filter({ hasText: '整理本周的速记' }).first()
const target = page.locator('.matrix-card').filter({ hasText: '重要且紧急' }).first()
await card.dragTo(target)
await page.waitForTimeout(1000)
const toast1 = await page.locator('.toast').last().innerText().catch(() => '')
console.log('matrix toast', toast1)

await page.goto('http://127.0.0.1:5173/calendar', { waitUntil: 'networkidle' })
const event = page.locator('.cal-ev').first()
const cells = page.locator('.cal-cell')
const box = await cells.nth(20).boundingBox()
const evbox = await event.boundingBox()
if (box && evbox) {
  await page.mouse.move(evbox.x + 20, evbox.y + 6)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 40, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(1000)
}
console.log('cal toast', await page.locator('.toast').last().innerText().catch(() => ''))

await page.goto('http://127.0.0.1:5173/timeline', { waitUntil: 'networkidle' })
const bar = page.locator('.timeline-bar').first()
const track = page.locator('.timeline-track').nth(3)
const tb = await track.boundingBox()
const bb = await bar.boundingBox()
if (tb && bb) {
  await page.mouse.move(bb.x + 5, bb.y + 8)
  await page.mouse.down()
  await page.mouse.move(tb.x + tb.width * 0.6, tb.y + 12, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(1000)
}
console.log('timeline toast', await page.locator('.toast').last().innerText().catch(() => ''))
console.log('errors', errors)
await browser.close()
