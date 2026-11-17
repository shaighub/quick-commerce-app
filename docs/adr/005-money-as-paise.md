# ADR-005: Money as integer paise

- Status: Accepted
- Date: 2026-11-17

## Context

Floating-point currency causes rounding errors on totals, delivery fees, and refunds.

## Decision

Every amount in the database and the API is an integer number of paise (`pricePaise`, `totalPaise`). One rupee is 100 paise. Prices must be greater than zero. Order totals must equal subtotal plus delivery fee, enforced by a CHECK constraint.

The UI formats rupees with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` and does not send floats back to the API.

## Consequences

Clients do arithmetic on integers. Formatting is a display concern only.
