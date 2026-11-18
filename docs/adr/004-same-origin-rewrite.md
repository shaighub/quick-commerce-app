# ADR-004: Same-origin API through a Vercel rewrite

- Status: Accepted
- Date: 2026-11-17
- Review refs: R01

## Context

The web app and the API will live on different hosts (`*.vercel.app` and `*.onrender.com`). Both suffixes are public suffixes, so a `SameSite=Strict` cookie set by the API would not be sent on the browser's calls to the API.

## Decision

The browser calls `/v1` on the web origin only. Vercel rewrites `/v1/:path*` to the Render API. CORS is deny-all. The refresh cookie stays `SameSite=Strict`.

Locally, the Vite dev server proxies `/v1` to the API so the same relative URLs work. `apps/web/vercel.json` currently targets `https://quick-commerce-api.onrender.com`. Replace that host when the Render service is created.

Refresh and logout also require `X-Requested-With`, implemented with those routes.

## Consequences

There is no cross-origin API for the browser. Server-side jobs call the Render URL directly and authenticate with `X-Jobs-Token`.
