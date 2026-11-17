# End-to-end tests

Playwright is installed and configured. Specs are added with the milestone that implements each flow (sign-up, search, checkout, admin catalog). They are not part of the milestone 1 CI gate.

Run them later with:

```bash
npm run test:e2e -w @qc/web
```

Install browsers first with `npx playwright install --with-deps chromium` from `apps/web`.
