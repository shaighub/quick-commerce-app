# Contributing

## Standards

- TypeScript strict, ESLint, and Prettier. CI rejects lint or format failures.
- Conventional Commits. `commitlint` runs in the commit-msg hook.
- Layered API and presentational UI. See `AGENTS.md`.
- Zod schemas in `packages/shared` are the API contract. Regenerate OpenAPI with `npm run openapi:generate -w @qc/api` and commit `apps/api/openapi/openapi.yaml`.
- Tests cover the acceptance criterion you are implementing. Line coverage stays at 80% or higher.
- No secrets. `gitleaks` runs in the pre-commit hook and in CI. Install the `gitleaks` binary locally so commits succeed.

## Before a pull request

```bash
npm run lint
npm run format:check
npm run typecheck
npm run db:migrate
npm run db:drift
npm run openapi:check
npm run test:coverage
npm run build
node scripts/audit-deps.mjs
```

`npm run db:drift` needs `DATABASE_URL` (already migrated) and `SHADOW_DATABASE_URL` (an empty database). Defaults point at local `quick_commerce` and `quick_commerce_shadow`.

## Audit exception

`node scripts/audit-deps.mjs` fails on high or critical advisories. Production dependencies must be clean with no exceptions. The only allowlisted advisory is `GHSA-fc5q-39xc-vjpf` (picomatch ReDoS). Picomatch 4.0.7 is the latest release and has no patch. It is pulled in only by Vite, Vitest, ESLint, and lint-staged. Remove the allowlist entry when a patched picomatch is published.

## Pull requests

Short-lived branches off `main`. One concern per PR. Describe the requirement, the tests you ran, and any design deviation.
