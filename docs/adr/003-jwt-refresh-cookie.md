# ADR-003: JWT access token and rotating refresh cookie

- Status: Accepted
- Date: 2026-11-17
- Review refs: R02, R03

## Context

Sessions must expire quickly, survive a page reload, and be revocable when an admin is deactivated or logs out everywhere.

## Decision

The access token is a 15-minute JWT (HS256) kept in memory. Claims include `sub`, `role`, `ver` (`users.token_version`), and `jti`. The refresh token is 32 random bytes. Only its SHA-256 hash is stored. The raw value is sent as cookie `qc_rt` (HttpOnly, Secure, SameSite=Strict, Path=/v1/auth) and rotated on each refresh. Reuse of a revoked token revokes the whole family.

`token_version` is checked on admin routes and checkout, with a 30 second cache. Deactivation, role change, and log-out-everywhere bump it. Five failed logins set `locked_until` for 15 minutes.

## Consequences

Auth is implemented in a later milestone. The columns and the cookie contract are already in the schema and the design so that work does not reopen the session model.
