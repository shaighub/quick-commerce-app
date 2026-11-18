import { describe, expect, it } from 'vitest';
import { loadConfig, parseConfig } from '../src/config/env.js';

const base = {
  DATABASE_URL: 'postgresql://qc:qc@localhost:5432/quick_commerce',
  JWT_SECRET: 'local-dev-only-jwt-secret-32chars-min',
  JOBS_TOKEN: 'test-jobs-token-value',
  SERVICEABLE_PINCODES: '560001, 560002',
  IMAGE_HOSTS: 'Images.Example.com',
};

describe('config', () => {
  it('applies defaults and parses lists', () => {
    const config = parseConfig(base);
    expect(config.port).toBe(4000);
    expect(config.deliveryFeePaise).toBe(0);
    expect(config.serviceablePincodes).toEqual(['560001', '560002']);
    expect(config.imageHosts).toEqual(['images.example.com']);
    expect(config.docsEnabled).toBe(true);
    expect(config.rateLimitAuthMax).toBe(10);
    expect(config.rateLimitPublicMax).toBe(100);
    expect(config.shutdownTimeoutMs).toBe(10_000);
    expect(config.accessTokenTtlSeconds).toBe(900);
    expect(config.refreshTokenTtlSeconds).toBe(604_800);
  });

  it('turns docs off in production unless enabled', () => {
    expect(parseConfig({ ...base, NODE_ENV: 'production' }).docsEnabled).toBe(false);
    expect(parseConfig({ ...base, NODE_ENV: 'production', DOCS_ENABLED: 'true' }).docsEnabled).toBe(
      true,
    );
  });

  it('rejects a missing secret and a bad pincode', () => {
    expect(() => parseConfig({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => parseConfig({ ...base, SERVICEABLE_PINCODES: '012345' })).toThrow(
      /SERVICEABLE_PINCODES/,
    );
    expect(() => parseConfig({ ...base, IMAGE_HOSTS: 'https://images.example.com' })).toThrow(
      /IMAGE_HOSTS/,
    );
  });

  it('reads the test environment', () => {
    expect(loadConfig().databaseUrl).toContain('quick_commerce_test');
    expect(loadConfig().version).toBe('0.1.0');
  });
});
