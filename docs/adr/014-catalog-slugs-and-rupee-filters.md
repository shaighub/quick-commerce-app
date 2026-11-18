# ADR-014: Catalog slugs stay put, and shopper price filters use rupees

- Status: Accepted
- Date: 2026-11-18

## Context

The design generates a slug from a category or subcategory name and does not say what happens when that name later changes. The storefront route stores price filters as `min` and `max`, while `GET /v1/products` takes `minPrice` and `maxPrice` in paise (ADR-005).

## Decision

Category and subcategory slugs are assigned once, when the row is created. Renaming, reordering, or moving a subcategory does not rewrite the slug, so an existing `/search?category=` link keeps working. Product slugs are an input on create and update, and a blank product slug is generated from the name.

The shopper-facing URL stores `min` and `max` as the rupee amounts typed into the filter. The web client converts those amounts to integer paise before it calls the API. The API contract stays in paise.

## Consequences

Two different names that slugify to the same address conflict at create time with `409 NAME_TAKEN`. A later rename cannot take another row's slug, because the slug does not change. Shoppers can read and edit prices in the address bar in rupees; the database and the API never see a float.
