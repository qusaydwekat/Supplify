# Supplify test suite

Tests run locally only (not in CI or Vercel deploy). Production builds use `next build`, which excludes this folder via `tsconfig.json`.

## Commands

```bash
npm run test              # Vitest watch mode
npm run test:coverage     # Unit + integration with HTML report in coverage/
npm run test:ui           # Vitest browser UI
npm run test:e2e          # Playwright (set E2E_ENABLED=1)
npm run test:all          # Coverage + E2E
```

## E2E setup

1. Copy env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)
2. Seed test users: `npx tsx src/tests/e2e/helpers/seed.ts`
3. Run: `E2E_ENABLED=1 npm run test:e2e`
   4

## Structure

- `unit/` — pure logic, Zod schemas, presentational components
- `integration/` — server actions with mocked Supabase
- `e2e/` — Playwright flows (opt-in via `E2E_ENABLED`)

## Coverage report

After `npm run test:coverage`, open `coverage/index.html`.
