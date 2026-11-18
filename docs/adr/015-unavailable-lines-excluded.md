# ADR-015: Unavailable cart lines are excluded from checkout

- Status: Accepted
- Date: 2026-11-18

## Context

The design says a soft-deleted product stays in the cart, shows as unavailable, and blocks checkout until it is removed. The checkout transaction also says every product must be active and in stock or the whole attempt rolls back. Milestone 4 was asked to flag those lines and exclude them from checkout.

## Decision

A line whose product is inactive or soft-deleted is `available: false` and is not purchased. Checkout of the remaining lines still runs. If every line is unavailable, checkout returns `422 CART_EMPTY`. An active product with less stock than the quantity still returns `409 INSUFFICIENT_STOCK` and buys nothing. The cart screen disables Checkout while any line is unavailable, so a shopper removes or reduces those lines before paying.

## Consequences

A direct API call can buy the available lines and leave the unavailable ones out of the order. A successful payment clears the whole cart, including lines that were not purchased. Past order snapshots are unchanged.
