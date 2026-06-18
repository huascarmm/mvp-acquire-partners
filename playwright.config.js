// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Los tests corren contra un despliegue YA levantado (no arranca servidor local).
 * Define la URL con E2E_BASE_URL (ej. la URL "candidata" de Cloud Run en CI,
 * o http://localhost:8080 en local).
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8080';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
