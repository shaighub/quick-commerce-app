# Checkpoint 4 test report

Recorded on 2026-11-19 for Milestone 5. Every ID in the [traceability matrix](../design.md#4-requirement-traceability-matrix) is listed. Counts are from local Vitest coverage runs and one full Playwright run on this branch.

## Totals

| Suite       | Passed  | Failed |
| ----------- | ------- | ------ |
| Unit        | 115     | 0      |
| Integration | 35      | 0      |
| Component   | 31      | 0      |
| End to end  | 23      | 0      |
| **All**     | **204** | **0**  |

Unit is `packages/shared` (26), API tests that are not `*.integration.test.ts` (76), and web tests that are not rendered pages (13). Integration is the three API `*.integration.test.ts` files. Component is Testing Library in `apps/web/tests` (`auth-flow`, `catalog`, `commerce`, `layout`). End to end is Playwright in `apps/web/e2e`.

## Coverage

Line gate is 80% for every package. The web branch gate stays 70, as Milestone 1 recorded.

| Package           | Lines  | Statements | Branches | Functions |
| ----------------- | ------ | ---------- | -------- | --------- |
| `packages/shared` | 98.74% | 98.75%     | 95.74%   | 100%      |
| `apps/api`        | 93.77% | 93.78%     | 82.93%   | 97.78%    |
| `apps/web`        | 88.26% | 88.29%     | 78.50%   | 89.57%    |

## Accessibility

`apps/web/e2e/a11y.spec.ts` runs `@axe-core/playwright` with WCAG 2.1 A and AA tags on the storefront, the signed-in shopping screens, and the admin screens. Serious and critical violations: **0**. `apps/web/e2e/keyboard.spec.ts` completes sign-up, search, add to cart, and checkout with the keyboard, and the search field shows a visible focus outline.

## Performance

Measured on 2026-11-19 with Node 22.23.4. Raw output is in [lighthouse-results.json](lighthouse-results.json) and [load-results.json](load-results.json).

Lighthouse lab run against `vite preview` of the production build, proxied to the API:

| Page           | Performance | Accessibility | Best practices | SEO | LCP    | CLS   | TBT   |
| -------------- | ----------- | ------------- | -------------- | --- | ------ | ----- | ----- |
| Home           | 100         | 100           | 96             | 92  | 758 ms | 0.056 | 37 ms |
| Product detail | 98          | 100           | 96             | 92  | 2.44 s | 0     | 31 ms |

Targets of 90 are met for performance, accessibility, best practices, and SEO. LCP is under 2.5 s and CLS is under 0.1. Lab Lighthouse did not emit INP. Total blocking time, the lab responsiveness metric that was reported, is 31–37 ms.

Catalog load against 10,006 active products (`connection_limit=5`). Autocannon does not print p95, so the conservative figure is p97.5:

| Call                                      | Result                                 |
| ----------------------------------------- | -------------------------------------- |
| `GET /v1/products`                        | p97.5 4 ms, 21,152 requests, 0 non-2xx |
| `GET /v1/products?q=load milk N` (unique) | p97.5 3 ms, 25,911 requests, 0 non-2xx |
| Checkout, 20 sequential successes         | p50 12 ms, p95 15 ms, p99 44 ms        |

The storefront JavaScript bundle is 133 KB gzip (budget 200 KB).

`EXPLAIN` for listing and search uses the partial btree indexes (`products_subcat_active_idx`, the live category and subcategory indexes). `products_search_gin` exists. At this size the planner filters `search_vector` after the subcategory index instead of choosing the GIN index. p97.5 stayed at 3–4 ms, so no new index was added.

## Security

Reviewed against the routes, Zod validation, helmet, cookies, rate limits, image-host checks, idempotency, and the error handler.

| Check                                   | Result                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization on cart, order, and admin | Present. Guests 401, customers 403 on admin. Covered by integration and `guest-redirect.spec.ts`.                                                                                                                                                                                                               |
| Input validation                        | Zod from `@qc/shared` on body, query, and params.                                                                                                                                                                                                                                                               |
| Rate limits                             | 10/min auth and 100/min public in production defaults. Integration tests cover 429. E2E raises the limits so the suite stays deterministic.                                                                                                                                                                     |
| Headers and cookies                     | Helmet CSP, HSTS, nosniff. `qc_rt` is HttpOnly, Secure, SameSite=Strict.                                                                                                                                                                                                                                        |
| Secrets                                 | gitleaks clean on these commits. `SENTRY_DSN` is an empty placeholder.                                                                                                                                                                                                                                          |
| PII in logs                             | Password, email, phone, and address are redacted on `req.body`. Admin login failures log the user id, not the password.                                                                                                                                                                                         |
| Image URL SSRF                          | The API does not fetch image URLs. https and the host allowlist are required. Credentials in the URL are rejected.                                                                                                                                                                                              |
| Idempotency                             | Same key and body returns the original order. A different body is `IDEMPOTENCY_KEY_REUSED`.                                                                                                                                                                                                                     |
| Error leakage                           | Unexpected errors return `Something went wrong` and are reported with the request id.                                                                                                                                                                                                                           |
| `npm audit` production                  | No high or critical advisories.                                                                                                                                                                                                                                                                                 |
| `npm audit` full tree                   | The only historical high exception is picomatch `GHSA-fc5q-39xc-vjpf` in dev tooling. This run's audit printed no remaining high advisory after the Lighthouse 13 upgrade. The allowlist stays.                                                                                                                 |
| `eslint-plugin-security` on `src`       | Clean for eval, child process, `new Buffer`, and CSRF-before-method-override. Object-injection, timing-attack, non-literal filesystem, and unsafe-regex rules are off and triaged in `eslint.security.config.js`: the hits are fixed server paths and length-limited patterns, not request-built SQL or `eval`. |
| CodeQL                                  | Workflow `.github/workflows/codeql.yml` runs on pull requests.                                                                                                                                                                                                                                                  |

## Acceptance criteria

| ID          | Status  | Automated proof                                                                                                                                                        |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AUTH-01  | pass    | `packages/shared/tests/auth.test.ts`, `apps/api/tests/auth.integration.test.ts`, `e2e/signup-to-cart.spec.ts`                                                          |
| FR-AUTH-02  | pass    | `auth.integration.test.ts`, `e2e/login.spec.ts`                                                                                                                        |
| FR-AUTH-03  | pass    | `auth.integration.test.ts`, `e2e/logout.spec.ts`                                                                                                                       |
| FR-AUTH-04  | pass    | `token.service.test.ts`, `auth.integration.test.ts`, `apps/web/tests/api-client.test.ts`                                                                               |
| FR-AUTH-05  | pass    | `auth.middleware.test.ts`, `auth.integration.test.ts`, `e2e/guest-redirect.spec.ts`                                                                                    |
| FR-AUTH-06  | pass    | `seed.test.ts`, `auth.integration.test.ts` (signup ignores a role)                                                                                                     |
| FR-AUTH-07  | pass    | `token-version-cache.test.ts`, `auth.integration.test.ts`, `e2e/logout.spec.ts` (logout everywhere)                                                                    |
| FR-AUTH-08  | pass    | `lockout.test.ts`, `auth.integration.test.ts`, `e2e/login.spec.ts`                                                                                                     |
| FR-CAT-01   | pass    | `catalog.integration.test.ts`, `apps/web/tests/catalog.test.tsx`, `e2e/search.spec.ts`                                                                                 |
| FR-CAT-02   | pass    | `catalog.integration.test.ts`, `e2e/admin-catalog.spec.ts`                                                                                                             |
| FR-CAT-03   | pass    | `catalog.integration.test.ts`, `apps/web/tests/catalog.test.tsx`                                                                                                       |
| FR-CAT-04   | pass    | `catalog.unit.test.ts`, `catalog.integration.test.ts`, `e2e/admin-catalog.spec.ts`                                                                                     |
| FR-CAT-05   | pass    | `catalog.integration.test.ts`, `e2e/admin-catalog.spec.ts`                                                                                                             |
| FR-CAT-06   | pass    | `catalog.integration.test.ts`                                                                                                                                          |
| FR-CAT-07   | pass    | `catalog.integration.test.ts`                                                                                                                                          |
| FR-PROD-01  | pass    | `catalog.integration.test.ts`, `apps/web/tests/catalog.test.tsx`                                                                                                       |
| FR-PROD-02  | pass    | `catalog.unit.test.ts`, `catalog.integration.test.ts`, `e2e/search.spec.ts` (`amul buter`)                                                                             |
| FR-PROD-03  | pass    | `catalog.integration.test.ts`, `apps/web/tests/catalog.test.tsx`                                                                                                       |
| FR-PROD-04  | pass    | `catalog.integration.test.ts`                                                                                                                                          |
| FR-PROD-05  | pass    | `catalog.integration.test.ts`, `apps/web/tests/catalog.test.tsx`, `e2e/search.spec.ts`                                                                                 |
| FR-PROD-06  | pass    | `packages/shared/tests/catalog.test.ts`, `catalog.integration.test.ts`, `e2e/admin-catalog.spec.ts`                                                                    |
| FR-PROD-07  | pass    | `catalog.integration.test.ts`, `e2e/admin-catalog.spec.ts`                                                                                                             |
| FR-PROD-08  | pass    | `catalog.integration.test.ts`, `e2e/admin-catalog.spec.ts`                                                                                                             |
| FR-PROD-09  | pass    | `catalog.integration.test.ts`                                                                                                                                          |
| FR-CART-01  | pass    | `orders.integration.test.ts`, `e2e/guest-redirect.spec.ts`, `e2e/signup-to-cart.spec.ts`                                                                               |
| FR-CART-02  | pass    | `orders.integration.test.ts`, `e2e/signup-to-cart.spec.ts`, `e2e/cart.spec.ts`                                                                                         |
| FR-CART-03  | pass    | `orders.integration.test.ts`, `e2e/cart.spec.ts`                                                                                                                       |
| FR-CART-04  | pass    | `orders.integration.test.ts`, `e2e/cart.spec.ts`                                                                                                                       |
| FR-CART-05  | pass    | `orders.unit.test.ts`, `orders.integration.test.ts`, `apps/web/tests/commerce.test.tsx`                                                                                |
| FR-CART-06  | pass    | `orders.integration.test.ts`                                                                                                                                           |
| FR-ORD-01   | pass    | `packages/shared/tests/commerce.test.ts`, `orders.integration.test.ts`, `e2e/checkout-happy.spec.ts`                                                                   |
| FR-ORD-02   | pass    | `orders.unit.test.ts`, `orders.integration.test.ts`, `e2e/checkout-payment-failure.spec.ts`                                                                            |
| FR-ORD-03   | pass    | `orders.unit.test.ts`, `orders.integration.test.ts`, `e2e/checkout-happy.spec.ts`                                                                                      |
| FR-ORD-04   | pass    | `orders.integration.test.ts`                                                                                                                                           |
| FR-ORD-05   | pass    | `apps/web/tests/commerce.test.tsx`, `e2e/checkout-happy.spec.ts`                                                                                                       |
| FR-ORD-06   | pass    | `orders.integration.test.ts`, `e2e/my-orders.spec.ts`                                                                                                                  |
| FR-ORD-07   | pass    | `orders.integration.test.ts`, `e2e/admin-orders.spec.ts`                                                                                                               |
| FR-ORD-08   | pass    | `orders.unit.test.ts`, `orders.integration.test.ts`, `e2e/admin-orders.spec.ts`                                                                                        |
| FR-ORD-09   | pass    | `orders.integration.test.ts`                                                                                                                                           |
| FR-ORD-10   | pass    | `orders.integration.test.ts`, `e2e/price-changed.spec.ts`                                                                                                              |
| FR-ORD-11   | pass    | `packages/shared/tests/commerce.test.ts`, `catalog.integration.test.ts`, `orders.integration.test.ts`, `e2e/not-serviceable.spec.ts`                                   |
| FR-ORD-12   | pass    | `orders.unit.test.ts`, `orders.integration.test.ts`, `.github/workflows/sweep.yml` dry run                                                                             |
| FR-ADM-01   | pass    | `orders.integration.test.ts`, `e2e/admin-orders.spec.ts` (dashboard headings)                                                                                          |
| NFR-SEC-01  | pass    | `password.service.test.ts`, `auth.integration.test.ts`                                                                                                                 |
| NFR-SEC-02  | pass    | `http.test.ts`, `auth.integration.test.ts`                                                                                                                             |
| NFR-SEC-03  | pass    | shared schema tests, `errors.test.ts`, repositories use tagged `$queryRaw` only                                                                                        |
| NFR-SEC-04  | pass    | `http.test.ts`, `csrf.test.ts`, `cookies.test.ts`                                                                                                                      |
| NFR-SEC-05  | pass    | CI gitleaks and `scripts/audit-deps.mjs`. See the security table.                                                                                                      |
| NFR-SEC-06  | pass    | `http.test.ts` (no CORS header), `e2e/session-reload.spec.ts` (cookie through the web origin). A Vercel preview was not deployed.                                      |
| NFR-SEC-07  | pass    | `packages/shared/tests/catalog.test.ts`, `catalog.integration.test.ts`, `errors.test.ts`                                                                               |
| NFR-PERF-01 | pass    | `scripts/load-test.mjs`. Search and listing p97.5 are 3–4 ms with 10,006 products.                                                                                     |
| NFR-PERF-02 | pass    | `scripts/lighthouse.mjs`. Scores and LCP/CLS meet the targets. INP was not emitted by the lab run; TBT was 31–37 ms.                                                   |
| NFR-PERF-03 | pass    | `catalog.integration.test.ts`, `apps/web/tests/catalog.test.tsx` (staleTime 60 s)                                                                                      |
| NFR-A11Y-01 | pass    | `e2e/a11y.spec.ts`. Zero serious or critical axe violations.                                                                                                           |
| NFR-A11Y-02 | pass    | `e2e/keyboard.spec.ts`, `apps/web/tests/commerce.test.tsx`                                                                                                             |
| NFR-OPS-01  | pass    | `http.test.ts`, `logger` request id coverage, OpenAPI check                                                                                                            |
| NFR-OPS-02  | pass    | `error-reporting.test.ts` (API and web), `logger.test.ts` (slow query at 200 ms). Uptime polling of a public host is in the deployment runbook and is not switched on. |
| NFR-OPS-03  | partial | `shutdown.test.ts` drains in-flight work. `docs/05-deployment/README.md` is the runbook. Singapore hosting was not deployed in this milestone.                         |
| NFR-QUAL-01 | pass    | Coverage table above. CI runs Vitest with the 80% line gate and Playwright.                                                                                            |
| NFR-QUAL-02 | pass    | `npm run openapi:check` and `npm run db:drift` (no difference).                                                                                                        |

## Known issues

- NFR-OPS-03 is partial until Checkpoint 5 deploys the API and Postgres in Singapore.
- Lab Lighthouse did not report INP. Responsiveness is evidenced by TBT of 31–37 ms.
- `products_search_gin` was not selected at 10,006 rows. Latency is far under 500 ms, so no index was added.
- Product-detail LCP was 2.44 s, under the 2.5 s target and close to it.
- Best-practices score is 96 on `http://127.0.0.1` because the lab run is not TLS. The production plan uses HTTPS.
- Picomatch `GHSA-fc5q-39xc-vjpf` stays allowlisted for dev tooling if it reappears. Production audit is clean.
