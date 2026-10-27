import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.describe.serial('accounts', () => {
  test('registers, uses the initial avatar, uploads an avatar, logs out and back in', async ({ page }) => {
    const username = `auth_${Date.now()}`
    const password = 'auth-password-123'
    await page.goto('/today')
    await expect(page.locator('.auth-shell')).toBeVisible()
    await page.getByRole('tab', { name: '注册' }).click()
    await page.getByPlaceholder('你的用户名').fill(username)
    await page.getByPlaceholder('you@example.com').fill(`${username}@example.com`)
    await page.getByPlaceholder('至少 8 位，含字母和数字').fill(password)
    await page.getByPlaceholder('再输入一次').fill(password)
    await page.locator('.auth-submit').click()
    await expect(page.locator('.app')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.topbar .avatar')).toHaveText(username[0]!.toUpperCase())

    await page.goto('/settings')
    await page.getByRole('button', { name: '账户' }).click()
    await expect(page.locator('.account-head .name')).toHaveText(username)
    await page.locator('.account-head input[type=file]').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: readFileSync('apps/web/public/icon-192.png'),
    })
    await expect(page.locator('.account-head .avatar-image img')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: '退出' }).click()
    await expect(page.locator('.auth-shell')).toBeVisible()
    await page.getByPlaceholder('你的用户名').fill(username)
    await page.getByPlaceholder('请输入密码').fill(password)
    await page.locator('.auth-submit').click()
    await expect(page.locator('.app')).toBeVisible({ timeout: 15_000 })
  })
})
