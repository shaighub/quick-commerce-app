import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { readCookie, readRefreshCookie } from '../src/lib/cookies.js';
import { clientIp, requestMeta } from '../src/lib/client-ip.js';
import { setRequestId } from '../src/lib/request-id.js';

describe('cookies and client ip', () => {
  it('reads the named cookie and ignores a broken escape', () => {
    expect(readCookie(undefined, 'qc_rt')).toBeUndefined();
    expect(readCookie('other=1', 'qc_rt')).toBeUndefined();
    expect(readCookie('qc_rt=abc%2Fdef; theme=dark', 'qc_rt')).toBe('abc/def');
    expect(readCookie('qc_rt=%', 'qc_rt')).toBeUndefined();
    expect(readCookie('noequals', 'qc_rt')).toBeUndefined();
  });

  it('reads qc_rt from the request', () => {
    const req = {
      get: (name: string) => (name === 'cookie' ? 'qc_rt=raw-token' : undefined),
    } as unknown as Request;
    expect(readRefreshCookie(req)).toBe('raw-token');
  });

  it('normalizes mapped IPv4 and rejects garbage', () => {
    expect(clientIp({ ip: '::ffff:127.0.0.1' } as unknown as Request)).toBe('127.0.0.1');
    expect(clientIp({ ip: '::1' } as unknown as Request)).toBe('::1');
    expect(clientIp({ ip: '999.1.1.1' } as unknown as Request)).toBeNull();
    expect(clientIp({ ip: undefined } as unknown as Request)).toBeNull();
    expect(clientIp({ ip: 'not an ip' } as unknown as Request)).toBeNull();
  });

  it('builds request meta with a truncated user agent', () => {
    const req = {
      ip: '10.0.0.8',
      get: (name: string) => (name === 'user-agent' ? 'a'.repeat(300) : undefined),
    } as unknown as Request;
    setRequestId(req, 'req-meta');
    const meta = requestMeta(req);
    expect(meta.ip).toBe('10.0.0.8');
    expect(meta.userAgent).toHaveLength(255);
    expect(meta.requestId).toBe('req-meta');
  });

  it('omits a missing user agent', () => {
    const req = { ip: '10.0.0.8', get: () => undefined } as unknown as Request;
    setRequestId(req, 'req-meta-2');
    expect(requestMeta(req).userAgent).toBeNull();
  });
});
