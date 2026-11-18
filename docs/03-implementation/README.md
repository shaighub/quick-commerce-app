# Implementation

**Status:** In progress.

Milestones 1, 2, and 3 are done and merged. Milestone 4 is in progress. Milestone 5 has not started. Checkpoint 3 approved Milestones 1, 2, and 3 on 2026-11-18. [PR #4](https://github.com/shaighub/quick-commerce-app/pull/4) was squash-merged on 2026-11-18.

| Milestone          | Status      | Document                               | Pull request                                                   |
| ------------------ | ----------- | -------------------------------------- | -------------------------------------------------------------- |
| M1 Foundation      | Done        | [m1-foundation.md](m1-foundation.md)   | [PR #1](https://github.com/shaighub/quick-commerce-app/pull/1) |
| M2 Auth            | Done        | [m2-auth.md](m2-auth.md)               | [PR #3](https://github.com/shaighub/quick-commerce-app/pull/3) |
| M3 Catalog         | Done        | [m3-catalog.md](m3-catalog.md)         | [PR #4](https://github.com/shaighub/quick-commerce-app/pull/4) |
| M4 Cart and orders | In progress | [m4-cart-orders.md](m4-cart-orders.md) | `feature/m4-cart-orders`                                       |
| M5 Hardening       | Not started | [m5-hardening.md](m5-hardening.md)     | None                                                           |

The approved design is [docs/design.md](../design.md). These notes group that design by milestone. The design file is unchanged.

## How the later milestones are grouped

The design records requirements and acceptance criteria. It does not assign those IDs to milestone numbers. The grouping below follows the design's API modules and the work [PR #1](https://github.com/shaighub/quick-commerce-app/pull/1) left for later: auth and sessions, catalog and search endpoints, cart, checkout and payments, admin CRUD, order status, the pending-payment sweeper, Playwright flows, and hosting.

| Milestone          | Design modules               | Requirement IDs                                                                                                                          |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| M2 Auth            | AUTH                         | FR-AUTH-01–FR-AUTH-08, NFR-SEC-01, NFR-SEC-02, NFR-SEC-04, NFR-SEC-06                                                                    |
| M3 Catalog         | CAT, PROD                    | FR-CAT-01–FR-CAT-07, FR-PROD-01–FR-PROD-09, NFR-PERF-03, NFR-SEC-07                                                                      |
| M4 Cart and orders | CART, ORD, ADM               | FR-CART-01–FR-CART-06, FR-ORD-01–FR-ORD-12, FR-ADM-01                                                                                    |
| M5 Hardening       | Cross-cutting release checks | NFR-SEC-03, NFR-SEC-05, NFR-PERF-01, NFR-PERF-02, NFR-A11Y-01, NFR-A11Y-02, NFR-OPS-01, NFR-OPS-02, NFR-OPS-03, NFR-QUAL-01, NFR-QUAL-02 |

Exit criteria are the acceptance criteria in the [traceability matrix](../design.md#4-requirement-traceability-matrix). No Checkpoint 4 result is recorded for them.
