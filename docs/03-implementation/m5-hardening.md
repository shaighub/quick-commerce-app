# Milestone 5: Hardening

**Status:** In review.

|              |                                         |
| ------------ | --------------------------------------- |
| Branch       | `feature/m5-hardening`                  |
| Pull request | Opened against `main` from this branch. |

## Planned scope

From the approved design. These are the non-functional requirements that the traceability matrix does not tie to a single feature module, or that it ties to several modules at once. Feature milestones still have to satisfy the clauses that name their endpoints. The exit criterion is recorded once, here.

- [NFR-SEC-03](../design.md#4-requirement-traceability-matrix) on every body, query, and param. The matrix names sign-up, checkout, and admin product create.
- [NFR-SEC-05](../design.md#4-requirement-traceability-matrix), secret scanning and the dependency audit, at release.
- [NFR-PERF-01](../design.md#4-requirement-traceability-matrix) and [NFR-PERF-02](../design.md#4-requirement-traceability-matrix), API latency, Core Web Vitals, and Lighthouse.
- [NFR-A11Y-01](../design.md#4-requirement-traceability-matrix) and [NFR-A11Y-02](../design.md#4-requirement-traceability-matrix), axe on every screen and keyboard completion of search through confirmation.
- [NFR-OPS-01](../design.md#4-requirement-traceability-matrix), [NFR-OPS-02](../design.md#4-requirement-traceability-matrix), and [NFR-OPS-03](../design.md#4-requirement-traceability-matrix): health, logs, OpenAPI, error tracking, uptime, slow queries, and safe deploys in Singapore.
- [NFR-QUAL-01](../design.md#4-requirement-traceability-matrix) and [NFR-QUAL-02](../design.md#4-requirement-traceability-matrix): 80% line coverage, green CI, one contract source, and a migration drift check.
- [ADR-012](../adr/012-zod-contract.md) for the contract source. [ADR-011](../adr/011-hosting.md) for the deploy shape. Hosting approval itself is [Checkpoint 5](../05-deployment/README.md).

[PR #1](https://github.com/shaighub/quick-commerce-app/pull/1) already landed pieces of this scope and left the acceptance criteria open:

- CI runs lint, format, type-check, migrate, drift, tests with an 80% line gate, build, `npm audit` via `scripts/audit-deps.mjs`, and gitleaks.
- Health, Pino request logs, and OpenAPI at `/v1/docs` exist. Sentry is parsed from `SENTRY_DSN` and is not wired.
- Playwright flows and hosting were explicitly left for later. `.github/workflows/ci.yml` has no Playwright, Lighthouse, or autocannon job. `apps/web/e2e/README.md` says Playwright specs are not part of the Milestone 1 CI gate.

The picomatch advisory `GHSA-fc5q-39xc-vjpf` is the allowlisted exception recorded in that pull request and in `CONTRIBUTING.md`. NFR-SEC-05 says no known high or critical vulnerabilities at release. That release check has not been run as Checkpoint 4 or Checkpoint 5.

## What landed

- Playwright specs for browse and search, guest add-to-cart, sign-up, login, logout, logout everywhere, lockout, cart quantity and remove, checkout, payment failure, price confirmation, unserved pincodes, order history, admin catalog CRUD, admin order status, RBAC, axe, and keyboard checkout. CI runs them and uploads traces on failure.
- axe reports zero serious or critical violations on the storefront and admin screens.
- Lighthouse on Home and product detail, a 200 KB gzip JavaScript budget (measured 133 KB), and `scripts/load-test.mjs` against 10,006 products. No new index. Details are in the [test report](../04-testing/test-report.md).
- Security review, `eslint-plugin-security` on application source, and a CodeQL workflow. Request logs redact password, email, phone, and address.
- `SENTRY_DSN` and `VITE_SENTRY_DSN` send a small error envelope with the request id ([ADR-017](../adr/017-sentry-envelope-client.md)). An empty value does nothing.
- Deployment runbook only. Nothing was deployed.

## Exit criteria

| ID          | Requirement                                           | Exit criterion                                                                                                                 |
| ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| NFR-SEC-03  | Server-side validation and parameterized queries      | Every request body, query and param is validated, and no SQL is built by string concatenation.                                 |
| NFR-SEC-05  | Secret scanning and dependency audit                  | No committed secrets and no known high or critical vulnerabilities at release.                                                 |
| NFR-PERF-01 | API p95 under 500 ms for typical requests             | Search and listing stay under 500 ms at p95 with 10,000 products.                                                              |
| NFR-PERF-02 | Core Web Vitals good and Lighthouse 90+               | LCP under 2.5 s, INP under 200 ms, CLS under 0.1, and Lighthouse performance and accessibility at least 90.                    |
| NFR-A11Y-01 | WCAG 2.1 AA on every screen                           | No serious or critical axe violations; contrast at least 4.5:1 for text.                                                       |
| NFR-A11Y-02 | Keyboard and screen-reader support for the core flows | A customer can complete search to confirmation with the keyboard alone, with visible focus throughout.                         |
| NFR-OPS-01  | Health check, structured logs and OpenAPI docs        | Ops can check health, trace a request by id, and read the API docs.                                                            |
| NFR-OPS-02  | Error tracking, uptime and slow-query monitoring      | API and web errors are tracked with the same request id, /v1/health is monitored, and slow queries are logged.                 |
| NFR-OPS-03  | Safe deploys in the Singapore region                  | Migrations run before traffic switches, deploys do not cut off checkouts, and the API and database share the Singapore region. |
| NFR-QUAL-01 | 80% test coverage and green CI                        | Pull requests cannot merge below 80% coverage or with failing checks.                                                          |
| NFR-QUAL-02 | Single contract source and migration drift check      | API validation, web forms and the OpenAPI spec come from the same schemas, and raw-SQL indexes never drift.                    |
