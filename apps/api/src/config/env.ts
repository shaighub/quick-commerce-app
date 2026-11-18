import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { indianPincodeSchema } from '@qc/shared';
import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown =>
  value === undefined || value === '' ? undefined : value;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_VERSION: z.string().min(1).default('0.1.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JOBS_TOKEN: z.string().min(16),
  DELIVERY_FEE_PAISE: z.coerce.number().int().nonnegative().default(0),
  SERVICEABLE_PINCODES: z.string().default(''),
  IMAGE_HOSTS: z.string().default(''),
  DOCS_ENABLED: z.preprocess(emptyToUndefined, z.enum(['true', 'false']).optional()),
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.url().optional()),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  /** Access JWT lifetime. 900 seconds is the 15-minute design default. */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Refresh cookie lifetime. 604800 seconds is the 7-day design default. */
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  version: string;
  databaseUrl: string;
  jwtSecret: string;
  jobsToken: string;
  deliveryFeePaise: number;
  serviceablePincodes: string[];
  imageHosts: string[];
  docsEnabled: boolean;
  sentryDsn: string | undefined;
  rateLimitPublicMax: number;
  rateLimitAuthMax: number;
  rateLimitWindowMs: number;
  shutdownTimeoutMs: number;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }
  return parse(readFileSync(path));
}

function parsePincodes(value: string): string[] {
  if (value.trim() === '') {
    return [];
  }
  return value.split(',').map((entry) => {
    const code = entry.trim();
    const parsed = indianPincodeSchema.safeParse(code);
    if (!parsed.success) {
      throw new Error(`Invalid SERVICEABLE_PINCODES entry: ${code}`);
    }
    return parsed.data;
  });
}

function parseHosts(value: string): string[] {
  if (value.trim() === '') {
    return [];
  }
  return value.split(',').map((entry) => {
    const host = entry.trim().toLowerCase();
    if (
      !/^[a-z0-9.-]+$/.test(host) ||
      host.startsWith('.') ||
      host.endsWith('.') ||
      host.includes('..')
    ) {
      throw new Error(`Invalid IMAGE_HOSTS entry: ${entry.trim()}`);
    }
    return host;
  });
}

export function parseConfig(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  const env = parsed.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    version: env.APP_VERSION,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jobsToken: env.JOBS_TOKEN,
    deliveryFeePaise: env.DELIVERY_FEE_PAISE,
    serviceablePincodes: parsePincodes(env.SERVICEABLE_PINCODES),
    imageHosts: parseHosts(env.IMAGE_HOSTS),
    docsEnabled:
      env.DOCS_ENABLED !== undefined ? env.DOCS_ENABLED === 'true' : env.NODE_ENV !== 'production',
    sentryDsn: env.SENTRY_DSN,
    rateLimitPublicMax: env.RATE_LIMIT_PUBLIC_MAX,
    rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    accessTokenTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTokenTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
  };
}

/** Process env wins, then apps/api/.env, then the repo-root .env. */
export function loadConfig(source?: NodeJS.ProcessEnv): AppConfig {
  if (source) {
    return parseConfig(source);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const merged: NodeJS.ProcessEnv = {
    ...readEnvFile(resolve(here, '../../../.env')),
    ...readEnvFile(resolve(here, '../../.env')),
    ...process.env,
  };
  return parseConfig(merged);
}
