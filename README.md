# Quick Commerce

A single-store quick-commerce app: customers browse and order, an admin manages the catalog and order status, and guests can only browse. Milestone 1 is the foundation. Milestone 2 adds customer sign-up, login, refresh-token rotation, and route guards. Milestone 3 adds catalog browse, search, admin catalog management, and the pincode check. Cart and checkout are later milestones. The approved design is [`docs/design.md`](docs/design.md).

## Architecture

```mermaid
flowchart LR
  browser[Browser]
  web[Web SPA]
  api[REST API]
  db[(PostgreSQL 16)]
  browser --> web
  web -->|"same-origin /v1"| api
  api --> db
```

| Package           | Role                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `apps/web`        | React 18, Vite, React Router, TanStack Query, Tailwind. Static build for Vercel. |
| `apps/api`        | Node 20, Express, Prisma, Zod, Pino. Container for Render.                       |
| `packages/shared` | Zod contracts shared by the API, the web client, and OpenAPI.                    |

The browser never calls the API host directly. Locally, Vite proxies `/v1`. On Vercel, `apps/web/vercel.json` rewrites `/v1` to the Render service (ADR-004). CORS is deny-all.

Money is stored and returned as integer paise. The UI formats rupees with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

## Prerequisites

- Node.js 20.19 or newer (`nvm use` reads `.nvmrc`)
- npm 10
- PostgreSQL 16, or Docker with Compose
- [gitleaks](https://github.com/gitleaks/gitleaks) for the pre-commit hook

## Setup

```bash
npm ci
cp .env.example .env
# Set ADMIN_PASSWORD to 8+ characters with a letter and a number.
createdb quick_commerce            # or: node scripts/create-databases.mjs
createdb quick_commerce_test
createdb quick_commerce_shadow
npm run db:generate
npm run db:migrate
npm run db:seed
```

`node scripts/create-databases.mjs` creates the shadow and test databases when `quick_commerce` already exists.

The seed refuses an empty or weak `ADMIN_PASSWORD`. It upserts one admin (`ADMIN_EMAIL`) and sample categories, subcategories, and products. Running it again does not duplicate them. Sign-up cannot create an admin; `POST /v1/auth/signup` always stores `CUSTOMER`.

## Auth

Passwords are hashed with bcrypt cost 12. Login returns a 15-minute JWT access token in the JSON body. The web app keeps that token in memory only. A 7-day refresh token is stored as a SHA-256 hash and sent to the browser as cookie `qc_rt` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/v1/auth`).

`POST /v1/auth/refresh` and `POST /v1/auth/logout` require the `X-Requested-With` header. Refresh rotates the cookie. Presenting a rotated token again revokes that token's whole family. `POST /v1/auth/logout-all` increments `users.token_version`, revokes every refresh token, and clears the cookie. Authenticated requests compare the JWT `ver` claim with `token_version` (cached for 30 seconds, and dropped in the process that bumped it).

Five failed logins lock the account for 15 minutes (`423 ACCOUNT_LOCKED`). Unknown emails get the same responses from an in-memory counter, so a failure does not reveal whether the address exists. Auth routes allow 10 requests per minute per IP.

The browser calls `/v1` on the web origin, including the silent refresh on load. Vite proxies that path locally. See ADR-003, ADR-004, and ADR-013.

## Catalog

Guests and customers can browse `GET /v1/categories` and `GET /v1/products`, open a product at `/p/:slug`, and search by name or description. Search uses PostgreSQL full-text ranking and falls back to `pg_trgm` when full-text finds nothing (ADR-007). Public catalog responses send `Cache-Control: public, max-age=60, stale-while-revalidate=300` and an ETag. An admin write clears the API's in-process cache.

Admins manage categories, subcategories, and products under `/v1/admin`. Deletes set `deleted_at`. A category that still has a subcategory returns `409 CATEGORY_NOT_EMPTY`. A subcategory that still has a product returns `409 SUBCATEGORY_NOT_EMPTY`. Image URLs must be `https` on a host in `IMAGE_HOSTS`.

`GET /v1/serviceability?pincode=` returns whether that pincode is in `SERVICEABLE_PINCODES`, plus `deliveryFeePaise`. An invalid pincode is `422`. Checkout's `422 NOT_SERVICEABLE` arrives with orders. The shared check is `refusalForUnserviceablePincode` in `@qc/shared`.

Category and subcategory slugs are fixed at create (ADR-014). The storefront price filters `min` and `max` are rupees; the API query stays in paise. A guest's Add to cart link goes to `/login?next=`. The cart itself is the next milestone.

## Run

```bash
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:4000/v1/health
- API docs: http://localhost:4000/v1/docs

Or with Docker:

```bash
docker compose up --build
```

Compose starts Postgres, migrates, and serves the API and the Vite dev server. Seed from the host with `DATABASE_URL` pointing at `localhost:5432` and `npm run db:seed`. The Compose admin password is not set; seeding stays an explicit step.

## Test

```bash
npm run lint
npm run format:check
npm run typecheck
npm run db:drift
npm run test:coverage
npm run build
```

API integration tests apply migrations to `quick_commerce_test`. Override the URL with `TEST_DATABASE_URL`.

Playwright is configured in `apps/web` and is not run in CI yet. Specs arrive with the flows they cover.

## Environment

Copy `.env.example`. The API also reads `apps/api/.env`, which overrides the root file. Process environment wins over both.

| Variable                         | Purpose                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | PostgreSQL connection. Include `connection_limit=5` for the app pool.                         |
| `SHADOW_DATABASE_URL`            | Empty database used by the migration drift check.                                             |
| `TEST_DATABASE_URL`              | Database used by Vitest.                                                                      |
| `JWT_SECRET`                     | At least 32 characters. Signs access tokens (HS256). Generate a unique value per environment. |
| `JWT_ACCESS_TTL_SECONDS`         | Access token lifetime. Default `900` (15 minutes).                                            |
| `JWT_REFRESH_TTL_SECONDS`        | Refresh token lifetime. Default `604800` (7 days).                                            |
| `JOBS_TOKEN`                     | At least 16 characters. Protects the future sweep endpoint.                                   |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed only. Password must be 8+ characters with a letter and a number.                         |
| `DELIVERY_FEE_PAISE`             | Flat delivery fee in paise.                                                                   |
| `SERVICEABLE_PINCODES`           | Comma-separated 6-digit pincodes.                                                             |
| `IMAGE_HOSTS`                    | Hostnames allowed in image URLs and in `img-src`.                                             |
| `VITE_IMAGE_HOSTS`               | Optional. Same host list for the storefront image check. Defaults to `images.example.com`.    |
| `DOCS_ENABLED`                   | `true` or `false`. Defaults on outside production.                                            |
| `SENTRY_DSN`                     | Optional. Parsed now, wired to error tracking later.                                          |
| `VITE_API_BASE_URL`              | Browser base path. Keep `/v1`.                                                                |
| `VITE_API_PROXY_TARGET`          | Where Vite proxies `/v1` during local dev.                                                    |

`apps/web/vercel.json` points `/v1` at `https://quick-commerce-api.onrender.com`. Change that host when the Render service exists. Do not put production secrets in the repo.

## Deploy

Not part of this milestone. The intended path, after a deployment checkpoint:

- API and PostgreSQL 16 on Render in Singapore. `prisma migrate deploy` runs before traffic switches.
- Web on Vercel. The `/v1` rewrite keeps the refresh cookie same-origin.
- Free tiers are for dev and preview only (ADR-011).

## Troubleshooting

- **API exits on startup.** The message lists the invalid variable. `JWT_SECRET` must be at least 32 characters and `JOBS_TOKEN` at least 16.
- **Login says the email or password is incorrect.** That message is the same for an unknown email, a wrong password, and a deactivated account.
- **Login returns 423.** The account is locked for 15 minutes after five failures. The `Retry-After` header and `error.details[0].retryAfter` are seconds.
- **The session disappears on reload in local HTTP.** The refresh cookie is `Secure`. Browsers still store it on `http://localhost`. A non-localhost HTTP origin will not.
- **Seed says the password is weak.** Use 8+ characters with a letter and a number. `password1` and `change-me` are rejected.
- **`prisma generate` cannot find the client.** Run `npm run db:generate`. The client is generated into `apps/api/src/generated` and is not committed.
- **Drift check fails.** Apply migrations to `DATABASE_URL` first. `SHADOW_DATABASE_URL` must be a database the Prisma user can reset.
- **Health returns 503.** Postgres is down or `DATABASE_URL` points at the wrong database. `GET /v1/health` reports `db: down`.
- **Pre-commit fails on gitleaks.** Install the gitleaks binary and retry. The hook does not skip the scan.
- **Port 5432 is taken.** Stop the other Postgres or change the Compose port and `DATABASE_URL` together.

## Documentation

Phase and milestone documents, standards, and the approval log are indexed in [docs/README.md](docs/README.md).

## Further reading

- [Design](docs/design.md)
- [ADRs](docs/adr/README.md)
- [Contributing](CONTRIBUTING.md)
