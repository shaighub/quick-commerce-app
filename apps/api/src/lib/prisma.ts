import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { AppLogger } from './logger.js';
import { logSlowQuery } from './logger.js';
import { connectionLimit, toPgConnectionString } from './pg-url.js';

export interface Database {
  prisma: PrismaClient;
  close: () => Promise<void>;
}

export function createDatabase(databaseUrl: string, logger: AppLogger): Database {
  const adapter = new PrismaPg({
    connectionString: toPgConnectionString(databaseUrl),
    max: connectionLimit(databaseUrl),
    connectionTimeoutMillis: 10_000,
  });
  const prisma = new PrismaClient({
    adapter,
    log: [{ emit: 'event', level: 'query' }],
  });
  prisma.$on('query', (event) => {
    logSlowQuery(logger, event);
  });
  return {
    prisma,
    async close() {
      await prisma.$disconnect();
    },
  };
}
