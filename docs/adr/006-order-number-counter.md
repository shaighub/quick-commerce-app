# ADR-006: Order numbers from a per-day counter

- Status: Accepted
- Date: 2026-11-17
- Review refs: R10

## Context

Customers and support staff need a short, unique order number. A random UUID is a poor thing to read over the phone. A database sequence does not reset each day and is awkward to format.

## Decision

`order_number_counters` has one row per Asia/Kolkata date. Checkout upserts that row inside the order transaction and formats `QC-YYYYMMDD-NNNNNN`. The unique constraint on `orders.order_number` is the final guard. The counter allows at most 999,999 orders per day.

## Consequences

Concurrent checkouts serialize briefly on today's row. That is acceptable at the expected volume. The counter table has no foreign key to orders; it only issues numbers.
