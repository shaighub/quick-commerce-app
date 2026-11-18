# Milestone 1: Foundation

**Status:** Done.

Approved at Checkpoint 3 on 2026-11-18 and squash-merged the same day.

|              |                                                                   |
| ------------ | ----------------------------------------------------------------- |
| Pull request | https://github.com/shaighub/quick-commerce-app/pull/1             |
| Merge        | Squash-merge into `main` on 2026-11-18, merge commit `9b32b6c`    |
| Branch       | `feature/m1-foundation`                                           |
| Agent        | https://cursor.com/agents/bc-36efca80-56fd-539d-a86a-5494b4a2464e |

The pull request states that Milestone 1 follows [docs/design.md](../design.md) and adds no auth, catalog, cart, or order business behavior.

Facts below are taken from the [PR #1](https://github.com/shaighub/quick-commerce-app/pull/1) description and the activity log. They were not re-measured for this page.

## What was built

- npm workspaces: `apps/api`, `apps/web`, `packages/shared`, with Node 20 pinned and a lockfile.
- ESLint (strict TypeScript), Prettier, EditorConfig, Husky, lint-staged, commitlint, and gitleaks.
- Cursor rules and `AGENTS.md` for layering, paise, the error format, and 80% line coverage.
- Prisma schema and one migration for all 12 tables, enums, checks, partial indexes, `pg_trgm`, generated `search_vector`, and the IST order-number counter.
- Idempotent seed for one admin (password from the environment, bcrypt cost 12) and sample categories, subcategories, and products.
- Express `/v1` app: health (real database check), helmet, deny-all CORS, rate limits, Pino request logs, the design error envelope, validated config, graceful shutdown, and OpenAPI at `/v1/docs`.
- React shell with all 14 screens, skip link and landmarks, API client, Tailwind, and the Vercel `/v1` rewrite.
- Docker Compose (Postgres, API, web) and an API Dockerfile.
- GitHub Actions: lint, format, type-check, migrate, drift, tests with coverage, build, audit, and gitleaks.

## Verification

### Local (PostgreSQL 16)

Recorded in the pull request description:

| Check                                               | Result                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Lint                                                | Pass                                                                                                   |
| Format check                                        | Pass                                                                                                   |
| Type-check                                          | Pass                                                                                                   |
| Tests                                               | 6 shared, 27 API, 6 web, all passing                                                                   |
| Coverage                                            | Shared 100% lines. API 95.85% lines / 86.59% branches. Web 100% lines / 75% branches (branch gate 70). |
| `prisma migrate deploy` on a fresh database         | Pass                                                                                                   |
| `prisma migrate diff` against the migration history | No difference                                                                                          |
| Production build                                    | Pass                                                                                                   |
| `npm audit` of production dependencies              | 0 vulnerabilities                                                                                      |
| gitleaks                                            | No leaks                                                                                               |

### CI

Recorded in the activity log:

| When                 | Result                                                                | Run                                                                     |
| -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2026-11-18 00:13 IST | Lint failed with 186 type-resolution errors. Local checks had passed. | https://github.com/shaighub/quick-commerce-app/actions/runs/44150635278 |
| 2026-11-18 00:18 IST | Green after types were generated before lint.                         | https://github.com/shaighub/quick-commerce-app/actions/runs/44151280918 |

Checkpoint 3 was presented after the green run and approved at 08:18 IST.

## Deviations

Recorded in the pull request description:

- Prisma ORM 7.10.1 with the `pg` driver adapter, instead of Prisma 6. Prisma 6's CLI depends on a high-severity `deepmerge-ts`. The layered design and `Prisma.TransactionClient` stay. Documented in [ADR-002](../adr/002-express-prisma-postgres.md).
- `products.search_vector` is optional in the Prisma client so inserts omit it. The column is `GENERATED ALWAYS` and `NOT NULL` in SQL.
- The drift check compares the migrated database to the migration history (raw SQL included). A schema-only diff would want to drop partial indexes, expression indexes, checks, and the generated column, which Prisma cannot model.
- The web branch coverage gate is 70%. Line coverage is 100%, above the 80% line standard. Placeholder `??` fallbacks are the remaining branches.
- `GHSA-fc5q-39xc-vjpf` (picomatch ReDoS through 4.0.7) has no patched release. It is dev-tooling only. `scripts/audit-deps.mjs` fails every other high or critical advisory and requires a clean production audit. See `CONTRIBUTING.md`.
- Sentry is parsed from `SENTRY_DSN` and not wired yet. Auth, catalog, cart, checkout, and the sweep job are later milestones.
- `apps/web/vercel.json` targets `https://quick-commerce-api.onrender.com` until the Render hostname exists.

## Left for later milestones

Auth and sessions, catalog and search endpoints, cart, checkout and payments, admin CRUD, order status, the pending-payment sweeper, Playwright flows, and hosting.

See [Milestone 2](m2-auth.md), [Milestone 3](m3-catalog.md), [Milestone 4](m4-cart-orders.md), and [Milestone 5](m5-hardening.md). Hosting is also tracked at [Checkpoint 5](../05-deployment/README.md).
