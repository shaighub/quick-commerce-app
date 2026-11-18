import { describe, expect, it, vi } from 'vitest';
import { logSlowQuery } from '../src/lib/logger.js';
import { connectionLimit, toPgConnectionString } from '../src/lib/pg-url.js';

describe('logger and database url', () => {
  it('logs only slow queries and omits params', () => {
    const warn = vi.fn();
    const logger = { warn } as unknown as Parameters<typeof logSlowQuery>[0];
    logSlowQuery(logger, { duration: 10, query: 'SELECT 1' });
    logSlowQuery(logger, { duration: 250, query: 'SELECT slow' });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith({ durationMs: 250, query: 'SELECT slow' }, 'slow query');
  });

  it('strips Prisma pool params and reads the connection limit', () => {
    const raw =
      'postgresql://qc:qc@localhost:5432/quick_commerce?schema=public&connection_limit=5&pool_timeout=10';
    const pgUrl = new URL(toPgConnectionString(raw));
    expect(pgUrl.searchParams.has('schema')).toBe(false);
    expect(pgUrl.searchParams.has('connection_limit')).toBe(false);
    expect(connectionLimit(raw)).toBe(5);
    expect(connectionLimit('postgresql://qc:qc@localhost:5432/quick_commerce')).toBe(5);
  });
});
