import { Writable } from 'node:stream';
import type { AppConfig } from '../src/config/env.js';
import { loadConfig } from '../src/config/env.js';
import { createLogger, type AppLogger } from '../src/lib/logger.js';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig(), ...overrides };
}

export function silentLogger(): AppLogger {
  return createLogger({ logLevel: 'silent' });
}

export function collectingLogger(): { logger: AppLogger; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return {
    logger: createLogger({ logLevel: 'info' }, stream),
    lines: () => chunks,
  };
}
