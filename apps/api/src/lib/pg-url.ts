/** Drops Prisma-only query params so node-postgres does not send them to the server. */
export function toPgConnectionString(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.delete('connection_limit');
  url.searchParams.delete('pool_timeout');
  url.searchParams.delete('schema');
  return url.toString();
}

export function connectionLimit(databaseUrl: string): number {
  const raw = new URL(databaseUrl).searchParams.get('connection_limit');
  const parsed = raw === null ? 5 : Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
}
