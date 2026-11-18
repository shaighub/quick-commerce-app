# ADR-013: Check token_version on every authenticated request

- Status: Accepted
- Date: 2026-11-18

## Context

ADR-003 checks `users.token_version` on admin routes and checkout, with a 30 second cache. Milestone 2 also exposes `GET /v1/auth/me` and logout-all. A stale access token must not keep reading the profile, or calling later customer routes, for the rest of its 15 minute life.

## Decision

`requireAuth` compares the JWT `ver` claim with `users.token_version` on every authenticated request. The comparison is cached for 30 seconds. The process that increments `token_version` (logout-all today; deactivation and role changes later) drops its cache entry, so the next request in that process sees the new version immediately. Other processes see it within 30 seconds, which is the bound in FR-AUTH-07.

Signup still cannot set `role`. The column default and the insert are both `CUSTOMER`.

## Consequences

Logout-all invalidates the current access token on `/v1/auth/me` as well as on future admin and checkout routes. The extra read is one indexed user lookup per user per 30 seconds.
