# Milestone 3: Catalog

**Status:** Done.

Approved at Checkpoint 3 and merged on 2026-11-18.

|              |                                                       |
| ------------ | ----------------------------------------------------- |
| Branch       | `feature/m3-catalog`                                  |
| Pull request | https://github.com/shaighub/quick-commerce-app/pull/4 |

## What was built

- Public reads: `GET /v1/categories`, `GET /v1/products` (pagination, category and subcategory filters, price range, in-stock, sort), and `GET /v1/products/:slug`. Only active, non-deleted rows are returned, and a product whose category or subcategory is inactive or deleted is hidden.
- Admin CRUD under `requireRole('ADMIN')` for categories, subcategories, and products. Deletes set `deleted_at` (ADR-009). A category with a live subcategory returns `409 CATEGORY_NOT_EMPTY`. A subcategory with a live product returns `409 SUBCATEGORY_NOT_EMPTY`.
- Slugs are generated from the name. Category and subcategory slugs stay fixed after create ([ADR-014](../adr/014-catalog-slugs-and-rupee-filters.md)). Product slug and SKU conflicts return `409 SLUG_TAKEN` or `409 SKU_TAKEN`. Prices and stock are integers. `pricePaise` must be greater than zero.
- Image URLs must be `https` on a host in `IMAGE_HOSTS`. Anything else is `422`, and an unlisted host uses the code `IMAGE_HOST_NOT_ALLOWED`.
- Search runs `websearch_to_tsquery('simple', …)` first and uses `pg_trgm` (`%` after `set_config('pg_trgm.similarity_threshold', '0.3', true)`) only when full-text finds nothing (ADR-007). Name weight A ranks above description weight B. Without `q`, relevance sorts by newest.
- Public catalog responses send `Cache-Control: public, max-age=60, stale-while-revalidate=300` and a strong ETag. `If-None-Match` returns `304`. Admin writes clear the in-process cache.
- `GET /v1/serviceability?pincode=` returns `{ pincode, serviceable, deliveryFeePaise }`. A malformed pincode is `422 VALIDATION`. `refusalForUnserviceablePincode` is the shared check checkout will use for `422 NOT_SERVICEABLE`.
- OpenAPI at `/v1/docs` includes the new paths. Schemas come from `packages/shared`.
- Storefront: home and `/search` with category rail, filters, pagination, empty search, and pincode check; product detail with breadcrumb, rupee price, stock badge, and image alt text. Guests who choose Add to cart go to `/login?next=`. Signed-in shoppers go to the cart route, which is still the Milestone 4 placeholder.
- Admin screens for category, subcategory, and product list, create, edit, and delete, with confirmation dialogs and the shared Zod forms.
- TanStack Query `staleTime` for catalog reads is 60 seconds.

## Verification

Local, PostgreSQL 16.15, on 2026-11-18. GitHub Actions on the pull request is recorded after it finishes.

| Check                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                          | Pass, zero warnings                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Format check                  | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Type-check                    | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Migrate                       | `20261117180000_init` applied on a fresh `quick_commerce` database. No new migration.                                                                                                                                                                                                                                                                                                                                                              |
| Drift                         | `prisma migrate diff` reported no difference                                                                                                                                                                                                                                                                                                                                                                                                       |
| Tests                         | `@qc/shared` 18 passed. `@qc/api` 85 passed. `@qc/web` passed in the coverage run.                                                                                                                                                                                                                                                                                                                                                                 |
| Coverage                      | Shared lines 98.14%, statements 98.16%, branches 96.55%, functions 100%. API lines 93.58%, statements 93.53%, branches 84.18%, functions 97.77%. Web lines 89.18%, statements 89.26%, branches 79.56% (gate 70%), functions 90.24%.                                                                                                                                                                                                                |
| Build                         | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `node scripts/audit-deps.mjs` | Production dependencies clean. The only remaining high advisory is the allowed dev-only picomatch ReDoS.                                                                                                                                                                                                                                                                                                                                           |
| OpenAPI check                 | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Browser                       | Pass. Shop showed seeded categories and Amul Butter at ₹56.00. Search for `buter` returned Amul Butter. Pincode 560001 was serviceable and 110001 was not. Product detail showed the breadcrumb, 500 g, and In stock. Add to cart opened Log in. Admin delete of Dairy & Bread returned "Remove the subcategories in this category first". A new category Browser Test appeared in the admin list. The product list and new-product form rendered. |

