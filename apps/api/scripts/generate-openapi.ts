import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accessTokenResponseSchema,
  authSessionSchema,
  errorResponseSchema,
  healthResponseSchema,
  loginSchema,
  meResponseSchema,
  signupSchema,
} from '@qc/shared';
import { stringify } from 'yaml';
import { z } from 'zod';

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const document = z.toJSONSchema(schema) as Record<string, unknown>;
  delete document.$schema;
  return document;
}

const errorContent = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
};

function errorResponse(description: string) {
  return { description, content: errorContent };
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Quick Commerce API',
    version: '0.1.0',
    description:
      'Auth, health, and the shared error contract. Schemas are generated from packages/shared. Later milestones add catalog, cart, and orders.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Auth' }, { name: 'System' }],
  paths: {
    '/v1/auth/signup': {
      post: {
        operationId: 'signup',
        summary: 'Create a customer account and sign in',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Customer created. Sets the qc_rt refresh cookie.',
            headers: {
              'Set-Cookie': {
                description:
                  'qc_rt refresh token. HttpOnly, Secure, SameSite=Strict, Path=/v1/auth.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthSession' } },
            },
          },
          '400': errorResponse('Request body is not valid JSON'),
          '409': errorResponse('EMAIL_TAKEN'),
          '422': errorResponse('VALIDATION'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/login': {
      post: {
        operationId: 'login',
        summary: 'Log in with email and password',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Signed in. Sets the qc_rt refresh cookie.',
            headers: {
              'Set-Cookie': {
                description:
                  'qc_rt refresh token. HttpOnly, Secure, SameSite=Strict, Path=/v1/auth.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthSession' } },
            },
          },
          '400': errorResponse('Request body is not valid JSON'),
          '401': errorResponse('INVALID_CREDENTIALS'),
          '422': errorResponse('VALIDATION'),
          '423': errorResponse('ACCOUNT_LOCKED. details[0].retryAfter is seconds.'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/refresh': {
      post: {
        operationId: 'refresh',
        summary: 'Rotate the refresh cookie and issue a new access token',
        tags: ['Auth'],
        parameters: [
          {
            in: 'header',
            name: 'X-Requested-With',
            required: true,
            schema: { type: 'string' },
          },
          { in: 'cookie', name: 'qc_rt', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Access token issued and qc_rt rotated.',
            headers: {
              'Set-Cookie': {
                description: 'Replacement qc_rt cookie.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AccessTokenResponse' } },
            },
          },
          '401': errorResponse('TOKEN_INVALID'),
          '403': errorResponse('Missing X-Requested-With or foreign Origin'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/logout': {
      post: {
        operationId: 'logout',
        summary: 'Revoke the current refresh token and clear the cookie',
        tags: ['Auth'],
        parameters: [
          {
            in: 'header',
            name: 'X-Requested-With',
            required: true,
            schema: { type: 'string' },
          },
          { in: 'cookie', name: 'qc_rt', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '204': { description: 'Refresh token revoked and cookie cleared.' },
          '403': errorResponse('Missing X-Requested-With or foreign Origin'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/logout-all': {
      post: {
        operationId: 'logoutAll',
        summary: 'Revoke every session for the current user',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'header',
            name: 'X-Requested-With',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': {
            description:
              'users.token_version incremented, every refresh token revoked, cookie cleared.',
          },
          '401': errorResponse('UNAUTHORIZED or TOKEN_INVALID'),
          '403': errorResponse('Missing X-Requested-With or foreign Origin'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/auth/me': {
      get: {
        operationId: 'me',
        summary: 'Current user and the latest delivery address',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile. lastAddress is null until the user has placed an order.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MeResponse' } },
            },
          },
          '401': errorResponse('UNAUTHORIZED, TOKEN_INVALID, or TOKEN_EXPIRED'),
          '429': errorResponse('RATE_LIMITED'),
        },
      },
    },
    '/v1/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Health check',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Database is reachable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          '503': {
            description: 'Database is not reachable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      SignupRequest: jsonSchema(signupSchema),
      LoginRequest: jsonSchema(loginSchema),
      AuthSession: jsonSchema(authSessionSchema),
      AccessTokenResponse: jsonSchema(accessTokenResponseSchema),
      MeResponse: jsonSchema(meResponseSchema),
      HealthResponse: jsonSchema(healthResponseSchema),
      ErrorResponse: jsonSchema(errorResponseSchema),
    },
  },
};

const header = '# Generated from packages/shared Zod schemas. Do not edit by hand.\n';
const text = `${header}${stringify(spec)}`;
const specPath = resolve(dirname(fileURLToPath(import.meta.url)), '../openapi/openapi.yaml');
const check = process.argv.includes('--check');

if (check) {
  const current = readFileSync(specPath, 'utf8');
  if (current !== text) {
    process.stderr.write('openapi.yaml is out of date. Run npm run openapi:generate -w @qc/api\n');
    process.exit(1);
  }
} else {
  writeFileSync(specPath, text);
}
