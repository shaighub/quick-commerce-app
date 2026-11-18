# ADR-001: Monorepo with npm workspaces

- Status: Accepted
- Date: 2026-11-17

## Context

The API, the web app, and the request contracts must change together. Separate repositories would let the OpenAPI document, Zod schemas, and form validation drift.

## Decision

One repository with npm workspaces: `apps/api`, `apps/web`, and `packages/shared`. Shared tooling (TypeScript, ESLint, Prettier, CI) lives at the root.

## Consequences

A change to a shared schema is one pull request. The web package can import the same validators the API uses. CI installs once from the root lockfile.
