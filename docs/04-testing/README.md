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

What the repository runs today, from `.github/workflows/ci.yml`: lint, format, type-check, migrate, drift, OpenAPI check, Vitest with coverage, build, dependency audit, and gitleaks. Playwright is configured in `apps/web` and is not a CI job (`apps/web/e2e/README.md`). The workflow has no autocannon or Lighthouse step. Those remain planned checks in the design.

Line coverage thresholds in the Vitest configs are 80% for `packages/shared`, `apps/api`, and `apps/web`. The web branch threshold is 70, which [Milestone 1](../03-implementation/m1-foundation.md) recorded as a deviation. Line coverage on the web package was reported at 100% in that pull request.

## Checkpoint 4 test report

Placeholder. No pass count, fail count, or coverage figure has been recorded for this checkpoint.

| Measure    | Result  |
| ---------- | ------- |
| Pass count | pending |
| Fail count | pending |
| Coverage   | pending |

### Acceptance criteria

Every ID in the traceability matrix. Status stays `pending` until Checkpoint 4 records a result.

| ID          | Status  |
| ----------- | ------- |
| FR-AUTH-01  | pending |
| FR-AUTH-02  | pending |
| FR-AUTH-03  | pending |
| FR-AUTH-04  | pending |
| FR-AUTH-05  | pending |
| FR-AUTH-06  | pending |
| FR-AUTH-07  | pending |
| FR-AUTH-08  | pending |
| FR-CAT-01   | pending |
| FR-CAT-02   | pending |
| FR-CAT-03   | pending |
| FR-CAT-04   | pending |
| FR-CAT-05   | pending |
| FR-CAT-06   | pending |
| FR-CAT-07   | pending |
| FR-PROD-01  | pending |
| FR-PROD-02  | pending |
| FR-PROD-03  | pending |
| FR-PROD-04  | pending |
| FR-PROD-05  | pending |
| FR-PROD-06  | pending |
| FR-PROD-07  | pending |
| FR-PROD-08  | pending |
| FR-PROD-09  | pending |
| FR-CART-01  | pending |
| FR-CART-02  | pending |
| FR-CART-03  | pending |
| FR-CART-04  | pending |
| FR-CART-05  | pending |
| FR-CART-06  | pending |
| FR-ORD-01   | pending |
| FR-ORD-02   | pending |
| FR-ORD-03   | pending |
| FR-ORD-04   | pending |
| FR-ORD-05   | pending |
| FR-ORD-06   | pending |
| FR-ORD-07   | pending |
| FR-ORD-08   | pending |
| FR-ORD-09   | pending |
| FR-ORD-10   | pending |
| FR-ORD-11   | pending |
| FR-ORD-12   | pending |
| FR-ADM-01   | pending |
| NFR-SEC-01  | pending |
| NFR-SEC-02  | pending |
| NFR-SEC-03  | pending |
| NFR-SEC-04  | pending |
| NFR-SEC-05  | pending |
| NFR-SEC-06  | pending |
| NFR-SEC-07  | pending |
| NFR-PERF-01 | pending |
| NFR-PERF-02 | pending |
| NFR-PERF-03 | pending |
| NFR-A11Y-01 | pending |
| NFR-A11Y-02 | pending |
| NFR-OPS-01  | pending |
| NFR-OPS-02  | pending |
| NFR-OPS-03  | pending |
| NFR-QUAL-01 | pending |
| NFR-QUAL-02 | pending |
