import { defineConfig } from 'vitest/config';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qc:qc@localhost:5432/quick_commerce_test?schema=public&connection_limit=5&pool_timeout=10';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: 'local-dev-only-jwt-secret-32chars-min',
      JOBS_TOKEN: 'test-jobs-token-value',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'Adminpass1',
      DELIVERY_FEE_PAISE: '2500',
      SERVICEABLE_PINCODES: '560001,560002',
      IMAGE_HOSTS: 'images.example.com',
      DOCS_ENABLED: 'true',
      APP_VERSION: '0.1.0',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/generated/**'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
