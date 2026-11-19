# Changelog

## 0.5.0 - 2026-11-19

### Added

- Playwright coverage for browse, auth, cart, checkout, orders, admin catalog, and admin orders, including axe and a keyboard pass. The suite runs in CI.
- Lighthouse on the home and product pages, a JavaScript bundle budget, and a catalog load test.
- Error reports when `SENTRY_DSN` or `VITE_SENTRY_DSN` is set. An empty value does nothing.
- A draft deployment runbook for Render and Vercel in Singapore. Nothing was deployed.

## 0.4.0 - 2026-11-18

### Added

- Customer cart: get, add, update quantity, remove, and clear, with stock checks and unavailable lines.
- Checkout with an idempotency key, server totals in paise, `PRICE_CHANGED`, and `NOT_SERVICEABLE`.
- Mock payment, order numbers `QC-YYYYMMDD-NNNNNN`, customer and admin order screens, and the pending-payment sweeper.

## 0.3.0 - 2026-11-18

### Added

- Public catalog reads: categories, paginated product search and filters, and product detail, with a 60-second cache and ETag.
- Admin category, subcategory, and product create, update, and soft delete, including image-host checks.
- `GET /v1/serviceability` and the shared pincode check used later at checkout.
- Storefront browse, search, and product pages, plus admin catalog screens.

## 0.2.0 - 2026-11-18

### Added

- Customer sign-up and login with bcrypt cost 12, a 15-minute JWT access token, and a hashed rotating refresh cookie.
- Refresh reuse detection, logout, logout-all via `token_version`, and a 15-minute login lockout.
- `requireAuth` and `requireRole` middleware, `GET /v1/auth/me`, and the auth paths in the OpenAPI document.
- Sign-up and log-in screens, an in-memory auth session, silent refresh, and customer and admin route guards.

## 0.1.0 - 2026-11-17

### Added

- npm workspaces for `apps/api`, `apps/web`, and `packages/shared`.
- Editor, lint, format, commit, and secret-scan tooling.
- PostgreSQL schema and initial migration for all 12 tables, including search and order-number support.
- Idempotent seed for an admin user and sample catalog rows.
- API skeleton with health, security headers, rate limits, structured logs, and OpenAPI.
- Web skeleton with all 14 screens, an accessible layout, and the `/v1` rewrite.
- Docker Compose and GitHub Actions CI.
