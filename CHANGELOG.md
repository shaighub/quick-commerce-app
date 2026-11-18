# Changelog

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
