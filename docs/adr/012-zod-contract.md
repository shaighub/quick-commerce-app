# ADR-012: Zod in packages/shared is the contract source

- Status: Accepted
- Date: 2026-11-17
- Review refs: R20

## Context

Separate OpenAPI, API validators, and form validators drift apart and disagree about what a valid request is.

## Decision

Zod schemas in `packages/shared` are the single contract. The API parses requests with them. Web forms will use the same schemas. `apps/api/scripts/generate-openapi.ts` turns the implemented schemas into `apps/api/openapi/openapi.yaml`. CI runs the generator with `--check` and fails if the file is stale.

Milestone 1 generates the health response and the error envelope. Each later endpoint adds its schema and a path in that generator.

## Consequences

A contract change is a schema change plus a regenerated spec in the same pull request. Swagger UI serves the committed file at `/v1/docs`, and that route is off in production unless `DOCS_ENABLED=true`.
