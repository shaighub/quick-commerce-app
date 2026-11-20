import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import autocannon from 'autocannon';
import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://qc:qc@localhost:5432/quick_commerce?schema=public&connection_limit=5&pool_timeout=10';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
const subcategoryId = '20000000-0000-4000-8000-000000000001';
const client = new pg.Client({ connectionString: databaseUrl });

function percentile(samples, ratio) {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)];
}

async function explain(sql) {
  const result = await client.query(`EXPLAIN ${sql}`);
  return result.rows.map((row) => row['QUERY PLAN']).join('\n');
}

async function cannon(options) {
  const result = await autocannon(options);
  return {
    requests: result.requests.total,
    non2xx: result.non2xx,
    latencyMs: {
      p50: result.latency.p50,
      p90: result.latency.p90,
      p97_5: result.latency.p97_5,
      p99: result.latency.p99,
    },
  };
}

await client.connect();
const report = { ranAt: new Date().toISOString(), productCount: 0, plans: {}, http: {} };

try {
  await client.query(`DELETE FROM products WHERE sku LIKE 'LOAD-%'`);
  await client.query(
    `INSERT INTO products (subcategory_id, name, slug, sku, description, unit_label, price_paise, stock, is_active)
     SELECT $1, 'Load milk ' || i, 'load-milk-' || i, 'LOAD-' || lpad(i::text, 6, '0'),
            'Bulk catalog row for the latency check', '1 L', 1000 + (i % 500), 20, true
     FROM generate_series(1, 10000) AS i`,
    [subcategoryId],
  );
  await client.query('ANALYZE products');
  const count = await client.query(
    `SELECT COUNT(*)::int AS total FROM products WHERE deleted_at IS NULL AND is_active = true`,
  );
  report.productCount = count.rows[0].total;

  report.plans.listing = await explain(`
    SELECT p.id
    FROM products p
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id
    WHERE p.deleted_at IS NULL AND p.is_active = true
      AND s.deleted_at IS NULL AND s.is_active = true
      AND c.deleted_at IS NULL AND c.is_active = true
    ORDER BY p.created_at DESC, p.id ASC
    LIMIT 24`);
  report.plans.search = await explain(`
    SELECT p.id
    FROM products p
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id
    WHERE p.deleted_at IS NULL AND p.is_active = true
      AND s.deleted_at IS NULL AND s.is_active = true
      AND c.deleted_at IS NULL AND c.is_active = true
      AND p.search_vector @@ websearch_to_tsquery('simple', 'load milk')
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('simple', 'load milk')) DESC, p.id ASC
    LIMIT 24`);

  const health = await fetch(`${apiBase}/v1/health`);
  if (!health.ok) {
    throw new Error(`API health returned ${health.status}`);
  }

  const email = `load-${randomUUID().slice(0, 8)}@example.com`;
  const signup = await fetch(`${apiBase}/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Load Test', email, password: 'Password1' }),
  });
  if (!signup.ok) {
    throw new Error(`signup failed ${signup.status} ${await signup.text()}`);
  }
  const session = await signup.json();

  report.http.listing = await cannon({
    url: `${apiBase}/v1/products`,
    connections: 10,
    duration: 5,
    headers: { accept: 'application/json' },
  });

  let searchIndex = 0;
  report.http.search = await cannon({
    url: `${apiBase}/v1/products`,
    connections: 10,
    duration: 5,
    headers: { accept: 'application/json' },
    setupRequest(request) {
      searchIndex += 1;
      request.path = `/v1/products?q=${encodeURIComponent(`load milk ${searchIndex}`)}`;
      return request;
    },
  });

  if (report.http.listing.non2xx > 0 || report.http.search.non2xx > 0) {
    throw new Error('Catalog load received non-2xx responses. Raise the API rate limits.');
  }

  const product = await fetch(`${apiBase}/v1/products/amul-taaza-milk-1l`);
  const productBody = await product.json();
  const productId = productBody.product.id;
  await client.query(`UPDATE products SET stock = 100000 WHERE id = $1`, [productId]);

  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    const added = await fetch(`${apiBase}/v1/cart/items`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    if (!added.ok) {
      throw new Error(`add cart failed ${added.status}`);
    }
    const cart = await added.json();
    const started = performance.now();
    const order = await fetch(`${apiBase}/v1/orders/checkout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.accessToken}`,
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify({
        address: {
          name: 'Load Test',
          phone: '9876543210',
          line1: '12 Residency Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        payment: { method: 'MOCK', simulate: 'success' },
        expectedTotalPaise: cart.totalPaise,
      }),
    });
    samples.push(performance.now() - started);
    if (!order.ok) {
      throw new Error(`checkout failed ${order.status} ${await order.text()}`);
    }
  }
  report.http.checkout = {
    samples: samples.length,
    latencyMs: {
      p50: percentile(samples, 0.5),
      p90: percentile(samples, 0.9),
      p95: percentile(samples, 0.95),
      p99: percentile(samples, 0.99),
    },
  };

  await client.query(`DELETE FROM orders WHERE ship_name = 'Load Test'`);
  await client.query(`UPDATE products SET stock = 40 WHERE slug = 'amul-taaza-milk-1l'`);
} finally {
  await client.query(`DELETE FROM products WHERE sku LIKE 'LOAD-%'`).catch(() => undefined);
  await client.end();
}

mkdirSync('docs/04-testing', { recursive: true });
writeFileSync('docs/04-testing/load-results.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

const listing = report.http.listing?.latencyMs.p97_5 ?? Number.POSITIVE_INFINITY;
const search = report.http.search?.latencyMs.p97_5 ?? Number.POSITIVE_INFINITY;
if (listing > 500 || search > 500) {
  console.error('Catalog p97.5 exceeded 500 ms');
  process.exit(1);
}
