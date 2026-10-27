import { chromium } from 'playwright'
const base = 'http://127.0.0.1:5173'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
const page = await context.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(base + '/tasks', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /四象限/ }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'design/qa/matrix.png' })

await page.goto(base + '/focus', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'design/qa/focus-week.png' })

await page.goto(base + '/dashboard', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '本周复盘' }).click()
await page.locator('.modal').waitFor()
await page.waitForTimeout(500)
await page.screenshot({ path: 'design/qa/week-review.png' })
await page.keyboard.press('Escape')

// dark mode
await page.goto(base + '/settings', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /深色/ }).click()
await page.waitForTimeout(600)
await page.goto(base + '/today', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'design/qa/dark-today.png' })
await page.goto(base + '/settings', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /浅色/ }).click()
await page.waitForTimeout(400)

console.log('errors', JSON.stringify(errors, null, 2))
await browser.close()
