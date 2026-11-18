import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  db: z.enum(['up', 'down']),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
