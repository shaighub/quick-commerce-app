# Architecture decision records

Decisions from the approved design. The review references point at section 6 of `docs/design.md`.

| ADR                                               | Decision                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| [ADR-001](001-monorepo.md)                        | npm workspaces monorepo                                          |
| [ADR-002](002-express-prisma-postgres.md)         | Express, Prisma, PostgreSQL 16                                   |
| [ADR-003](003-jwt-refresh-cookie.md)              | JWT access token and rotating refresh cookie                     |
| [ADR-004](004-same-origin-rewrite.md)             | Same-origin API through a Vercel rewrite                         |
| [ADR-005](005-money-as-paise.md)                  | Money as integer paise                                           |
| [ADR-006](006-order-number-counter.md)            | Order numbers from a per-day counter                             |
| [ADR-007](007-postgres-search.md)                 | PostgreSQL full-text search and pg_trgm                          |
| [ADR-008](008-payment-gateway.md)                 | PaymentGateway port and two-transaction checkout                 |
| [ADR-009](009-soft-delete.md)                     | Soft delete with RESTRICT foreign keys                           |
| [ADR-010](010-no-cart-reservation.md)             | No cart stock reservation in the MVP                             |
| [ADR-011](011-hosting.md)                         | Vercel and Render in Singapore on free tiers for dev and preview |
| [ADR-012](012-zod-contract.md)                    | Zod in packages/shared is the contract source                    |
| [ADR-013](013-token-version-on-every-request.md)  | Check token_version on every authenticated request               |
| [ADR-014](014-catalog-slugs-and-rupee-filters.md) | Catalog slugs stay put; shopper price filters use rupees         |
