import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createLogger, logSlowQuery } from '../src/lib/logger.js';
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

  it('redacts password, email, phone, and address on a request body', async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const logger = createLogger({ logLevel: 'info' }, stream);
    logger.info(
      {
        req: {
          body: {
            password: 'Password1',
            email: 'secret@example.com',
            phone: '9876543210',
            address: { line1: '12 Residency Road' },
          },
        },
      },
      'login attempt',
    );
    await new Promise<void>((resolve) => {
      logger.flush(() => {
        resolve();
      });
    });
    const text = chunks.join('');
    expect(text).not.toContain('Password1');
    expect(text).not.toContain('secret@example.com');
    expect(text).not.toContain('9876543210');
    expect(text).not.toContain('12 Residency Road');
    expect(text).toContain('[Redacted]');
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
