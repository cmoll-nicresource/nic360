import { defineConfig, devices } from '@playwright/test'
const node='"'+process.execPath.replaceAll('\\','/')+'"'
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  outputDir: '.test-artifacts/browser',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.test-artifacts/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    timezoneId: 'America/New_York',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testIgnore: /(?:permissions|load)\.spec\.ts/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testIgnore: /(?:permissions|load)\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
    { name: 'phone', testIgnore: /(?:permissions|load)\.spec\.ts/, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: node+' --import tsx tests/support/mailbox.ts',
      url: 'http://127.0.0.1:2526',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: node+' --import tsx tests/support/run.ts start',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
})
