# Testing

**Status:** Not started as a phase. Checkpoint 4 has no entry in the [approval log](../checkpoints.md).

Milestone 1 recorded its own local and CI results. Checkpoint 4 is a separate report. See [Milestone 1 verification](../03-implementation/m1-foundation.md).

## Strategy

The design's [traceability matrix](../design.md#4-requirement-traceability-matrix) names the test types:

> Test types: UT unit (Vitest), IT API integration (Vitest + Supertest, test PostgreSQL), CT component (Testing Library), E2E (Playwright), plus CI, Perf and Lighthouse checks.

Each row of that matrix lists the planned tests for one requirement. The acceptance criteria are copied in [requirements](../01-requirements/requirements.md). The org testing standard, and where it is enforced, is in [standards](../01-requirements/standards.md).

Release bars from the same matrix:

| ID          | Acceptance criterion                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| NFR-QUAL-01 | Pull requests cannot merge below 80% coverage or with failing checks.                                       |
| NFR-QUAL-02 | API validation, web forms and the OpenAPI spec come from the same schemas, and raw-SQL indexes never drift. |
| NFR-PERF-01 | Search and listing stay under 500 ms at p95 with 10,000 products.                                           |
| NFR-PERF-02 | LCP under 2.5 s, INP under 200 ms, CLS under 0.1, and Lighthouse performance and accessibility at least 90. |
| NFR-A11Y-01 | No serious or critical axe violations; contrast at least 4.5:1 for text.                                    |

What the repository runs today, from `.github/workflows/ci.yml`: lint, format, type-check, migrate, drift, OpenAPI check, Vitest with coverage, build, bundle size, security lint, dependency audit, gitleaks, Playwright, Lighthouse, and the catalog load test. See [apps/web/e2e/README.md](../../apps/web/e2e/README.md).

Line coverage thresholds in the Vitest configs are 80% for `packages/shared`, `apps/api`, and `apps/web`. The web branch threshold is 70, which [Milestone 1](../03-implementation/m1-foundation.md) recorded as a deviation. Line coverage on the web package was reported at 100% in that pull request.

## Checkpoint 4 test report

The measured results are in [test-report.md](test-report.md). Summary from 2026-11-19: 204 tests passed and 0 failed (115 unit, 35 integration, 31 component, 23 end to end). Line coverage is 98.74% shared, 93.77% API, and 88.26% web. axe serious/critical violations are 0. Lighthouse performance and accessibility are at least 98. Catalog p97.5 is 3–4 ms with 10,006 products.

NFR-OPS-03 is partial because Singapore hosting was not deployed. Every other traceability ID is pass, with the notes in the report.

### Acceptance criteria

Every ID in the traceability matrix. The status column matches [test-report.md](test-report.md).

| ID          | Status  |
| ----------- | ------- |
| FR-AUTH-01  | pass    |
| FR-AUTH-02  | pass    |
| FR-AUTH-03  | pass    |
| FR-AUTH-04  | pass    |
| FR-AUTH-05  | pass    |
| FR-AUTH-06  | pass    |
| FR-AUTH-07  | pass    |
| FR-AUTH-08  | pass    |
| FR-CAT-01   | pass    |
| FR-CAT-02   | pass    |
| FR-CAT-03   | pass    |
| FR-CAT-04   | pass    |
| FR-CAT-05   | pass    |
| FR-CAT-06   | pass    |
| FR-CAT-07   | pass    |
| FR-PROD-01  | pass    |
| FR-PROD-02  | pass    |
| FR-PROD-03  | pass    |
| FR-PROD-04  | pass    |
| FR-PROD-05  | pass    |
| FR-PROD-06  | pass    |
| FR-PROD-07  | pass    |
| FR-PROD-08  | pass    |
| FR-PROD-09  | pass    |
| FR-CART-01  | pass    |
| FR-CART-02  | pass    |
| FR-CART-03  | pass    |
| FR-CART-04  | pass    |
| FR-CART-05  | pass    |
| FR-CART-06  | pass    |
| FR-ORD-01   | pass    |
| FR-ORD-02   | pass    |
| FR-ORD-03   | pass    |
| FR-ORD-04   | pass    |
| FR-ORD-05   | pass    |
| FR-ORD-06   | pass    |
| FR-ORD-07   | pass    |
| FR-ORD-08   | pass    |
| FR-ORD-09   | pass    |
| FR-ORD-10   | pass    |
| FR-ORD-11   | pass    |
| FR-ORD-12   | pass    |
| FR-ADM-01   | pass    |
| NFR-SEC-01  | pass    |
| NFR-SEC-02  | pass    |
| NFR-SEC-03  | pass    |
| NFR-SEC-04  | pass    |
| NFR-SEC-05  | pass    |
| NFR-SEC-06  | pass    |
| NFR-SEC-07  | pass    |
| NFR-PERF-01 | pass    |
| NFR-PERF-02 | pass    |
| NFR-PERF-03 | pass    |
| NFR-A11Y-01 | pass    |
| NFR-A11Y-02 | pass    |
| NFR-OPS-01  | pass    |
| NFR-OPS-02  | pass    |
| NFR-OPS-03  | partial |
| NFR-QUAL-01 | pass    |
| NFR-QUAL-02 | pass    |
