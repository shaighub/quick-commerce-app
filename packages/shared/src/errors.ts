import { z } from 'zod';

/**
 * Consistent error envelope from the approved design:
 * { error: { code, message, details?, requestId } }.
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.unknown()).optional(),
    requestId: z.string().min(1),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const ErrorCodes = {
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NAME_TAKEN: 'NAME_TAKEN',
  SLUG_TAKEN: 'SLUG_TAKEN',
  SKU_TAKEN: 'SKU_TAKEN',
  CATEGORY_NOT_EMPTY: 'CATEGORY_NOT_EMPTY',
  SUBCATEGORY_NOT_EMPTY: 'SUBCATEGORY_NOT_EMPTY',
  IMAGE_HOST_NOT_ALLOWED: 'IMAGE_HOST_NOT_ALLOWED',
  NOT_SERVICEABLE: 'NOT_SERVICEABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
