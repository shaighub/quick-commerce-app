import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

let cached: Record<string, unknown> | undefined;

export function loadOpenApiSpec(): Record<string, unknown> {
  if (cached) {
    return cached;
  }
  const specPath = fileURLToPath(new URL('../../openapi/openapi.yaml', import.meta.url));
  const document = parse(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
  cached = document;
  return document;
}
