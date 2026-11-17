import { loadConfig } from '../src/config/env.js';
import { seedDatabase } from '../src/db/seed.js';
import { createLogger } from '../src/lib/logger.js';
import { createDatabase } from '../src/lib/prisma.js';

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.databaseUrl, logger);

try {
  await seedDatabase(database.prisma, {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  logger.info({ email: process.env.ADMIN_EMAIL?.toLowerCase() }, 'seed complete');
} catch (error: unknown) {
  logger.error({ err: error }, 'seed failed');
  process.exitCode = 1;
} finally {
  await database.close();
}
