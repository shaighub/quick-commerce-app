# Design

**Status:** Approved at Checkpoint 2 on 2026-11-17, with the recommended review fixes folded into the design.

The detailed design stays at [docs/design.md](../design.md). This page is the map. Architecture decision records stay in [docs/adr](../adr/README.md).

## Architecture

C4 model in [section 5](../design.md#5-c4-architecture):

| Level            | What it shows                                                                                                                               | Link                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1 System context | Guest browses, customer shops, admin manages one store. Future payment gateway and email/SMS. Image CDN. GitHub Actions. Vercel and Render. | [System context](../design.md#level-1-system-context)     |
| 2 Containers     | React SPA, Vercel `/v1` rewrite, Express API, in-process PaymentGateway adapter, PostgreSQL 16.                                             | [Containers](../design.md#level-2-containers)             |
| 3 API            | Middleware, routers, auth and RBAC, Zod validation, services, Prisma repositories, error handler, OpenAPI.                                  | [API components](../design.md#level-3-api-components)     |
| 3 Web            | Pages S01–S09 and A01–A05, route guards, auth context, TanStack Query, API client, Tailwind UI kit, shared Zod forms.                       | [Web components](../design.md#level-3-web-spa-components) |
| 4 Code           | Checkout sequence, login and refresh-token rotation, and the PaymentGateway, order-number, order, and token contracts.                      | [Key flows](../design.md#level-4-code-for-key-flows)      |

The browser calls `/v1` on the web origin. The edge rewrite proxies that path to the API ([ADR-004](../adr/004-same-origin-rewrite.md)). CORS is deny-all.

Deployment shape: [deployment view](../design.md#deployment-view).

## Stack

From the container diagram and [ADR-001](../adr/001-monorepo.md) and [ADR-002](../adr/002-express-prisma-postgres.md):

| Part       | Choice                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Repository | npm workspaces: `apps/api`, `apps/web`, `packages/shared`                                                     |
| API        | Node 20, Express, TypeScript, Prisma, Zod. Docker on Render.                                                  |
| Web        | React 18, Vite, React Router, TanStack Query, Tailwind. Static build on Vercel.                               |
| Database   | PostgreSQL 16 with `pgcrypto` and `pg_trgm`                                                                   |
| Contracts  | Zod schemas in `packages/shared` generate OpenAPI and drive web forms ([ADR-012](../adr/012-zod-contract.md)) |
| Money      | Integer paise ([ADR-005](../adr/005-money-as-paise.md))                                                       |

## Data model

PostgreSQL 16 and Prisma. Twelve tables. Details, columns, and indexes: [section 1](../design.md#1-database-design-postgresql-16--prisma).

| Table                   | Role                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `users`                 | Admin and customer accounts. Guests are not stored.              |
| `refresh_tokens`        | Hashed refresh tokens for rotation, logout, and reuse detection. |
| `categories`            | Top-level catalog groups.                                        |
| `subcategories`         | Second-level groups inside a category.                           |
| `products`              | Sellable items. Price in paise. One stock count for the store.   |
| `carts`                 | One cart per customer, created on the first add.                 |
| `cart_items`            | Cart lines. Prices are read live from products until checkout.   |
| `orders`                | Placed orders, totals, and a snapshot of the delivery address.   |
| `order_items`           | Order lines with name, unit, and price frozen at purchase.       |
| `payments`              | Payment attempts through the PaymentGateway interface.           |
| `order_status_history`  | Audit trail of every order status change.                        |
| `order_number_counters` | One row per IST calendar day. Issues `orders.order_number`.      |

| Enum          | Values                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Role          | `ADMIN`, `CUSTOMER`. A request with no valid access token is a guest.                                    |
| OrderStatus   | `PENDING_PAYMENT`, `PAYMENT_FAILED`, `CONFIRMED`, `PACKED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED` |
| PaymentStatus | `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`                                                             |

Further sections:

- [Entity-relationship diagram](../design.md#entity-relationship-diagram)
- [Product search indexing](../design.md#product-search-indexing) ([ADR-007](../adr/007-postgres-search.md))
- [Order number generation](../design.md#order-number-generation-qc-yyyymmdd-nnnnnn) (`QC-YYYYMMDD-NNNNNN`, [ADR-006](../adr/006-order-number-counter.md))
- [Checkout transaction](../design.md#checkout-transaction-stock-decrement--price-snapshot) ([ADR-008](../adr/008-payment-gateway.md))
- [Order status transitions](../design.md#order-status-transitions)
- [Delete and restrict rules](../design.md#delete-and-restrict-rules) ([ADR-009](../adr/009-soft-delete.md))
- [Refresh token storage and revocation](../design.md#refresh-token-storage-and-revocation) ([ADR-003](../adr/003-jwt-refresh-cookie.md))
- [Data conventions](../design.md#data-conventions)

## Screens

Fourteen screens in [section 3](../design.md#3-screens). Storefront S01–S09. Admin A01–A05.

| ID  | Screen                              | Route                                                |
| --- | ----------------------------------- | ---------------------------------------------------- |
| S01 | Home and product list               | `/` and `/search`                                    |
| S02 | Product detail                      | `/p/:slug`                                           |
| S03 | Sign up                             | `/signup`                                            |
| S04 | Log in                              | `/login`                                             |
| S05 | Cart                                | `/cart`                                              |
| S06 | Checkout with mock payment          | `/checkout`                                          |
| S07 | Order confirmation                  | `/orders/:orderNumber/confirmation`                  |
| S08 | My orders                           | `/orders`                                            |
| S09 | Order detail                        | `/orders/:orderNumber`                               |
| A01 | Admin dashboard                     | `/admin`                                             |
| A02 | Admin categories and subcategories  | `/admin/categories`                                  |
| A03 | Admin products list                 | `/admin/products`                                    |
| A04 | Admin product create / edit form    | `/admin/products/new` and `/admin/products/:id/edit` |
| A05 | Admin orders list and status update | `/admin/orders`                                      |

## API

Versioned REST under `/v1`. The endpoint table, roles, and requirement IDs are in [section 2](../design.md#2-api-endpoints-v1).

Modules: AUTH, CAT, PROD, CART, ORD, ADM, SYS.

Errors use `{ "error": { "code", "message", "details", "requestId" } }`. Lists take `page` and `pageSize` (default 24, max 50). Admin routes live under `/v1/admin`.

## Test strategy

[Section 4](../design.md#4-requirement-traceability-matrix) is the traceability matrix. Test types named there: unit (Vitest), API integration (Vitest + Supertest, test PostgreSQL), component (Testing Library), end-to-end (Playwright), plus CI, performance, and Lighthouse checks.

[NFR-QUAL-01](../design.md#4-requirement-traceability-matrix) sets 80% line coverage and green CI. [NFR-QUAL-02](../design.md#4-requirement-traceability-matrix) keeps OpenAPI, Zod, and migrations from drifting. The phase page is [Testing](../04-testing/README.md).

## Hosting

Free tier for now. The paid tier is deferred to Checkpoint 5 ([ADR-011](../adr/011-hosting.md), [deployment view](../design.md#deployment-view)).

| Piece    | Plan recorded in the design                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| API      | Render free web service, Docker, Node 20, one instance, Singapore                                                         |
| Database | Render PostgreSQL 16, free tier (1 GB), Singapore                                                                         |
| Web      | Vercel Hobby, static hosting and rewrites                                                                                 |
| Data     | Seed and test data only. Recreate the database from migrations and seed if it expires.                                    |
| Release  | Merge to `main`, then checks, Vercel deploy, and a Render deploy hook. `prisma migrate deploy` is the pre-deploy command. |

Accepted risks until Checkpoint 5, from [section 6](../design.md#6-key-review-comments):

| ID                                              | Risk                                                                                    | Status in the design         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------- |
| [R07](../design.md#scalability-and-performance) | Free web services spin down after 15 minutes idle and take about a minute to wake.      | Accepted risk (Checkpoint 5) |
| [R16](../design.md#reliability-and-operations)  | Free PostgreSQL expires 30 days after creation, is capped at 1 GB, and has no backups.  | Accepted risk (Checkpoint 5) |
| [R26](../design.md#cost)                        | Free tiers are not fit for production, and Vercel Hobby is for non-commercial use only. | Accepted risk (Checkpoint 5) |

The deployment checkpoint page is [docs/05-deployment](../05-deployment/README.md).

## Review fixes included at approval

Section 6 records 31 findings: 3 High, 15 Medium, 13 Low. Six were already addressed in the original design, 19 were folded in at approval, 3 are the accepted risks above, and 3 are deferred.

Folded into the design at approval on 2026-11-17: same-origin API via a Vercel rewrite (R01, NFR-SEC-06); pending-payment sweeper and `POST /v1/internal/jobs/sweep` (R12, FR-ORD-12); `token_version` revocation and per-account login lockout (R02, R04, FR-AUTH-07, FR-AUTH-08); `409 PRICE_CHANGED` at checkout (R14, FR-ORD-10); served-pincode check (R28, FR-ORD-11); every other MVP fix.

## Decision records

| ADR                                              | Decision                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| [ADR-001](../adr/001-monorepo.md)                | npm workspaces monorepo                                          |
| [ADR-002](../adr/002-express-prisma-postgres.md) | Express, Prisma, PostgreSQL 16                                   |
| [ADR-003](../adr/003-jwt-refresh-cookie.md)      | JWT access token and rotating refresh cookie                     |
| [ADR-004](../adr/004-same-origin-rewrite.md)     | Same-origin API through a Vercel rewrite                         |
| [ADR-005](../adr/005-money-as-paise.md)          | Money as integer paise                                           |
| [ADR-006](../adr/006-order-number-counter.md)    | Order numbers from a per-day counter                             |
| [ADR-007](../adr/007-postgres-search.md)         | PostgreSQL full-text search and `pg_trgm`                        |
| [ADR-008](../adr/008-payment-gateway.md)         | PaymentGateway port and two-transaction checkout                 |
| [ADR-009](../adr/009-soft-delete.md)             | Soft delete with RESTRICT foreign keys                           |
| [ADR-010](../adr/010-no-cart-reservation.md)     | No cart stock reservation in the MVP                             |
| [ADR-011](../adr/011-hosting.md)                 | Vercel and Render in Singapore on free tiers for dev and preview |
| [ADR-012](../adr/012-zod-contract.md)            | Zod in `packages/shared` is the contract source                  |
