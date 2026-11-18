# Milestone 3: Catalog

**Status:** Not started.

No branch, pull request, or verification result is recorded.

## Planned scope

From the approved design. The IDs are the CAT and PROD modules, plus the non-functional requirements the matrix traces to catalog reads and admin image URLs.

- Public catalog: `GET /v1/categories`, `GET /v1/products`, and `GET /v1/products/:slug` in [section 2](../design.md#2-api-endpoints-v1).
- Admin category, subcategory, and product routes in the same table.
- [Product search indexing](../design.md#product-search-indexing) (full-text plus `pg_trgm`).
- Screens [S01](../design.md#3-screens), [S02](../design.md#3-screens), [A02](../design.md#3-screens), [A03](../design.md#3-screens), and [A04](../design.md#3-screens).
- [ADR-007](../adr/007-postgres-search.md), PostgreSQL full-text search and `pg_trgm`.
- [ADR-009](../adr/009-soft-delete.md), soft delete with RESTRICT foreign keys.
- [ADR-005](../adr/005-money-as-paise.md), because product prices are integer paise.

The schema, seed products, and generated `search_vector` column were created in [Milestone 1](m1-foundation.md). The catalog and search endpoints were left for a later milestone.

The exit criterion is the acceptance criterion in the [traceability matrix](../design.md#4-requirement-traceability-matrix). No Checkpoint 4 result is recorded. [NFR-SEC-03](m5-hardening.md) (server-side validation and parameterized queries) also applies to the endpoints in this milestone. Its exit criterion is tracked once, on Milestone 5.

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
