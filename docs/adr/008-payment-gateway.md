# ADR-008: PaymentGateway port and two-transaction checkout

- Status: Accepted
- Date: 2026-11-17
- Review refs: R12

## Context

Payment must be swappable, and a crash between reserving stock and recording the payment must not leave stock missing forever.

## Decision

`PaymentGateway` is an in-process port. `MockGateway` is the only adapter for now. Checkout writes the order, the line snapshots, a pending payment, and the first history row in one transaction, then charges outside that transaction. A second transaction confirms the order and clears the cart, or marks payment failed and restores stock.

`POST /v1/internal/jobs/sweep`, protected by `X-Jobs-Token`, marks `PENDING_PAYMENT` orders older than 15 minutes as `PAYMENT_FAILED` and restores stock. The API also sweeps on startup. A scheduled GitHub Actions workflow will call the endpoint because the free host has no always-on cron.

## Consequences

The port, the `payments` table, and `order_status_history` exist now. The charge and sweep behavior is a later milestone. A real gateway adds an adapter, not a new table.
