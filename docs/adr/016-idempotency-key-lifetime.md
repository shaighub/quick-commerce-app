# ADR-016: Idempotency keys last for the life of the account

- Status: Accepted
- Date: 2026-11-18

## Context

Checkout stores `Idempotency-Key` with a SHA-256 of the body. Review note R15 says a key stops mattering after 24 hours. The approved `orders` table also has a permanent unique index on `(user_id, idempotency_key)`.

## Decision

The unique index wins. The same key and the same body always return the original result. The same key and a different body return `422 IDEMPOTENCY_KEY_REUSED`. A new order needs a new key. There is no 24-hour expiry, because a second insert with the same key would violate `orders_user_idem_key`.

## Consequences

A customer who retries a failed payment must send a new key. The storefront does that after `402 PAYMENT_FAILED` and after the shopper confirms a `PRICE_CHANGED` total. Keys are not deleted by the sweeper.
