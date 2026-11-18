import { describe, expect, it } from 'vitest';
import { BCRYPT_COST, createPasswordService } from '../src/services/password.service.js';

describe('password service', () => {
  it('hashes with bcrypt cost 12 and verifies only the same password', async () => {
    expect(BCRYPT_COST).toBe(12);
    const passwords = createPasswordService();
    const hash = await passwords.hash('Password1');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash.includes('$12$')).toBe(true);
    expect(hash).not.toBe('Password1');
    const again = await passwords.hash('Password1');
    expect(again).not.toBe(hash);
    await expect(passwords.verify('Password1', hash)).resolves.toBe(true);
    await expect(passwords.verify('Password2', hash)).resolves.toBe(false);
  });

  it('spends a compare for an unknown email without throwing', async () => {
    const passwords = createPasswordService();
    await expect(passwords.verifyUnknown('Password1')).resolves.toBeUndefined();
    await expect(passwords.verifyUnknown('Password1')).resolves.toBeUndefined();
  });
});
