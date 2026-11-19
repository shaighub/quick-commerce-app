import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assets = 'apps/web/dist/assets';
const budgetBytes = 350 * 1024;
let gzipTotal = 0;
const files = [];

for (const name of readdirSync(assets)) {
  if (!name.endsWith('.js')) {
    continue;
  }
  const path = join(assets, name);
  const bytes = statSync(path).size;
  const gzip = gzipSync(readFileSync(path)).length;
  gzipTotal += gzip;
  files.push({ name, bytes, gzip });
}

const summary = { gzipTotal, budgetBytes, files };
console.log(JSON.stringify(summary, null, 2));
if (gzipTotal > budgetBytes) {
  console.error(`JS gzip total ${gzipTotal} exceeds ${budgetBytes}`);
  process.exit(1);
}
