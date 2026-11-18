import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type { CatalogCache } from './catalog-cache.js';

export const CATALOG_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

export function catalogEtag(body: string): string {
  return `"${createHash('sha256').update(body).digest('hex')}"`;
}

export function ifNoneMatch(header: string | undefined, etag: string): boolean {
  if (!header) {
    return false;
  }
  return header.split(',').some((part) => {
    const token = part.trim();
    return token === etag || token === `W/${etag}`;
  });
}

function write(req: Request, res: Response, body: string, etag: string): void {
  res.setHeader('Cache-Control', CATALOG_CACHE_CONTROL);
  res.setHeader('ETag', etag);
  if (ifNoneMatch(req.get('if-none-match'), etag)) {
    res.status(304).end();
    return;
  }
  res.status(200).type('application/json; charset=utf-8').send(body);
}

/** Returns true when a fresh cache entry was written to the response. */
export function sendCached(req: Request, res: Response, cache: CatalogCache, key: string): boolean {
  const hit = cache.get(key);
  if (!hit) {
    return false;
  }
  write(req, res, hit.body, hit.etag);
  return true;
}

export function storeAndSend(
  req: Request,
  res: Response,
  cache: CatalogCache,
  key: string,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  const etag = catalogEtag(body);
  cache.set(key, body, etag);
  write(req, res, body, etag);
}
