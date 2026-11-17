import { execFileSync } from 'node:child_process';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://qc:qc@localhost:5432/quick_commerce?schema=public&connection_limit=5&pool_timeout=10';
const shadowDatabaseUrl =
  process.env.SHADOW_DATABASE_URL ??
  'postgresql://qc:qc@localhost:5432/quick_commerce_shadow?schema=public';

execFileSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-config-datasource',
    '--to-migrations',
    'prisma/migrations',
    '--exit-code',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SHADOW_DATABASE_URL: shadowDatabaseUrl,
    },
  },
);
