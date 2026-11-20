import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.env.DATABASE_URL ??=
  'postgresql://qc:qc@localhost:5432/quick_commerce?schema=public&connection_limit=5&pool_timeout=10';
process.env.JWT_SECRET ??= 'local-dev-only-jwt-secret-32chars-min';
process.env.JOBS_TOKEN ??= 'local-dev-only-jobs-token';
process.env.ADMIN_EMAIL ??= 'admin@example.com';
process.env.ADMIN_PASSWORD ??= 'Adminpass1';
process.env.DELIVERY_FEE_PAISE ??= '2500';
process.env.SERVICEABLE_PINCODES ??= '560001,560002';
process.env.IMAGE_HOSTS ??= 'images.example.com';
process.env.RATE_LIMIT_AUTH_MAX ??= '1000';
process.env.RATE_LIMIT_PUBLIC_MAX ??= '10000';
process.env.LOG_LEVEL ??= 'silent';

const apiEnv: Record<string, string> = {
  ...process.env,
  HUSKY: '0',
  NODE_ENV: 'development',
  PORT: '4000',
  LOG_LEVEL: 'silent',
  DOCS_ENABLED: 'true',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JOBS_TOKEN: process.env.JOBS_TOKEN,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  DELIVERY_FEE_PAISE: process.env.DELIVERY_FEE_PAISE,
  SERVICEABLE_PINCODES: process.env.SERVICEABLE_PINCODES,
  IMAGE_HOSTS: process.env.IMAGE_HOSTS,
  RATE_LIMIT_AUTH_MAX: process.env.RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_PUBLIC_MAX: process.env.RATE_LIMIT_PUBLIC_MAX,
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--unsafely-treat-insecure-origin-as-secure=http://localhost:5173'],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'npx tsx apps/api/src/server.ts',
      cwd: root,
      url: 'http://127.0.0.1:4000/v1/health',
      timeout: 120_000,
      reuseExistingServer: false,
      env: apiEnv,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5173',
      cwd: resolve(root, 'apps/web'),
      url: 'http://127.0.0.1:5173',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        HUSKY: '0',
        VITE_API_BASE_URL: '/v1',
        VITE_API_PROXY_TARGET: 'http://127.0.0.1:4000',
      },
    },
  ],
});
