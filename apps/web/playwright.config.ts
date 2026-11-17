import { defineConfig, devices } from '@playwright/test';

/**
 * Scaffold only. End-to-end specs arrive with the flows they cover.
 * CI does not run Playwright in milestone 1.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
