import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qc:qc@localhost:5432/quick_commerce_test?schema=public&connection_limit=5&pool_timeout=10';

export default function setup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: apiRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
