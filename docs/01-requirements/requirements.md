# Requirements

**Status:** Approved at Checkpoint 1 on 2026-11-17.

Checkpoint 1 approved the original request, the clarified decisions, and the standards. The numbered requirements and acceptance criteria below are copied from the design approved at Checkpoint 2, with the same IDs, so traceability stays intact. Screens, endpoints, tables, and planned tests for each ID are in the [requirement traceability matrix](../design.md#4-requirement-traceability-matrix).

## Original business requirement

The project started on 2026-11-17 as a quick commerce application on Node.js. The activity log's correction entry says the first three stamps of 15:18 IST were a mislabelled UTC clock, and the actual start was about 20:48 IST. This page uses the corrected time.

Roles: admin, customer, and guest.

Requested behavior:

- Authentication with sign up, log in, log out, and JWT.
- Product listing and search.
- Category and subcategory add, remove, and update by an admin.
- Cart add, remove, and update.
- Order submission that produces an order number.

## Clarified decisions

Saved on 2026-11-17 and approved at Checkpoint 1. The full standards list, including where each rule is enforced, is in [standards.md](standards.md).

- Scope: Node.js (TypeScript) REST API and a React web frontend (customer storefront and admin panel).
- Database: PostgreSQL.
- Roles: admin, customer, and guest. Guests browse and search only. Cart and orders require sign-up or login.
- Payment: a mock payment step behind a gateway interface, swappable for a real gateway later.
- Repository: public [github.com/shaighub/quick-commerce-app](https://github.com/shaighub/quick-commerce-app). This overrides the workspace default that repositories are private.
- All org-wide standards apply.

## Scope

In scope for the approved baseline:

- One store: a customer storefront, an admin panel, and a versioned REST API. The design's system context describes "one store".
- The roles and the features in the original request, as clarified above.
- The functional requirements `FR-*` and non-functional requirements `NFR-*` copied below.

## Assumptions

These are stated in the Checkpoint 1 decisions or in the approved design.

- A guest is a request with no valid access token. Guest rows are not stored. The `Role` enum is `ADMIN` and `CUSTOMER`.
- The admin account is created by the seed script. Sign-up cannot create or promote an admin (FR-AUTH-06).
- One cart per customer, created on the first add.
- Money is an integer number of paise in the database and the API. The UI formats rupees.
- Timestamps are stored in UTC and shown in Asia/Kolkata. The order-number day is the IST date.
- The public order number format is `QC-YYYYMMDD-NNNNNN`.
- MVP payment goes through `MockGateway` behind the `PaymentGateway` interface.
- The API and the database share one region, Singapore, for the MVP.
- Product names are mostly brands and Hinglish words, so search uses the PostgreSQL `simple` text-search configuration.

## Out of scope

Stated in the design.

- Email and SMS, including order confirmations and OTP. The system context marks that provider "out of scope for MVP".
- A live payment gateway. The design names one (for example Razorpay) as future work behind the same port.
- Dark stores, multiple stores, delivery slots, and ETAs (review R29, "out of scope by design").
- A guest cart (review R24, an explicit product decision, deferred).
- Admin TOTP (review R04, deferred).
- A saved address book (review R23, deferred). Prefill from the latest order is in scope (FR-ORD-01).
- Stock reservations while checkout is open (review R27, deferred). Locking stock at checkout is in scope (FR-ORD-04, [ADR-010](../adr/010-no-cart-reservation.md)).
- Real-time stock push with SSE or WebSocket (review R30, deferred).
- A minimum order value, delivery-fee rules beyond the flat fee, and customer self-cancel (review R31, deferred).
- Read replicas and multi-region deployment (review R17, deferred).
- Signed image uploads (review R05, later). Allowlisted image hosts are in scope (NFR-SEC-07).
- A separate search engine. PostgreSQL full-text and `pg_trgm` cover the 10,000-product target. Moving past 100,000 SKUs is later work (review R08, [ADR-007](../adr/007-postgres-search.md)).

## Functional requirements

| ID         | Requirement                                                           | Acceptance criterion                                                                                                                                  |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AUTH-01 | Sign up as a customer with name, email and password                   | A new account is created with role CUSTOMER, the user is signed in and returned to the page they came from; a duplicate email shows 'already exists'. |
| FR-AUTH-02 | Log in with email and password                                        | Valid credentials return an access token and set a Secure, HttpOnly, SameSite=Strict refresh cookie; wrong credentials show one generic message.      |
| FR-AUTH-03 | Log out                                                               | After logout, refresh fails with 401 and protected screens send the user to Log in.                                                                   |
| FR-AUTH-04 | JWT access tokens with silent refresh and rotation                    | Access tokens last 15 minutes and refresh tokens 7 days; a reused refresh token revokes the whole family.                                             |
| FR-AUTH-05 | Role-based access for guest, customer and admin                       | Guests get 401 and are sent to Log in; customers get 403 on admin routes; admin navigation is hidden from non-admins.                                 |
| FR-AUTH-06 | Admin account is created by a seed script, not sign-up                | npm run db:seed creates the admin once; no API path can create or promote an admin.                                                                   |
| FR-AUTH-07 | Instant session revocation (token_version) and log out of all devices | After log out of all devices, deactivation or a role change, old tokens stop working on admin routes and checkout within 30 seconds.                  |
| FR-AUTH-08 | Per-account login lockout                                             | Five consecutive failures lock the account for 15 minutes with a clear message, without revealing whether the email exists.                           |
| FR-CAT-01  | Browse categories and subcategories                                   | Active categories with their active subcategories show on Home in sort order.                                                                         |
| FR-CAT-02  | Admin adds a category                                                 | The new category appears in the admin list and, when active, on the storefront.                                                                       |
| FR-CAT-03  | Admin updates a category                                              | Name, image, sort order and active changes are saved and reflected on the storefront.                                                                 |
| FR-CAT-04  | Admin removes a category                                              | A category with subcategories cannot be removed and the reason is shown; an empty one is soft-deleted and disappears.                                 |
| FR-CAT-05  | Admin adds a subcategory under a category                             | The subcategory appears under its category and in storefront filters.                                                                                 |
| FR-CAT-06  | Admin updates or moves a subcategory                                  | Changes are saved; a moved subcategory keeps its products.                                                                                            |
| FR-CAT-07  | Admin removes a subcategory                                           | A subcategory with products cannot be removed; an empty one is soft-deleted.                                                                          |
| FR-PROD-01 | Paginated product listing                                             | Products load 24 per page with working page controls.                                                                                                 |
| FR-PROD-02 | Search products by name or description                                | Results match name or description, best matches first, and small typos still match.                                                                   |
| FR-PROD-03 | Filter by category, subcategory, price range and in-stock             | Filters combine (AND), are kept in the URL, and Clear all resets them.                                                                                |
| FR-PROD-04 | Sort by relevance, price and newest                                   | Each sort option reorders the results correctly.                                                                                                      |
| FR-PROD-05 | Product detail page                                                   | Shows name, image, unit, price in rupees, stock status and breadcrumb; unavailable products show a 404 page.                                          |
| FR-PROD-06 | Admin creates a product                                               | A valid product is saved and appears on the storefront when active.                                                                                   |
| FR-PROD-07 | Admin updates a product, including price and stock                    | Edits are saved; past orders keep the price that was paid.                                                                                            |
| FR-PROD-08 | Admin deletes a product (soft delete)                                 | The product disappears from the storefront but stays in order history.                                                                                |
| FR-PROD-09 | Admin product list with status and low-stock filters                  | Admins can find any product, including inactive, deleted and low-stock ones.                                                                          |
| FR-CART-01 | Guests must sign up or log in to use the cart                         | A guest pressing Add to cart is taken to Log in or Sign up and the item is added once signed in.                                                      |
| FR-CART-02 | Add an item to the cart                                               | The item appears in the cart and the header badge updates.                                                                                            |
| FR-CART-03 | Update an item's quantity                                             | Quantity changes between 1 and 10 and never above stock.                                                                                              |
| FR-CART-04 | Remove an item or clear the cart                                      | Removed items disappear and totals update.                                                                                                            |
| FR-CART-05 | View the cart with totals and availability                            | Subtotal equals current price times quantity; unavailable items are flagged and block checkout.                                                       |
| FR-CART-06 | Stock is checked on add and update                                    | Users cannot put more in the cart than is in stock and see how many are left.                                                                         |
| FR-ORD-01  | Checkout with a delivery address                                      | Checkout accepts a valid Indian address, prefilled from the last order, and stores it on the order.                                                   |
| FR-ORD-02  | Mock payment behind a PaymentGateway interface                        | Simulate success confirms the order; Simulate failure shows a retry and changes nothing else.                                                         |
| FR-ORD-03  | Unique order number QC-YYYYMMDD-NNNNNN                                | Every order gets a unique number in the agreed format, shown on confirmation and in lists.                                                            |
| FR-ORD-04  | Atomic stock decrement and price snapshot                             | Stock is never oversold and orders keep the price paid.                                                                                               |
| FR-ORD-05  | Order confirmation screen                                             | After payment the customer sees the order number, items, total and address.                                                                           |
| FR-ORD-06  | Customer order history and order detail                               | Customers see only their own orders with status history and prices paid.                                                                              |
| FR-ORD-07  | Admin views all orders                                                | Admins can filter and open any order.                                                                                                                 |
| FR-ORD-08  | Admin updates order status                                            | Only allowed transitions succeed, every change is recorded, and cancelling restocks items.                                                            |
| FR-ORD-09  | Checkout is idempotent                                                | A double click or retry never creates a second order, and a reused key cannot place a different order.                                                |
| FR-ORD-10  | Price change confirmation at checkout                                 | A customer is never charged a total they have not seen; a price change shows old and new totals for confirmation.                                     |
| FR-ORD-11  | Delivery only to served pincodes                                      | Home shows whether the chosen pincode is served, and checkout rejects unserved pincodes with a clear message.                                         |
| FR-ORD-12  | Stuck pending-payment orders are swept                                | No order stays in PENDING_PAYMENT for more than about 25 minutes, and its stock returns to sale.                                                      |
| FR-ADM-01  | Admin dashboard summary                                               | Shows today's orders and revenue, pending orders, low-stock products and the 10 latest orders.                                                        |

## Non-functional requirements

| ID          | Requirement                                             | Acceptance criterion                                                                                                           |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| NFR-SEC-01  | Passwords hashed with bcrypt and a password policy      | Only bcrypt hashes are stored and passwords need 8+ characters with a letter and a number.                                     |
| NFR-SEC-02  | Rate limiting on auth and public endpoints              | Auth allows 10 requests per minute per IP; other public endpoints 100.                                                         |
| NFR-SEC-03  | Server-side validation and parameterized queries        | Every request body, query and param is validated, and no SQL is built by string concatenation.                                 |
| NFR-SEC-04  | Security headers, CORS, secure cookies and CSRF defence | Responses carry security headers; the refresh cookie is HttpOnly, Secure and SameSite=Strict, and refresh checks Origin.       |
| NFR-SEC-05  | Secret scanning and dependency audit                    | No committed secrets and no known high or critical vulnerabilities at release.                                                 |
| NFR-SEC-06  | Same-origin API through a Vercel rewrite (ADR-004)      | The browser talks only to the web origin; the refresh cookie works with SameSite=Strict and CORS stays deny-all.               |
| NFR-SEC-07  | Image URLs restricted to allowlisted hosts              | Only https images from configured hosts can be saved or displayed.                                                             |
| NFR-PERF-01 | API p95 under 500 ms for typical requests               | Search and listing stay under 500 ms at p95 with 10,000 products.                                                              |
| NFR-PERF-02 | Core Web Vitals good and Lighthouse 90+                 | LCP under 2.5 s, INP under 200 ms, CLS under 0.1, and Lighthouse performance and accessibility at least 90.                    |
| NFR-PERF-03 | HTTP caching for catalog reads                          | Repeat catalog views within a minute are served from cache or with a 304.                                                      |
| NFR-A11Y-01 | WCAG 2.1 AA on every screen                             | No serious or critical axe violations; contrast at least 4.5:1 for text.                                                       |
| NFR-A11Y-02 | Keyboard and screen-reader support for the core flows   | A customer can complete search to confirmation with the keyboard alone, with visible focus throughout.                         |
| NFR-OPS-01  | Health check, structured logs and OpenAPI docs          | Ops can check health, trace a request by id, and read the API docs.                                                            |
| NFR-OPS-02  | Error tracking, uptime and slow-query monitoring        | API and web errors are tracked with the same request id, /v1/health is monitored, and slow queries are logged.                 |
| NFR-OPS-03  | Safe deploys in the Singapore region                    | Migrations run before traffic switches, deploys do not cut off checkouts, and the API and database share the Singapore region. |
| NFR-QUAL-01 | 80% test coverage and green CI                          | Pull requests cannot merge below 80% coverage or with failing checks.                                                          |
| NFR-QUAL-02 | Single contract source and migration drift check        | API validation, web forms and the OpenAPI spec come from the same schemas, and raw-SQL indexes never drift.                    |

## Traceability

Every ID above is a row in the [requirement traceability matrix](../design.md#4-requirement-traceability-matrix), which also lists the screen, API endpoint, tables, and planned tests.
