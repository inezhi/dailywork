import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      testIgnore: '**/mobile.spec.ts',
      use: {
        channel: 'chrome',
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: 'mobile-webkit',
      testMatch: '**/mobile.spec.ts',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],
  webServer: [
    {
      command:
        'rm -rf .data-e2e && DAILYWORK_DATA_DIR="$PWD/.data-e2e" DAILYWORK_PORT=47821 pnpm dev:server',
      url: 'http://127.0.0.1:47821/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev:web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
