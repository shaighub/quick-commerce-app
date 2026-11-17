import type { AppLogger } from './logger.js';

export interface ClosableServer {
  close(callback?: (error?: Error) => void): void;
}

/**
 * Stops accepting connections and waits for in-flight requests until timeoutMs.
 * A timeout resolves so the caller can still close the database pool (NFR-OPS-03).
 */
export function closeServer(server: ClosableServer, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve();
      }
    }, timeoutMs);

    server.close((error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function shutdown(options: {
  server: ClosableServer;
  closeResources: () => Promise<void>;
  timeoutMs: number;
  logger: AppLogger;
}): Promise<void> {
  options.logger.info({ timeoutMs: options.timeoutMs }, 'draining http server');
  await closeServer(options.server, options.timeoutMs);
  await options.closeResources();
  options.logger.info('shutdown complete');
}
