# ADR-010: No cart stock reservation in the MVP

- Status: Accepted
- Date: 2026-11-17
- Review refs: R13, R27

## Context

Quick-commerce apps sometimes hold stock while a shopper checks out. That needs a reservation table and an expiry job. The MVP still must not oversell.

## Decision

The cart does not reserve stock. Checkout locks product rows `FOR UPDATE` in id order, checks stock, and decrements with `WHERE stock >= quantity`. A conflict returns 409 `INSUFFICIENT_STOCK`. Time-boxed reservations can be added later behind an inventory service without changing the cart's public behavior.

## Consequences

Two shoppers can hold the same last unit in their carts. One of them is told at checkout. The cart shows live availability.
