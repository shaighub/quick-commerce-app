# Agent guide

This file is the working agreement for every change in this repository. The approved design in `docs/design.md` is the source of truth. Org standards are summarized in `CONTRIBUTING.md` and enforced by the tooling.

## Architecture

npm workspaces:

- `apps/api` — Express REST API. Routes call controllers. Controllers call services. Services call repositories. No business logic in controllers.
- `apps/web` — React storefront and admin panel. Pages compose components. No business rules in components; call the API and render the result.
- `packages/shared` — Zod schemas and types used by the API, the web forms, and the generated OpenAPI document.

Money is an integer number of paise everywhere except the UI, which formats rupees with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

Errors use `{ error: { code, message, details?, requestId } }`. Lists use `page` and `pageSize` (default 24, max 50, page max 20).

The browser calls `/v1` on the web origin. Vite proxies that path locally. `apps/web/vercel.json` rewrites it to the API (ADR-004). CORS stays deny-all.

## Milestone boundary

Milestone 1 is the foundation: tooling, the full database, the API skeleton (`GET /v1/health`, docs, errors), and placeholder screens. Milestone 2 adds auth (sign-up, login, refresh, logout, lockout, and route guards). Do not add catalog, cart, or order behavior until those milestones. The seed may insert an admin and sample products. Sign-up must not create an admin.

## Data

- Prisma schema: `apps/api/prisma/schema.prisma`.
- Partial unique indexes, `lower(name)` indexes, `pg_trgm`, the generated `search_vector`, and CHECK constraints live in `prisma/migrations` because the schema cannot represent them. Do not drop them. `prisma migrate diff` in CI compares the migrated database with the migration history.
- `products.search_vector` is optional in the Prisma client so inserts omit it. PostgreSQL generates it.
- Soft-deleted catalog rows stay in the table. Partial unique indexes allow the name or slug to be reused.

## API rules

- Validate every body, query, and param with a Zod schema from `packages/shared`.
- Throw `AppError` for expected failures. The error handler maps unknown errors to `INTERNAL_ERROR` and does not leak the message.
- Log with Pino. Do not use `console`. Do not log passwords, tokens, or raw request bodies.
- New endpoints are added to the OpenAPI generator and the committed `apps/api/openapi/openapi.yaml`. CI fails if they differ.

## Web rules

- Semantic landmarks, a skip link, visible focus, and text contrast of at least 4.5:1.
- Access token stays in memory when auth arrives. Never put it in `localStorage`.
- TanStack Query `staleTime` for catalog reads is 60 seconds.

## Tests and commits

- Vitest. API integration tests use PostgreSQL, not a mock of the database.
- Every acceptance criterion in `docs/design.md` gets an automated test in the milestone that implements it.
- Line coverage stays at or above 80%.
- Commits follow Conventional Commits. Husky runs lint-staged, gitleaks, and commitlint.

## Local checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm run db:migrate
npm run db:drift
npm run test:coverage
npm run build
node scripts/audit-deps.mjs
```
