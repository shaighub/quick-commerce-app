# Documentation

Documents for the quick commerce app, arranged by SDLC phase and milestone so they can be shared and browsed in order.

The approved design and the architecture decision records stay in their original paths. The phase pages link to them.

- [Detailed design](design.md) (Checkpoint 2, 2026-11-17)
- [Architecture decision records](adr/README.md)
- [Approval log](checkpoints.md)

## Phases

| Phase          | Status      | Approval date                               | Documents                                                                                  |
| -------------- | ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Requirements   | Done        | 2026-11-17 (Checkpoint 1)                   | [Requirements](01-requirements/requirements.md), [Standards](01-requirements/standards.md) |
| Design         | Done        | 2026-11-17 (Checkpoint 2)                   | [Summary](02-design/README.md), [Detailed design](design.md), [ADRs](adr/README.md)        |
| Implementation | In progress | 2026-11-18 (Checkpoint 3, Milestone 1 only) | [Implementation](03-implementation/README.md)                                              |
| Testing        | Not started | Pending (Checkpoint 4)                      | [Testing](04-testing/README.md)                                                            |
| Deployment     | Not started | Pending (Checkpoint 5)                      | [Deployment](05-deployment/README.md)                                                      |
| Maintenance    | Not started | Pending                                     | [Maintenance](06-maintenance/README.md)                                                    |

Checkpoint 3 approved Milestone 1. Milestone 2 is in progress, so the implementation phase stays in progress.

## Milestones

| Milestone          | Status      | Pull request                                                                                                 |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| M1 Foundation      | Done        | [PR #1](https://github.com/shaighub/quick-commerce-app/pull/1) ([notes](03-implementation/m1-foundation.md)) |
| M2 Auth            | In progress | None recorded. Branch `feature/m2-auth` ([notes](03-implementation/m2-auth.md))                              |
| M3 Catalog         | Not started | None ([notes](03-implementation/m3-catalog.md))                                                              |
| M4 Cart and orders | Not started | None ([notes](03-implementation/m4-cart-orders.md))                                                          |
| M5 Hardening       | Not started | None ([notes](03-implementation/m5-hardening.md))                                                            |

## Contents

```text
docs/
  README.md                          this index
  checkpoints.md                     approval log
  design.md                          approved detailed design (original path)
  adr/                               ADR-001 through ADR-012 (original path)
  01-requirements/
    requirements.md
    standards.md
  02-design/
    README.md
  03-implementation/
    README.md
    m1-foundation.md
    m2-auth.md
    m3-catalog.md
    m4-cart-orders.md
    m5-hardening.md
  04-testing/
    README.md
  05-deployment/
    README.md
  06-maintenance/
    README.md
```
