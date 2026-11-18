import { ErrorCodes } from './errors.js';

/** True when the pincode is in SERVICEABLE_PINCODES. Format checks stay on the Zod schema. */
export function isPincodeServiceable(pincode: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(pincode);
}

/**
 * Checkout (Milestone 4) rejects an unserved pincode with 422 NOT_SERVICEABLE
 * before it touches stock. The catalog milestone exposes the same decision.
 */
export function refusalForUnserviceablePincode(
  pincode: string,
  allowlist: readonly string[],
): { code: typeof ErrorCodes.NOT_SERVICEABLE; message: string } | null {
  if (isPincodeServiceable(pincode, allowlist)) {
    return null;
  }
  return {
    code: ErrorCodes.NOT_SERVICEABLE,
    message: 'Delivery is not available for this pincode',
  };
}
