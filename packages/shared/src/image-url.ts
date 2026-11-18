import { z } from 'zod';
import { ErrorCodes } from './errors.js';

/** https URL whose host is in the IMAGE_HOSTS allowlist (NFR-SEC-07). */
export function createImageUrlSchema(hosts: readonly string[]) {
  const allowed = new Set(hosts.map((host) => host.toLowerCase()));
  return z
    .string()
    .trim()
    .min(1, 'Image URL is required')
    .max(2048, 'Image URL must be at most 2048 characters')
    .superRefine((value, ctx) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Image URL must be a valid URL' });
        return;
      }
      if (url.protocol !== 'https:') {
        ctx.addIssue({ code: 'custom', message: 'Image URL must use https' });
        return;
      }
      if (url.username !== '' || url.password !== '') {
        ctx.addIssue({ code: 'custom', message: 'Image URL must not include credentials' });
        return;
      }
      if (url.hostname === '') {
        ctx.addIssue({ code: 'custom', message: 'Image URL must include a host' });
        return;
      }
      if (!allowed.has(url.hostname.toLowerCase())) {
        ctx.addIssue({ code: 'custom', message: ErrorCodes.IMAGE_HOST_NOT_ALLOWED });
      }
    });
}

export function optionalImageUrlSchema(hosts: readonly string[]) {
  return z.union([createImageUrlSchema(hosts), z.null()]).optional();
}
