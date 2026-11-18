# Milestone 4: Cart and orders

**Status:** Not started.

No branch, pull request, or verification result is recorded.

## Planned scope

From the approved design. The IDs are the CART, ORD, and ADM modules.

- Cart routes and checkout, including `POST /v1/orders/checkout`, in [section 2](../design.md#2-api-endpoints-v1).
- [Checkout transaction](../design.md#checkout-transaction-stock-decrement--price-snapshot) and the [checkout sequence](../design.md#checkout).
- [Order number generation](../design.md#order-number-generation-qc-yyyymmdd-nnnnnn) (`QC-YYYYMMDD-NNNNNN`).
- [Order status transitions](../design.md#order-status-transitions).
- Screens [S05](../design.md#3-screens) through [S09](../design.md#3-screens), [A01](../design.md#3-screens), and [A05](../design.md#3-screens).
- [ADR-006](../adr/006-order-number-counter.md), per-day order numbers.
- [ADR-008](../adr/008-payment-gateway.md), PaymentGateway port, two-transaction checkout, and the pending-payment sweeper (FR-ORD-12).
- [ADR-010](../adr/010-no-cart-reservation.md), no cart stock reservation in the MVP.
- [ADR-005](../adr/005-money-as-paise.md), totals in paise.

[PR #1](https://github.com/shaighub/quick-commerce-app/pull/1) left cart, checkout and payments, admin CRUD, order status, and the pending-payment sweeper for later milestones. Admin catalog CRUD is [Milestone 3](m3-catalog.md). Admin orders and the dashboard are this milestone (FR-ORD-07, FR-ORD-08, FR-ADM-01).

The exit criterion is the acceptance criterion in the [traceability matrix](../design.md#4-requirement-traceability-matrix). No Checkpoint 4 result is recorded. [NFR-SEC-03](m5-hardening.md) (server-side validation and parameterized queries) also applies to the endpoints in this milestone. Its exit criterion is tracked once, on Milestone 5.

## Exit criteria

| ID         | Requirement                                    | Exit criterion                                                                                                    |
| ---------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| FR-CART-01 | Guests must sign up or log in to use the cart  | A guest pressing Add to cart is taken to Log in or Sign up and the item is added once signed in.                  |
| FR-CART-02 | Add an item to the cart                        | The item appears in the cart and the header badge updates.                                                        |
| FR-CART-03 | Update an item's quantity                      | Quantity changes between 1 and 10 and never above stock.                                                          |
| FR-CART-04 | Remove an item or clear the cart               | Removed items disappear and totals update.                                                                        |
| FR-CART-05 | View the cart with totals and availability     | Subtotal equals current price times quantity; unavailable items are flagged and block checkout.                   |
| FR-CART-06 | Stock is checked on add and update             | Users cannot put more in the cart than is in stock and see how many are left.                                     |
| FR-ORD-01  | Checkout with a delivery address               | Checkout accepts a valid Indian address, prefilled from the last order, and stores it on the order.               |
| FR-ORD-02  | Mock payment behind a PaymentGateway interface | Simulate success confirms the order; Simulate failure shows a retry and changes nothing else.                     |
| FR-ORD-03  | Unique order number QC-YYYYMMDD-NNNNNN         | Every order gets a unique number in the agreed format, shown on confirmation and in lists.                        |
| FR-ORD-04  | Atomic stock decrement and price snapshot      | Stock is never oversold and orders keep the price paid.                                                           |
| FR-ORD-05  | Order confirmation screen                      | After payment the customer sees the order number, items, total and address.                                       |
| FR-ORD-06  | Customer order history and order detail        | Customers see only their own orders with status history and prices paid.                                          |
| FR-ORD-07  | Admin views all orders                         | Admins can filter and open any order.                                                                             |
| FR-ORD-08  | Admin updates order status                     | Only allowed transitions succeed, every change is recorded, and cancelling restocks items.                        |
| FR-ORD-09  | Checkout is idempotent                         | A double click or retry never creates a second order, and a reused key cannot place a different order.            |
| FR-ORD-10  | Price change confirmation at checkout          | A customer is never charged a total they have not seen; a price change shows old and new totals for confirmation. |
| FR-ORD-11  | Delivery only to served pincodes               | Home shows whether the chosen pincode is served, and checkout rejects unserved pincodes with a clear message.     |
| FR-ORD-12  | Stuck pending-payment orders are swept         | No order stays in PENDING_PAYMENT for more than about 25 minutes, and its stock returns to sale.                  |
| FR-ADM-01  | Admin dashboard summary                        | Shows today's orders and revenue, pending orders, low-stock products and the 10 latest orders.                    |
