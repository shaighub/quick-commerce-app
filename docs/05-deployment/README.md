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
- `VITE_SENTRY_DSN`
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

## Draft runbook

This is a draft for Checkpoint 5. Do not run it until that checkpoint is approved. Nothing in Milestone 5 was deployed.

### 1. Database

Create a Render PostgreSQL 16 instance in the Singapore region. Free tier, 1 GB, seed data only. Copy the external connection string into `DATABASE_URL` and append `connection_limit=5&pool_timeout=10`.

### 2. API

Create a Render web service in Singapore from this repo's `apps/api/Dockerfile`. One free instance.

| Setting            | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| Region             | Singapore                                                            |
| Health check path  | `/v1/health`                                                         |
| Pre-deploy command | `npx prisma migrate deploy` from `apps/api`, before traffic switches |
| Start command      | `node dist/server.js` (the image default)                            |

Set `NODE_ENV=production`, `JWT_SECRET`, `JOBS_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DELIVERY_FEE_PAISE`, `SERVICEABLE_PINCODES`, `IMAGE_HOSTS`, and `DOCS_ENABLED=false`. Leave `SENTRY_DSN` empty until an error project exists. After the first successful deploy, run `npm run db:seed` once from a machine that can reach the database, with the same admin env vars.

### 3. Web

Import the repo into Vercel Hobby. Framework preset Vite, root `apps/web`, output `dist`. Set `VITE_API_BASE_URL=/v1`. Leave `VITE_SENTRY_DSN` empty.

Replace the host in `apps/web/vercel.json` with the Render hostname, then redeploy so `/v1/:path*` rewrites to `https://<render-host>/v1/:path*`. The browser must not call Render directly.

### 4. Sweeper

In GitHub Actions secrets set `SWEEP_URL` to `https://<render-host>/v1/internal/jobs/sweep` and `JOBS_TOKEN` to the same value as the API. `.github/workflows/sweep.yml` POSTs every 10 minutes. Without those secrets the workflow exits as a dry run. The API also sweeps on startup.

### 5. Smoke tests

1. `GET /v1/health` returns `status: ok` and `db: up`.
2. Open the Vercel URL, search for Amul Butter, and confirm the product page loads.
3. Sign up, add the item, and check out to pincode `560001` with simulate success. The confirmation shows `QC-YYYYMMDD-NNNNNN`.
4. Reload the page. The account name is still shown, which means `qc_rt` survived the `/v1` rewrite.
5. Sign in as the seeded admin and open `/admin`. A customer account sees "Not allowed".

### Rollback

1. If `prisma migrate deploy` fails, Render does not switch traffic. Fix the migration and redeploy. Do not start the new image against an unmigrated database.
2. If the new image is unhealthy, roll the Render service back to the previous deploy in the dashboard. The process handles SIGTERM and stops accepting work for up to `SHUTDOWN_TIMEOUT_MS` (10 seconds) before closing the pool.
3. Roll the Vercel project back to the previous deployment so the rewrite still points at a healthy API.
4. Free Render Postgres has no backups and no point-in-time recovery. A bad migration on that tier is recovered by recreating the database, running `prisma migrate deploy`, and seeding again. Do not use the free tier for data you cannot recreate.
5. This rollback has not been executed. Checkpoint 5 has to approve it before a production deploy.

## Checkpoint 5

Pending. It includes the paid versus free hosting decision and the accepted risks R07, R16, and R26.
