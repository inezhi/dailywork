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
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: { channel: 'chrome' },
    },
    {
      name: 'desktop-chrome',
      testIgnore: ['**/mobile.spec.ts', '**/auth.setup.ts', '**/auth-ui.spec.ts'],
      dependencies: ['setup'],
      use: {
        channel: 'chrome',
        viewport: { width: 1440, height: 960 },
        storageState: 'e2e/.auth/user.json',
      },
    },
    {
      name: 'mobile-webkit',
      testMatch: '**/mobile.spec.ts',
      dependencies: ['setup'],
      use: {
        ...devices['iPhone 13'],
        storageState: 'e2e/.auth/user.json',
      },
    },
    {
      name: 'auth-ui',
      testMatch: '**/auth-ui.spec.ts',
      dependencies: ['setup'],
      use: {
        channel: 'chrome',
        viewport: { width: 1440, height: 960 },
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
