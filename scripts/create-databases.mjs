import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://qc:qc@localhost:5432/quick_commerce?schema=public&connection_limit=5&pool_timeout=10';

const url = new URL(databaseUrl);
url.searchParams.delete('connection_limit');
url.searchParams.delete('pool_timeout');
url.searchParams.delete('schema');

const names = ['quick_commerce_shadow', 'quick_commerce_test'];
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  for (const name of names) {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${name}`);
      console.log(`created ${name}`);
    }
  }
} finally {
  await client.end();
}
