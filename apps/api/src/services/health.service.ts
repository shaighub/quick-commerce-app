import type { AppLogger } from '../lib/logger.js';

export interface QueryProbe {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

export async function checkDatabase(db: QueryProbe, logger: AppLogger): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error: unknown) {
    logger.error({ err: error }, 'database health check failed');
    return false;
  }
}
