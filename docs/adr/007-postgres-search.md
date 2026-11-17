# ADR-007: Search on PostgreSQL full-text and pg_trgm

- Status: Accepted
- Date: 2026-11-17
- Review refs: R08

## Context

Product search must match names and descriptions, rank name hits higher, and tolerate small typos. A separate search engine is more moving parts than the 10,000-product target needs.

## Decision

`products.search_vector` is a stored generated `tsvector` using the `simple` configuration, weight A on the name and weight B on the description. A GIN index serves full-text search. A `pg_trgm` GIN index on `name` serves typos and prefixes. The similarity threshold is 0.3, set for the search query rather than as a database default.

Search runs full-text first and falls back to trigram only when full-text finds nothing. Page depth is capped at 20 and the reported total at 1,000.

## Consequences

Search stays in PostgreSQL for the MVP. Moving to Meilisearch or OpenSearch is a later decision if the catalog passes about 100,000 SKUs. The generated column and trigram index are raw SQL in the initial migration.
