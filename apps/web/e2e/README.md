# End-to-end tests

Playwright covers the flows named in the traceability matrix, plus axe on every screen and a keyboard pass from search to confirmation. GitHub Actions runs this suite on every pull request.

The config migrates and seeds `quick_commerce`, then starts the API and the Vite dev server. Stop any process already bound to ports 4000 and 5173. `ADMIN_PASSWORD` must be at least 8 characters with a letter and a number. The default used when it is unset is `Adminpass1`.

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Run the command from the repository root. Traces, screenshots, and videos are kept for failures under `apps/web/test-results`.

Auth routes are given a high rate limit for this process so parallel logins stay deterministic. The 10-per-minute limit is still covered by the API integration tests.
