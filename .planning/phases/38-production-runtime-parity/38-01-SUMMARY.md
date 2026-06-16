---
phase: 38-production-runtime-parity
plan: 01
subsystem: api
tags: [nestjs, express, body-parser, body-limit, image-upload]

# Dependency graph
requires:
  - phase: 36-https
    provides: Caddy reverse proxy (no built-in small body cap; backend limit is the real ceiling)
  - phase: 25-multimodal
    provides: base64 image data URL in chat request body (the payload that exceeds 100 kb)
  - phase: 32-context-ring
    provides: N=2 image cap + 20-turn history cap (bounds the rest of the body size)
provides:
  - NestExpressApplication body-parser limit raised to BODY_LIMIT env var (default 10mb) for json + urlencoded
  - BODY_LIMIT env var documented in .env.example
affects: [phase-39-smoke-checks, phase-44-uat-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NestExpressApplication.useBodyParser(type, { limit }) is the Nest-idiomatic way to override Express body limits"
    - "BODY_LIMIT env var (body-parser size string) read via process.env['BODY_LIMIT'] || '10mb'"

key-files:
  created: []
  modified:
    - apps/backend/src/main.ts
    - .env.example

key-decisions:
  - "D-01: Use app.useBodyParser('json') + app.useBodyParser('urlencoded') on NestExpressApplication — keeps existing parsers, no double-registration"
  - "D-02: Default 10mb — comfortably covers 1.5 MB base64 JPEG + 20-turn history with 2 retained images"
  - "D-03: Both json AND urlencoded receive the limit so no body shape silently falls back to 100 kb"

patterns-established:
  - "Body-limit pattern: const bodyLimit = process.env['BODY_LIMIT'] || '10mb'; then app.useBodyParser(..., { limit: bodyLimit })"

requirements-completed: [PROD-02]

# Metrics
duration: 10min
completed: 2026-06-16
---

# Phase 38 Plan 01: Production Runtime Parity — Body Limit Summary

**Express body-parser limit raised to env-tunable 10 MB (BODY_LIMIT) via app.useBodyParser on json + urlencoded, unblocking image-attach chat requests rejected by the 100 kb Express default**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-16T20:50:00Z
- **Completed:** 2026-06-16T21:00:00Z
- **Tasks:** 2 of 3 auto-executed (Task 3 is manual smoke test — human required)
- **Files modified:** 2

## Accomplishments

- `.env.example` documents `BODY_LIMIT=10mb` in the Server section with a comment explaining the cap and its image-attachment context
- `apps/backend/src/main.ts` reads `process.env['BODY_LIMIT'] || '10mb'` and applies it to both `app.useBodyParser('json')` and `app.useBodyParser('urlencoded', { extended: true })` before `app.listen` — all existing bootstrap calls (enableCors, setGlobalPrefix, useStaticAssets) are unchanged
- Backend build passes (webpack compiled successfully); no lint errors introduced (3 pre-existing lint issues in other files unchanged)

## Task Commits

1. **Task 1: Document BODY_LIMIT in .env.example** - `a360f87` (chore)
2. **Task 2: Raise body-parser limit in main.ts** - `05cd079` (feat)
3. **Task 3: Local smoke test** - PENDING HUMAN (manual task, autonomous=false)

## Files Created/Modified

- `apps/backend/src/main.ts` — Added bodyLimit const + two useBodyParser calls for json and urlencoded
- `.env.example` — Added BODY_LIMIT=10mb with explanatory comment in Server section

## Decisions Made

- Used `app.useBodyParser` (NestExpressApplication API) rather than manually importing express middleware — idiomatic and keeps existing parser registration intact (D-01)
- Default of `'10mb'` chosen to comfortably exceed ~1.5 MB base64 JPEG + 20-turn history while bounding abuse on a single-instance VM (D-02)
- Both parsers (json + urlencoded) receive the same limit to prevent any body shape from silently falling back to 100 kb (D-03)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing lint error in `group-agents.service.ts` (unused `TurnBudget` type, line 20) and 2 warnings in other files — confirmed pre-existing by stashing my changes and re-running lint on the baseline. Not introduced by this plan.

## User Setup Required

**Task 3 requires manual smoke test.** With `OPENROUTER_API_KEY` set:

1. `npx nx serve @org/backend`
2. POST to `/api/agents/chat` a body with a real ~300–800 KB base64 `imageDataUrl` for a vision dino (e.g. `iris`) — confirm HTTP 200 + SSE streaming (not 413)
3. Send a normal small text message — confirm SSE streaming unchanged

Or use the frontend image-attach flow: attach a downscaled photo, send it to Iris, verify it streams a response.

## Next Phase Readiness

- Backend now accepts image-bearing chat bodies up to 10 MB (env-tunable via `BODY_LIMIT`)
- PROD-02 satisfied at code level; blocked only by Task 3 human smoke verification
- Phase 39 (Deploy Truth & Smoke Checks) and Phase 44 (Pre-Launch UAT) can treat image-attach as no longer blocked by body-limit constraints

---
*Phase: 38-production-runtime-parity*
*Completed: 2026-06-16*
