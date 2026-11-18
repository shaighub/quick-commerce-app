import { pino, type Logger } from 'pino';
import type { AppConfig } from '../config/env.js';

export type AppLogger = Logger;

const SLOW_QUERY_MS = 200;

export function createLogger(
  config: Pick<AppConfig, 'logLevel'>,
  destination?: pino.DestinationStream,
): AppLogger {
  return pino(
    {
      level: config.logLevel,
      base: { service: 'api' },
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'res.headers["set-cookie"]',
      ],
    },
    destination,
  );
}

/** Logs parameterized SQL that exceeds the slow-query threshold. Params are omitted. */
export function logSlowQuery(logger: AppLogger, event: { duration: number; query: string }): void {
  if (event.duration >= SLOW_QUERY_MS) {
    logger.warn({ durationMs: event.duration, query: event.query }, 'slow query');
  }
}
