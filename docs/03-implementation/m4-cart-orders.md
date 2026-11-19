# Milestone 4: Cart and orders

**Status:** Done.

Approved at Checkpoint 3 and merged on 2026-11-18.

|              |                                                       |
| ------------ | ----------------------------------------------------- |
| Branch       | `feature/m4-cart-orders`                              |
| Pull request | https://github.com/shaighub/quick-commerce-app/pull/5 |

## What was built

- Customer cart: `GET /v1/cart`, `POST /v1/cart/items`, `PATCH /v1/cart/items/:itemId`, `DELETE /v1/cart/items/:itemId`, and `DELETE /v1/cart`. Guests receive `401`. Admins receive `403`. Totals are computed on the server in paise, including `DELIVERY_FEE_PAISE` only when something can be bought.
- Lines whose product is inactive or soft-deleted are `available: false` and are excluded from checkout ([ADR-015](../adr/015-unavailable-lines-excluded.md)). An active line above stock is `409 INSUFFICIENT_STOCK` with the available quantity. Quantity must be 1 to 10.
- `POST /v1/orders/checkout` requires `Idempotency-Key`. The same key and body return the original result. A different body is `422 IDEMPOTENCY_KEY_REUSED` ([ADR-016](../adr/016-idempotency-key-lifetime.md)). `expectedTotalPaise` mismatch is `409 PRICE_CHANGED` with the fresh cart and no stock change. An unserved pincode is `422 NOT_SERVICEABLE` before stock is touched, using `refusalForUnserviceablePincode`.
- Checkout locks products `FOR UPDATE` in id order, decrements with `stock >= quantity`, and issues `QC-YYYYMMDD-NNNNNN` from the IST counter inside the same transaction (ADR-006). `order_items` snapshot the unit price. Every status change writes `order_status_history`.
- `MockGateway` implements `PaymentGateway` (ADR-008). The order is inserted as `PENDING_PAYMENT`, then the mock confirms it or marks `PAYMENT_FAILED` and restocks. Failure keeps the cart. Success clears it.
- `POST /v1/internal/jobs/sweep` compares `X-Jobs-Token` in constant time, fails pending orders older than 15 minutes, and restocks them. A second run and a concurrent run do not restock twice. The API sweeps on startup. `.github/workflows/sweep.yml` calls the endpoint every 10 minutes when the secrets exist, and exits as a dry run when they do not.
- Customers list and open only their own orders. Another customer’s order is `404`. Admins filter orders and move them through the allowed transitions. Cancel restocks and sets the mock payment to `REFUNDED`. `GET /v1/admin/dashboard` reports the IST day.
- Storefront: cart, checkout with address prefilled from `GET /v1/auth/me`, mock payment, `PRICE_CHANGED` confirmation, order number on the confirmation screen, order history, and order detail. Add to cart works for a customer. A guest is sent to log in, and the item is added after sign-in. The header shows the cart count.
- Admin orders list, detail, and status update, plus the dashboard summary.
- OpenAPI is generated from the shared Zod schemas.

No new migration. The cart, order, payment, and counter tables were already in `20261117180000_init`.

## Verification

Local, PostgreSQL 16, on 2026-11-18. GitHub Actions on [PR #5](https://github.com/shaighub/quick-commerce-app/pull/5) is green for `05166af`.

| Check                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                          | Pass, zero warnings                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Format check                  | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Type-check                    | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Migrate                       | `20261117180000_init` applied on a fresh `quick_commerce` database. No new migration.                                                                                                                                                                                                                                                                                                                                                        |
| Drift                         | `prisma migrate diff` reported no difference                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tests                         | `@qc/shared` 26 passed. `@qc/api` 105 passed. `@qc/web` 40 passed.                                                                                                                                                                                                                                                                                                                                                                           |
| Coverage                      | Shared lines 98.74%, statements 98.75%, branches 95.74%, functions 100%. API lines 93.71%, statements 93.72%, branches 82.45%, functions 98%. Web lines 88.77%, statements 88.78%, branches 79.47% (gate 70%), functions 88.85%.                                                                                                                                                                                                             |
| Build                         | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `node scripts/audit-deps.mjs` | Production dependencies clean. The only remaining high advisory is the allowed dev-only picomatch ReDoS.                                                                                                                                                                                                                                                                                                                                     |
| OpenAPI check                 | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| gitleaks                      | Pass, no leaks                                                                                                                                                                                                                                                                                                                                                                                                                               |
| GitHub Actions                | Pass. The pull request check on `05166af` completed with no failures.                                                                                                                                                                                                                                                                                                                                                                        |
| Browser                       | Pass. Guest shop showed Amul Butter. Add to cart opened Log in with `next=`. After sign-up the header showed Cart (1). Quantity 2 totaled ₹137.00 and quantity 1 totaled ₹81.00. Checkout to 560001 confirmed QC-20261118-000001 at ₹81.00. Simulate failure kept the cart and named QC-20261118-000002. My orders showed the status history. Admin marked QC-20261118-000001 Packed. The dashboard showed 1 order today and ₹81.00 revenue. |

## Deviations

- Idempotency keys do not expire after 24 hours. The unique index cannot store a second order for the same key ([ADR-016](../adr/016-idempotency-key-lifetime.md)).
- Inactive and soft-deleted lines are excluded from the purchased set instead of failing checkout by themselves ([ADR-015](../adr/015-unavailable-lines-excluded.md)). The screen still blocks Checkout while any line is unavailable.
- `GET /v1/cart` also returns `deliveryFeePaise` and `totalPaise`. The design listed `itemCount` and `subtotalPaise`. The extra fields keep delivery-fee math on the server.
- Admin order detail is `/admin/orders/:orderNumber`. The screen table only named the list route.
- Playwright specs named in the traceability matrix are still outside CI, as in Milestone 3. Component tests and a browser pass cover the same flows.
- Dashboard `ordersToday` counts paid or cancelled orders placed on the IST day. `revenueTodayPaise` excludes cancelled, pending, and failed orders. `pendingOrders` counts `PENDING_PAYMENT`, `CONFIRMED`, `PACKED`, and `OUT_FOR_DELIVERY` on any day.

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
