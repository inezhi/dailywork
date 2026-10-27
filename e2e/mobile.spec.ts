import { test, expect } from '@playwright/test'

const stamp = Date.now()

test.describe('mobile WebKit', () => {
  test('today page renders, creates a task and stays within the viewport', async ({ page }) => {
    await page.goto('/today')
    await expect(page.locator('.bottom-nav')).toBeVisible()
    const title = `移动端任务 ${stamp}`
    await page.getByLabel('快速添加任务').fill(title)
    await page.getByLabel('快速添加任务').press('Enter')
    await expect(page.locator('.task-row', { hasText: title }).first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('opens a full-screen task drawer and closes it', async ({ page }) => {
    await page.goto('/today')
    await page.locator('.task-row').first().click()
    const drawer = page.locator('.drawer')
    await expect(drawer).toBeVisible()
    const box = await drawer.boundingBox()
    const viewport = page.viewportSize()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 2)
    await page.locator('.drawer-close').click()
    await expect(drawer).toBeHidden()
  })

  test('dashboard and docs remain usable on a phone viewport', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('.kpi-grid .kpi').first()).toBeVisible()
    await page.goto('/docs')
    await expect(page.locator('.doc-title-input').first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
