import { Prisma } from '../generated/prisma/client.js';

export type UniqueConflict = 'NAME_TAKEN' | 'SLUG_TAKEN' | 'SKU_TAKEN';

export function uniqueConflict(error: unknown): UniqueConflict | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const target = error.meta?.target;
  const text = Array.isArray(target)
    ? target.filter((item): item is string => typeof item === 'string').join(' ')
    : typeof target === 'string'
      ? target
      : '';
  if (text.includes('sku')) {
    return 'SKU_TAKEN';
  }
  if (text.includes('slug')) {
    return 'SLUG_TAKEN';
  }
  return 'NAME_TAKEN';
}
