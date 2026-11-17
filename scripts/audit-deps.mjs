import { execFileSync } from 'node:child_process';

/**
 * Fail the build on high or critical advisories.
 * GHSA-fc5q-39xc-vjpf (picomatch ReDoS) has no patched release as of 2026-11-17.
 * It is only pulled in by dev tooling (Vite, Vitest, ESLint, lint-staged), never by the API runtime.
 * Production dependencies are also checked with no exceptions.
 */

const ALLOWED = new Set(['GHSA-fc5q-39xc-vjpf']);

function runAudit(args) {
  try {
    return execFileSync('npm', ['audit', '--json', ...args], { encoding: 'utf8' });
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error && error.stdout) {
      return String(error.stdout);
    }
    throw error;
  }
}

const production = JSON.parse(runAudit(['--omit=dev']));
const productionVulns = Object.values(production.vulnerabilities ?? {});
if (productionVulns.length > 0) {
  console.error('Production dependencies have advisories:');
  for (const vuln of productionVulns) {
    console.error(`- ${vuln.severity} ${vuln.name}`);
  }
  process.exit(1);
}

const full = JSON.parse(runAudit([]));
const blocked = [];
for (const meta of Object.values(full.vulnerabilities ?? {})) {
  for (const via of meta.via ?? []) {
    if (typeof via !== 'object') {
      continue;
    }
    if (via.severity !== 'high' && via.severity !== 'critical') {
      continue;
    }
    const id = String(via.url ?? '')
      .split('/')
      .pop();
    if (!ALLOWED.has(id)) {
      blocked.push(`${via.severity} ${id} ${via.title}`);
    }
  }
}

if (blocked.length > 0) {
  console.error('High or critical advisories without an allowlist entry:');
  for (const line of blocked) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log('audit: production dependencies are clean');
console.log('audit: remaining high advisory is the unpatched picomatch ReDoS in dev tools only');
