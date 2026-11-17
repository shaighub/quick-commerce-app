import { describe, expect, it, vi } from 'vitest';
import { closeServer, shutdown } from '../src/lib/shutdown.js';
import { silentLogger } from './helpers.js';

describe('shutdown', () => {
  it('resolves when the server closes', async () => {
    const server = {
      close(callback?: (error?: Error) => void) {
        callback?.();
      },
    };
    await expect(closeServer(server, 50)).resolves.toBeUndefined();
  });

  it('rejects when close fails', async () => {
    const server = {
      close(callback?: (error?: Error) => void) {
        callback?.(new Error('close failed'));
      },
    };
    await expect(closeServer(server, 50)).rejects.toThrow('close failed');
  });

  it('stops waiting after the timeout and still closes resources', async () => {
    const server = {
      close(_callback?: (error?: Error) => void) {
        // Never calls back.
      },
    };
    const closeResources = vi.fn(() => Promise.resolve());
    await shutdown({ server, closeResources, timeoutMs: 15, logger: silentLogger() });
    expect(closeResources).toHaveBeenCalledOnce();
  });
});
