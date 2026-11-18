# Milestone 2: Auth

**Status:** Done.

Approved at Checkpoint 3 and merged on 2026-11-18.

|              |                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Branch       | `feature/m2-auth`                                                                                     |
| Started      | 2026-11-18, 08:19 IST. The activity log says the Milestone 2 cloud agent was launched on this branch. |
| Agent        | https://cursor.com/agents/bc-67deb92f-d338-540b-93d5-52fde5cbdae5                                     |
| Pull request | https://github.com/shaighub/quick-commerce-app/pull/3                                                 |
| Merge        | Squash-merged into `main` on 2026-11-18, merge commit `ceccc31`                                       |

The exit criteria below were accepted when [PR #3](https://github.com/shaighub/quick-commerce-app/pull/3) merged. This page does not re-measure that pull request.

## Planned scope

From the approved design. The design does not number this milestone. The IDs are the AUTH module and the security requirements the matrix traces to sign-up, log-in, refresh, and logout.

- AUTH endpoints in [section 2](../design.md#2-api-endpoints-v1): `POST /v1/auth/signup`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `POST /v1/auth/logout-all`, and `GET /v1/auth/me`.
- [Refresh token storage and revocation](../design.md#refresh-token-storage-and-revocation).
- [Login and refresh-token rotation](../design.md#login-and-refresh-token-rotation).
- Screens [S03 Sign up](../design.md#3-screens) and [S04 Log in](../design.md#3-screens), plus the logout calls on S01 and A01.
- [ADR-003](../adr/003-jwt-refresh-cookie.md), JWT access token and rotating refresh cookie.
- [ADR-004](../adr/004-same-origin-rewrite.md), because NFR-SEC-06 keeps the refresh cookie on the web origin.

Milestone 1 already added the rate limiter, helmet, deny-all CORS, the `/v1` rewrite file, and the bcrypt password schema in `packages/shared/src/password.ts`. Those pieces sit under NFR-SEC-01, NFR-SEC-02, NFR-SEC-04, and NFR-SEC-06. The acceptance criteria below are still open.

The exit criterion is the acceptance criterion in the [traceability matrix](../design.md#4-requirement-traceability-matrix). No Checkpoint 4 result is recorded. [NFR-SEC-03](m5-hardening.md) (server-side validation and parameterized queries) also applies to the endpoints in this milestone. Its exit criterion is tracked once, on Milestone 5.

## Exit criteria

| ID         | Requirement                                                           | Exit criterion                                                                                                                                        |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AUTH-01 | Sign up as a customer with name, email and password                   | A new account is created with role CUSTOMER, the user is signed in and returned to the page they came from; a duplicate email shows 'already exists'. |
| FR-AUTH-02 | Log in with email and password                                        | Valid credentials return an access token and set a Secure, HttpOnly, SameSite=Strict refresh cookie; wrong credentials show one generic message.      |
| FR-AUTH-03 | Log out                                                               | After logout, refresh fails with 401 and protected screens send the user to Log in.                                                                   |
| FR-AUTH-04 | JWT access tokens with silent refresh and rotation                    | Access tokens last 15 minutes and refresh tokens 7 days; a reused refresh token revokes the whole family.                                             |
| FR-AUTH-05 | Role-based access for guest, customer and admin                       | Guests get 401 and are sent to Log in; customers get 403 on admin routes; admin navigation is hidden from non-admins.                                 |
| FR-AUTH-06 | Admin account is created by a seed script, not sign-up                | npm run db:seed creates the admin once; no API path can create or promote an admin.                                                                   |
| FR-AUTH-07 | Instant session revocation (token_version) and log out of all devices | After log out of all devices, deactivation or a role change, old tokens stop working on admin routes and checkout within 30 seconds.                  |
| FR-AUTH-08 | Per-account login lockout                                             | Five consecutive failures lock the account for 15 minutes with a clear message, without revealing whether the email exists.                           |
| NFR-SEC-01 | Passwords hashed with bcrypt and a password policy                    | Only bcrypt hashes are stored and passwords need 8+ characters with a letter and a number.                                                            |
| NFR-SEC-02 | Rate limiting on auth and public endpoints                            | Auth allows 10 requests per minute per IP; other public endpoints 100.                                                                                |
| NFR-SEC-04 | Security headers, CORS, secure cookies and CSRF defence               | Responses carry security headers; the refresh cookie is HttpOnly, Secure and SameSite=Strict, and refresh checks Origin.                              |
| NFR-SEC-06 | Same-origin API through a Vercel rewrite (ADR-004)                    | The browser talks only to the web origin; the refresh cookie works with SameSite=Strict and CORS stays deny-all.                                      |
