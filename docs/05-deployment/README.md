# Deployment

**Status:** Not started. Checkpoint 5 has no approval in the activity log.

Milestone 1 recorded that deploy is not part of that milestone. [ADR-011](../adr/011-hosting.md) says the same.

## Planned hosting

From the [deployment view](../design.md#deployment-view) and [ADR-011](../adr/011-hosting.md), approved with the design on 2026-11-17:

| Piece                            | Plan                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| API                              | Render web service in Singapore. Docker, Node 20, free tier, one instance.                                                                 |
| Database                         | Render PostgreSQL 16 in Singapore. Free tier (1 GB). Same region as the API.                                                               |
| Web                              | Vercel Hobby. Static hosting and the `/v1` rewrite to the API.                                                                             |
| Edge                             | Vercel global edge for the static app.                                                                                                     |
| CI/CD                            | GitHub Actions. On merge to `main`: checks, Vercel deploy, Render deploy hook.                                                             |
| Migrations                       | `prisma migrate deploy` as the pre-deploy command, before traffic switches ([NFR-OPS-03](../design.md#4-requirement-traceability-matrix)). |
| Data on free tiers               | Seed and test data only. Recreate the database from migrations and the seed if it expires.                                                 |
| Environments named in the design | Local (Docker Compose), CI (GitHub Actions and a PostgreSQL service), Preview (Vercel per pull request against a staging API), Production. |

`apps/web/vercel.json` targets `https://quick-commerce-api.onrender.com` until the Render hostname exists (recorded deviation on [Milestone 1](../03-implementation/m1-foundation.md)).

## Paid versus free hosting

Checkpoint 2 kept the free tier until Checkpoint 5. The paid decision is still open.

Accepted risks, quoted from the design, status "Accepted risk (Checkpoint 5)":

| ID                                              | Risk                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [R07](../design.md#scalability-and-performance) | Render free web services spin down after 15 minutes idle and take about a minute to wake. The first shopper waits far beyond the 500 ms p95 target.                |
| [R16](../design.md#reliability-and-operations)  | Free Render PostgreSQL expires 30 days after creation (then deleted after a 14-day grace period), is capped at 1 GB, and has no backups or point-in-time recovery. |
| [R26](../design.md#cost)                        | The zero-cost plan relies on free tiers that are not fit for production, and Vercel Hobby is for non-commercial use only.                                          |

The design's recommendation, not yet decided: a paid Render instance and paid PostgreSQL, and Vercel Pro if the use is commercial, before any pilot.

## Environment variables and secrets

Names only. The design says these secrets live in platform env settings only:

- `JWT_SECRET`
- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SENTRY_DSN`
- `JOBS_TOKEN`

Other names present in `.env.example`, `apps/api/.env.example`, or `apps/web/.env.example`:

- `NODE_ENV`
- `PORT`
- `LOG_LEVEL`
- `APP_VERSION`
- `SHADOW_DATABASE_URL`
- `TEST_DATABASE_URL`
- `DELIVERY_FEE_PAISE`
- `SERVICEABLE_PINCODES`
- `IMAGE_HOSTS`
- `DOCS_ENABLED`
- `RATE_LIMIT_PUBLIC_MAX`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_WINDOW_MS`
- `SHUTDOWN_TIMEOUT_MS`
- `VITE_API_BASE_URL`
- `VITE_API_PROXY_TARGET`

`.env` is gitignored. `.env.example` holds placeholders.

## Rollback

Placeholder. The deployment standard requires a tested rollback plan before a production deploy. No rollback procedure is recorded, and Checkpoint 5 is not approved.

The design's deploy behavior that a later plan has to cover is [NFR-OPS-03](../03-implementation/m5-hardening.md): migrations run before traffic switches, the process drains in-flight requests for up to 10 seconds on SIGTERM, and the API and database share the Singapore region.

## Checkpoint 5

Pending. It includes the paid versus free hosting decision and the accepted risks R07, R16, and R26.
