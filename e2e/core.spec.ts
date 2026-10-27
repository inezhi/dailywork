import { test, expect } from '@playwright/test'

const stamp = Date.now()
const title = (name: string) => `${name} ${stamp}`

test.describe.serial('core journey', () => {
  test('creates, edits, completes and persists a task', async ({ page }) => {
    const taskTitle = title('自动化任务')
    await page.goto('/today')
    const quickAdd = page.getByLabel('快速添加任务')
    await quickAdd.fill(taskTitle)
    await quickAdd.press('Enter')
    const row = page.locator('.task-row', { hasText: taskTitle }).first()
    await expect(row).toBeVisible()

    await row.click()
    await expect(page.locator('.drawer')).toBeVisible()
    const drawerTitle = page.locator('.drawer-title')
    await drawerTitle.fill(taskTitle + ' 已编辑')
    await page.waitForTimeout(900)
    await page.keyboard.press('Escape')
    await expect(page.locator('.task-row', { hasText: taskTitle + ' 已编辑' }).first()).toBeVisible()

    const editedRow = page.locator('.task-row', { hasText: taskTitle + ' 已编辑' }).first()
    await editedRow.locator('.status-btn').click()
    await expect(page.locator('.list-card .task-row', { hasText: taskTitle + ' 已编辑' })).toHaveCount(0)

    await page.reload()
    await page.getByText('今日已完成').click()
    await expect(page.locator('.task-row', { hasText: taskTitle + ' 已编辑' }).first()).toBeVisible()
  })

  test('converts a memo into a task', async ({ page }) => {
    const content = `自动化速记 ${stamp} #e2e`
    await page.goto('/memos')
    await page.locator('.memo-composer textarea').fill(content)
    await page.getByRole('button', { name: '记下来' }).click()
    const card = page.locator('.memo-card', { hasText: `自动化速记 ${stamp}` }).first()
    await expect(card).toBeVisible()
    await card.getByTitle('转为任务').click()
    await expect(page.locator('.drawer')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.drawer-title')).toHaveValue(new RegExp(`自动化速记 ${stamp}`))
  })

  test('writes and reloads a document', async ({ page }) => {
    await page.goto('/docs')
    await page.locator('.doc-tree-head button').click()
    await expect(page.locator('.doc-title-input')).toBeVisible()
    await expect(page.locator('.doc-title-input')).toHaveValue('未命名文档')
    await page.locator('.doc-title-input').fill(`自动化文档 ${stamp}`)
    await page.locator('.prose-editor').click()
    await page.keyboard.type('这段内容来自端到端测试。')
    await page.waitForTimeout(1400)
    await page.reload()
    await expect(page.locator('.doc-title-input')).toHaveValue(`自动化文档 ${stamp}`)
    await expect(page.locator('.prose-editor')).toContainText('这段内容来自端到端测试。')
  })

  test('searches through the command palette', async ({ page }) => {
    await page.goto('/today')
    await page.keyboard.press('Meta+k')
    const input = page.locator('.palette-input input')
    await expect(input).toBeVisible()
    await input.fill(`自动化任务 ${stamp}`)
    const result = page.locator('.palette-item', { hasText: `自动化任务 ${stamp}` }).first()
    await expect(result).toBeVisible({ timeout: 10_000 })
    await result.click()
    await expect(page.locator('.drawer')).toBeVisible()
  })

  test('switches theme and keeps the base tokens', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /深色/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: /浅色/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('keeps mobile layout free of horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/today')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(page.locator('.bottom-nav')).toBeVisible()
  })
})
