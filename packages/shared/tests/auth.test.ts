import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema } from '../src/index.js';

describe('auth contracts', () => {
  it('accepts a customer signup and strips a role field', () => {
    const parsed = signupSchema.parse({
      name: '  Asha Rao  ',
      email: '  Asha@Example.com  ',
      password: 'Password1',
      phone: '+919876543210',
      role: 'ADMIN',
    });
    expect(parsed).toEqual({
      name: 'Asha Rao',
      email: 'Asha@Example.com',
      password: 'Password1',
      phone: '+919876543210',
    });
    expect(parsed).not.toHaveProperty('role');
  });

  it('rejects a weak password, a bad phone, and a missing name', () => {
    expect(
      signupSchema.safeParse({ name: 'Asha', email: 'a@b.co', password: 'password' }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ name: 'Asha', email: 'a@b.co', password: 'short1' }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({
        name: 'Asha',
        email: 'a@b.co',
        password: 'Password1',
        phone: '9876543210',
      }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ name: '   ', email: 'a@b.co', password: 'Password1' }).success,
    ).toBe(false);
  });

  it('accepts a login without applying the signup password policy to a wrong guess', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: 'not-the-policy' })).toEqual({
      email: 'a@b.co',
      password: 'not-the-policy',
    });
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'Password1' }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});
