import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorResponseSchema, healthResponseSchema } from '@qc/shared';
import { stringify } from 'yaml';
import { z } from 'zod';

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const document = z.toJSONSchema(schema) as Record<string, unknown>;
  delete document.$schema;
  return document;
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Quick Commerce API',
    version: '0.1.0',
    description:
      'Milestone 1 exposes the health check and the shared error contract. Later milestones add paths from the Zod schemas in packages/shared.',
  },
  servers: [{ url: '/' }],
  paths: {
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
    schemas: {
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
