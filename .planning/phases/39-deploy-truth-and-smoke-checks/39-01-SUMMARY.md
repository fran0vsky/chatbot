---
phase: 39-deploy-truth-and-smoke-checks
plan: "01"
subsystem: backend
tags: [health-check, readiness-probe, ci, secrets-safety]
dependency_graph:
  requires: []
  provides: [GET /api/health readiness endpoint]
  affects: [apps/backend/src/app/app.module.ts]
tech_stack:
  added: []
  patterns: [NestJS controller with env-derived boolean, vi.stubEnv for secret-safety testing]
key_files:
  created:
    - apps/backend/src/app/health/health.controller.ts
    - apps/backend/src/app/health/health.controller.spec.ts
  modified:
    - apps/backend/src/app/app.module.ts
decisions:
  - "D-01: Single @Get() on @Controller('health') — resolves to /api/health via global 'api' prefix"
  - "D-02: Response shape { status: 'ok', tools: { web_search: boolean } } — minimal stable contract for CI jq assertions"
  - "D-03: web_search = typeof key === 'string' && key.length > 0 — mirrors exactly what web-search.tool.ts checks"
  - "D-04: No secret leaked — only boolean emitted; unit test asserts stubbed key value absent from JSON.stringify(result)"
  - "D-05: No injected services, no DB query, no model call — synchronous handler, cheap for every CI deploy probe"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-16"
  tasks_completed: 3
  files_changed: 3
---

# Phase 39 Plan 01: Health Readiness Endpoint Summary

Unauthenticated GET /api/health endpoint reporting process liveness and web_search tool configuration as a boolean, enabling CI smoke stage (plan 39-02) to assert TAVILY_API_KEY landed on the live container without leaking the secret.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Add HealthController with GET /api/health | 6d55368 | Done |
| 2 | Register HealthController in AppModule | 6d55368 | Done |
| 3 | Unit-test endpoint shape and secret-safety | 6d55368 | Done |

## What Was Built

`HealthController` at `apps/backend/src/app/health/health.controller.ts`:
- Single `@Get()` handler reading `process.env['TAVILY_API_KEY']`
- Returns `{ status: 'ok', tools: { web_search: boolean } }` — status is a constant 'ok' (process liveness); web_search is the readiness boolean
- Registered in `AppModule` alongside `AppController`
- Reachable at `/api/health` due to `app.setGlobalPrefix('api')` in main.ts

`health.controller.spec.ts` covers:
- Key set → `web_search: true`, `status: 'ok'`
- Key set → serialized response does NOT contain the stubbed key value (no secret leak)
- Key empty string → `web_search: false`
- Key unset (undefined) → `web_search: false`

All 140 backend tests pass. Build passes. Lint failures are pre-existing in unrelated files (group-agents.service.ts `TurnBudget` unused var, memory-creator.service.ts non-null assertion) — out of scope.

## Verification Results

- `npx nx test @org/backend`: 140 passed (13 test files) — including 4 new HealthController tests
- `npx nx build @org/backend`: webpack compiled successfully
- `npx nx lint @org/backend`: 1 pre-existing error in group-agents.service.ts (TurnBudget unused var), 2 pre-existing warnings in memory-creator.service.ts — none in new files

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: reconnaissance | apps/backend/src/app/health/health.controller.ts | New unauthenticated endpoint — accepted per T-39-01-02 (reveals only web_search on/off, no secrets, no topology) |

T-39-01-01 (info disclosure) mitigated: only boolean emitted, unit test asserts key value absent from serialized response.
T-39-01-02 (reconnaissance) accepted per plan threat model.

## Self-Check: PASSED

- [x] `apps/backend/src/app/health/health.controller.ts` exists
- [x] `apps/backend/src/app/health/health.controller.spec.ts` exists
- [x] `apps/backend/src/app/app.module.ts` modified
- [x] Commit 6d55368 exists
- [x] 140 tests pass
- [x] Build passes
