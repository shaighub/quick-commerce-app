# ADR-009: Soft delete with RESTRICT foreign keys

- Status: Accepted
- Date: 2026-11-17
- Review refs: R21

## Context

Orders must keep the product that was sold. A hard delete would either fail the foreign key or destroy history.

## Decision

Categories, subcategories, and products use `deleted_at`. Foreign keys from children use `ON DELETE RESTRICT`. Users are deactivated, not deleted. Orders are not deleted by the application. Cascades exist only where a hard delete is a real erase (a user's refresh tokens and cart) or to keep test cleanup simple (order lines, payments, history).

Partial unique indexes allow a deleted slug, SKU, or name to be reused.

## Consequences

Public queries must exclude `deleted_at` and inactive rows. A later Prisma client extension will do that in one place. The partial indexes are SQL in the initial migration and are covered by the drift check.
