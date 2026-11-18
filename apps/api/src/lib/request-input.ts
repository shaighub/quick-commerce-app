import type { Request } from 'express';

export function queryRecord(query: Request['query']): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      const first = value[0];
      result[key] = typeof first === 'string' ? first : undefined;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

/** Blank optional strings become null so a form can clear an image or description. */
export function normalizeCatalogBody(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return body;
  }
  const source = body as Record<string, unknown>;
  const record: Record<string, unknown> = { ...source };
  for (const key of ['imageUrl', 'description', 'slug']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() === '') {
      record[key] = null;
    }
  }
  return record;
}
