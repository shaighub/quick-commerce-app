import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

function chromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }
  return execFileSync(
    'node',
    [
      '--input-type=module',
      '-e',
      "import { chromium } from '@playwright/test'; process.stdout.write(chromium.executablePath())",
    ],
    { encoding: 'utf8' },
  ).trim();
}

const base = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4173';
const pages = [
  { name: 'home', url: `${base}/` },
  { name: 'product', url: `${base}/p/amul-butter-500g` },
];

const chrome = await launch({
  chromePath: chromePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

const results = [];
try {
  for (const page of pages) {
    const runner = await lighthouse(page.url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    if (!runner) {
      throw new Error(`Lighthouse returned no result for ${page.url}`);
    }
    const { lhr } = runner;
    const scores = {};
    for (const [key, category] of Object.entries(lhr.categories)) {
      scores[key] = Math.round((category.score ?? 0) * 100);
    }
    results.push({
      name: page.name,
      url: page.url,
      scores,
      lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
      cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
      inp: lhr.audits['interaction-to-next-paint']?.numericValue ?? null,
      tbt: lhr.audits['total-blocking-time']?.numericValue ?? null,
    });
  }
} finally {
  await chrome.kill();
}

mkdirSync('docs/04-testing', { recursive: true });
const report = {
  ranAt: new Date().toISOString(),
  node: process.version,
  targets: {
    performance: 90,
    accessibility: 90,
    bestPractices: 90,
    seo: 90,
    lcpMs: 2500,
    inpMs: 200,
    cls: 0.1,
  },
  results,
};
writeFileSync('docs/04-testing/lighthouse-results.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

const missed = results.filter(
  (result) => result.scores.performance < 90 || result.scores.accessibility < 90,
);
if (missed.length > 0) {
  console.error('Performance or accessibility is below 90');
  process.exit(1);
}
