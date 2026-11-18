import type { Request } from 'express';
import type { RequestMeta } from '../domain/auth.js';
import { getRequestId } from './request-id.js';

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** Accepts an IPv4 address, including the IPv4-mapped form Node reports for IPv6 sockets. */
export function clientIp(req: Request): string | null {
  const raw = req.ip;
  if (!raw) {
    return null;
  }
  const mapped = raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
  if (IPV4.test(mapped)) {
    const octets = mapped.split('.');
    if (octets.every((part) => Number(part) <= 255)) {
      return mapped;
    }
  }
  if (raw.includes(':') && /^[0-9a-fA-F:]+$/.test(raw)) {
    return raw;
  }
  return null;
}

export function requestMeta(req: Request): RequestMeta {
  const userAgent = req.get('user-agent');
  return {
    ip: clientIp(req),
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
    requestId: getRequestId(req),
  };
}
