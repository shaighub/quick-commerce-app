import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import {
  detailsToFields,
  fieldErrors,
  formErrorMessage,
  retryAfterSeconds,
} from '../src/auth/messages.js';
import { safeNextPath } from '../src/auth/safe-next.js';

describe('auth helpers', () => {
  it('keeps only a same-origin relative next path', () => {
    expect(safeNextPath('/cart?from=home')).toBe('/cart?from=home');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil')).toBe('/');
    expect(safeNextPath('/redirect?to=https://evil.example')).toBe('/');
  });

  it('maps the first field error and a lockout retry', () => {
    expect(
      fieldErrors([
        { path: ['email'], message: 'Email is required' },
        { path: ['email'], message: 'ignored' },
        { path: [0], message: 'skipped' },
      ]),
    ).toEqual({ email: 'Email is required' });
    expect(detailsToFields(undefined)).toEqual({});
    expect(detailsToFields([{ path: 'password', message: 'Too short' }, 'nope'])).toEqual({
      password: 'Too short',
    });
    expect(retryAfterSeconds(undefined)).toBeUndefined();
    expect(retryAfterSeconds([{ retryAfter: 'soon' }])).toBeUndefined();
    expect(retryAfterSeconds([{ retryAfter: 120 }])).toBe(120);

    const locked = new ApiError(423, 'ACCOUNT_LOCKED', 'Too many failed attempts.', 'req', [
      { retryAfter: 61 },
    ]);
    expect(formErrorMessage(locked)).toBe('Too many failed attempts. Try again in 2 minutes.');
    const plain = new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect', 'req');
    expect(formErrorMessage(plain)).toBe('Email or password is incorrect');
    const lockedWithoutRetry = new ApiError(423, 'ACCOUNT_LOCKED', 'Locked', 'req');
    expect(formErrorMessage(lockedWithoutRetry)).toBe('Locked');
  });
});