## Deviations

- Cart availability after a soft delete, and adding the item after the guest logs in, stay in Milestone 4. This milestone hides the product from public reads, keeps the `cart_items` row (the foreign key is `RESTRICT`), and leaves `order_items.unit_price_paise` unchanged when the product price changes. The integration test checks those rows directly.
- There is no Prisma client extension that hides soft-deleted rows. Admin lists must still return inactive and deleted products. Each repository applies `deleted_at` itself. ADR-009 already described the extension as later work.
- Playwright specs named in the traceability matrix (`admin-catalog`, `search`) are not added. `apps/web/e2e/README.md` still keeps Playwright out of CI. The storefront and admin screens are covered by Testing Library tests, and a browser pass covers the same flows.
- `GET /v1/products/:slug` also returns `sku`, `description`, and `stock` with `stockStatus`. The extra fields let the page render the design without a second request.

## Exit criteria

| ID          | Requirement                                               | Exit criterion                                                                                                        |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| FR-CAT-01   | Browse categories and subcategories                       | Active categories with their active subcategories show on Home in sort order.                                         |
| FR-CAT-02   | Admin adds a category                                     | The new category appears in the admin list and, when active, on the storefront.                                       |
| FR-CAT-03   | Admin updates a category                                  | Name, image, sort order and active changes are saved and reflected on the storefront.                                 |
| FR-CAT-04   | Admin removes a category                                  | A category with subcategories cannot be removed and the reason is shown; an empty one is soft-deleted and disappears. |
| FR-CAT-05   | Admin adds a subcategory under a category                 | The subcategory appears under its category and in storefront filters.                                                 |
| FR-CAT-06   | Admin updates or moves a subcategory                      | Changes are saved; a moved subcategory keeps its products.                                                            |
| FR-CAT-07   | Admin removes a subcategory                               | A subcategory with products cannot be removed; an empty one is soft-deleted.                                          |
| FR-PROD-01  | Paginated product listing                                 | Products load 24 per page with working page controls.                                                                 |
| FR-PROD-02  | Search products by name or description                    | Results match name or description, best matches first, and small typos still match.                                   |
| FR-PROD-03  | Filter by category, subcategory, price range and in-stock | Filters combine (AND), are kept in the URL, and Clear all resets them.                                                |
| FR-PROD-04  | Sort by relevance, price and newest                       | Each sort option reorders the results correctly.                                                                      |
| FR-PROD-05  | Product detail page                                       | Shows name, image, unit, price in rupees, stock status and breadcrumb; unavailable products show a 404 page.          |
| FR-PROD-06  | Admin creates a product                                   | A valid product is saved and appears on the storefront when active.                                                   |
| FR-PROD-07  | Admin updates a product, including price and stock        | Edits are saved; past orders keep the price that was paid.                                                            |
| FR-PROD-08  | Admin deletes a product (soft delete)                     | The product disappears from the storefront but stays in order history.                                                |
| FR-PROD-09  | Admin product list with status and low-stock filters      | Admins can find any product, including inactive, deleted and low-stock ones.                                          |
| NFR-PERF-03 | HTTP caching for catalog reads                            | Repeat catalog views within a minute are served from cache or with a 304.                                             |
| NFR-SEC-07  | Image URLs restricted to allowlisted hosts                | Only https images from configured hosts can be saved or displayed.                                                    |
