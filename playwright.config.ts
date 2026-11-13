import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], launchOptions: { args: ['--no-sandbox', '--disable-gpu'] } },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--no-sandbox', '--disable-gpu'] } },
    },
  ],
  webServer: undefined,
});
