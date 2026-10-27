import { test as setup, expect } from '@playwright/test'

setup('create an account for the test run', async ({ page }) => {
  const username = `e2e_${Date.now()}`
  const response = await page.request.post('/api/auth/register', {
    data: { username, password: 'e2e-password-123' },
  })
  expect(response.ok()).toBeTruthy()
  const body = (await response.json()) as { ok: boolean }
  expect(body.ok).toBe(true)
  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})
