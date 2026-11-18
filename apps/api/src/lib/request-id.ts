import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const requestIds = new WeakMap<Request, string>();

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function setRequestId(req: Request, id: string): void {
  requestIds.set(req, id);
}

export function getRequestId(req: Request): string {
  return requestIds.get(req) ?? 'unknown';
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('x-request-id');
  const id = header !== undefined && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
  setRequestId(req, id);
  res.setHeader('x-request-id', id);
  next();
}
