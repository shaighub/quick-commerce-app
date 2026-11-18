import type { ApiError } from '../api/client.js';

export function fieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && result[key] === undefined) {
      result[key] = issue.message;
    }
  }
  return result;
}

export function detailsToFields(details: unknown[] | undefined): Record<string, string> {
  if (!details) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const item of details) {
    if (typeof item !== 'object' || item === null || !('path' in item) || !('message' in item)) {
      continue;
    }
    const path = item.path;
    const message = item.message;
    if (typeof path === 'string' && typeof message === 'string' && result[path] === undefined) {
      result[path] = message;
    }
  }
  return result;
}

export function retryAfterSeconds(details: unknown[] | undefined): number | undefined {
  const first = details?.[0];
  if (typeof first !== 'object' || first === null || !('retryAfter' in first)) {
    return undefined;
  }
  const value = first.retryAfter;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function formErrorMessage(error: ApiError): string {
  if (error.code !== 'ACCOUNT_LOCKED') {
    return error.message;
  }
  const retryAfter = retryAfterSeconds(error.details);
  if (retryAfter === undefined) {
    return error.message;
  }
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return `${error.message} Try again in ${minutes} minutes.`;
}
