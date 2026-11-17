# Changelog

## 0.1.0 - 2026-11-17

### Added

- npm workspaces for `apps/api`, `apps/web`, and `packages/shared`.
- Editor, lint, format, commit, and secret-scan tooling.
- PostgreSQL schema and initial migration for all 12 tables, including search and order-number support.
- Idempotent seed for an admin user and sample catalog rows.
- API skeleton with health, security headers, rate limits, structured logs, and OpenAPI.
- Web skeleton with all 14 screens, an accessible layout, and the `/v1` rewrite.
- Docker Compose and GitHub Actions CI.
