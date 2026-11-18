import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time string compare. Hashing first keeps different lengths from throwing. */
export function secretsEqual(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}
