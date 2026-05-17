# Testing

**Analysis Date:** 2026-05-17

## Setup

**Test runners present:**
| Project | Runner | Config |
|---------|--------|--------|
| `apps/frontend` | Vitest (via `@angular/build:unit-test`) | `apps/frontend/tsconfig.spec.json` |
| `apps/backend-e2e` | Jest + SWC | `apps/backend-e2e/jest.config.cts` |
| `apps/frontend-e2e` | Playwright | `apps/frontend-e2e/playwright.config.ts` |

**Run commands (always via Nx):**
```bash
npx nx run frontend:test
npx nx run backend-e2e:e2e
npx nx run frontend-e2e:e2e
npx nx run-many --target=test
npx nx run frontend:test --watch
```

## Test Types

### Unit Tests — Frontend (Vitest + Angular TestBed)
- Co-located `*.spec.ts` files alongside source
- `TestBed.configureTestingModule` + `TestBed.createComponent` pattern
- Vitest globals via `tsconfig.spec.json` `types: ["vitest/globals"]`
- Executor: `@angular/build:unit-test`

### Integration / API E2E — Backend (Jest + SWC + Axios)
- Lives in `apps/backend-e2e/src/`
- `@swc/jest` transform for fast TS compilation
- Global setup waits for port 3000 (`waitForPortOpen` from `@nx/node/utils`)
- `test-setup.ts` sets `axios.defaults.baseURL = http://localhost:3000`
- Coverage output: `test-output/jest/coverage`

### E2E — Frontend (Playwright)
- Lives in `apps/frontend-e2e/src/`
- Browsers: Chromium, Firefox, WebKit
- Auto-starts frontend dev server before tests; `reuseExistingServer: true`
- Tracing: `on-first-retry`

## Coverage
- No coverage thresholds enforced anywhere
- Backend E2E coverage output: `test-output/jest/coverage`

## Test Locations
```
apps/frontend/src/app/app.spec.ts
apps/backend-e2e/src/backend/backend.spec.ts
apps/backend-e2e/src/support/global-setup.ts
apps/backend-e2e/src/support/test-setup.ts
apps/frontend-e2e/src/example.spec.ts
```

## Gaps / Missing Tests
- **No backend unit tests** — `apps/backend/src/` has zero `*.spec.ts` files; `@nestjs/testing` is installed but unused
- **No backend test Nx target** — `nx run backend:test` will fail; must be added to `apps/backend/package.json`
- **AgentsService untested** — complex LangGraph state machine in `apps/backend/src/app/agents/agents.service.ts` has no test coverage
- **No coverage enforcement** — no minimum thresholds on any project
- **Frontend coverage sparse** — only `App` root component has a spec; no tests for `NxWelcome` or future components
