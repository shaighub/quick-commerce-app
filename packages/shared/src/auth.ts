import { z } from 'zod';
import { roleSchema } from './enums.js';
import { uuidSchema } from './ids.js';
import { passwordSchema } from './password.js';

/**
 * Signup and login share this shape. Stored emails are lowercase; callers
 * normalize before the uniqueness check so Address@Host and address@host collide.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'Email must be at most 254 characters')
  .pipe(z.email('Enter a valid email address'));

/** E.164, for example +919876543210. The users.phone column is varchar(15). */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format, for example +919876543210')
  .max(15, 'Phone must be at most 15 characters');

/** bcrypt only uses the first 72 bytes, so longer passwords are rejected outright. */
export const signupPasswordSchema = passwordSchema.max(
  72,
  'Password must be at most 72 characters',
);

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email: emailSchema,
  password: signupPasswordSchema,
  phone: phoneSchema.optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Password is required')
    .max(72, 'Password must be at most 72 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const publicUserSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: emailSchema,
  role: roleSchema,
});

export type PublicUser = z.infer<typeof publicUserSchema>;

/** Address snapshot returned by GET /v1/auth/me. Checkout reuses the same fields. */
export const deliveryAddressSchema = z.object({
  name: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
});

export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

export const authSessionSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string().min(1),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

export const accessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>;

export const meUserSchema = publicUserSchema.extend({
  lastAddress: deliveryAddressSchema.nullable(),
});

export type MeUser = z.infer<typeof meUserSchema>;

export const meResponseSchema = z.object({
  user: meUserSchema,
});

export type MeResponse = z.infer<typeof meResponseSchema>;
