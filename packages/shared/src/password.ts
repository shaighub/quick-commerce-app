import { z } from 'zod';

/** NFR-SEC-01: 8+ characters with at least one letter and one number. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

export type Password = z.infer<typeof passwordSchema>;
