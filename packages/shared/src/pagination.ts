import { z } from 'zod';

/** List query shared by catalog and order endpoints. page max 20, pageSize max 50. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(20).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
