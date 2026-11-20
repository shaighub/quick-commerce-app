import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Applies migrations and the idempotent seed before the browser starts. */
export default function globalSetup(): void {
  execSync('npm run db:migrate -w @qc/api', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  execSync('npm run db:seed -w @qc/api', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}
