import { z } from 'zod';

export const uuidSchema = z.uuid();

/** Indian postal code. Serviceability is a separate allow-list check. */
export const indianPincodeSchema = z
  .string()
  .regex(/^[1-9][0-9]{5}$/, 'Pincode must be a 6-digit Indian pincode');

/** Rs 1 = 100 paise. Money is never a float. */
export const pricePaiseSchema = z.number().int().positive();
