import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.env.QA_BASE ?? 'http://127.0.0.1:5173'
const pages = process.env.QA_PAGES
  ? process.env.QA_PAGES.split(',')
  : ['today', 'board', 'calendar', 'timeline', 'dashboard', 'docs', 'memos', 'focus', 'inbox', 'settings', 'design']
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, colorScheme: 'light' })
const page = await context.newPage()
const errors = []
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push(String(err)))
mkdirSync('design/qa', { recursive: true })
for (const name of pages) {
  const path = name.includes('/') ? name : `/${name}`
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const file = `design/qa/${name.replaceAll('/', '-')}.png`
  await page.screenshot({ path: file, fullPage: false })
  console.log('shot', file)
}
console.log('errors:', JSON.stringify(errors, null, 2))
await browser.close()
