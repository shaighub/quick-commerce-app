# ADR-017: Small Sentry envelope client

- Status: Accepted
- Date: 2026-11-19
- Review refs: NFR-OPS-02

## Context

NFR-OPS-02 asks for API and web errors to be tracked with the same request id when `SENTRY_DSN` is set. The official Sentry browser SDK is large enough to move the storefront JavaScript bundle, and Lighthouse performance has a 90 target.

## Decision

The API and the web app share a tiny envelope sender. It POSTs only when the DSN is an `https` URL with a public key and a numeric project id. The body is the exception name, the message, and the request id. Redirects are refused. An empty DSN does nothing, and no real DSN is committed.

## Consequences

Unhandled API 500s and browser failures are reported without adding the Sentry SDK to the storefront. Operators paste a DSN into the platform env when they want a project. The client does not send request bodies.
