import { createApp } from './app.js';
import { createCommerceModule } from './commerce/create-commerce.js';
import { loadConfig } from './config/env.js';
import { createDatabase } from './lib/prisma.js';
import { createLogger } from './lib/logger.js';
import { shutdown } from './lib/shutdown.js';
import { checkDatabase } from './services/health.service.js';

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.databaseUrl, logger);
const commerce = createCommerceModule({ prisma: database.prisma, config, logger });

const app = createApp({
  config,
  logger,
  prisma: database.prisma,
  checkDb: () => checkDatabase(database.prisma, logger),
  commerce,
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'api listening');
  void commerce.orders.sweepPendingPayments(15).catch((error: unknown) => {
    logger.error({ err: error }, 'startup sweep failed');
  });
});

let stopping = false;

async function onSignal(signal: string): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  logger.info({ signal }, 'received signal');
  try {
    await shutdown({
      server,
      closeResources: () => database.close(),
      timeoutMs: config.shutdownTimeoutMs,
      logger,
    });
    process.exit(0);
  } catch (error: unknown) {
    logger.fatal({ err: error }, 'shutdown failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void onSignal('SIGTERM');
});
process.on('SIGINT', () => {
  void onSignal('SIGINT');
});
