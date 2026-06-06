---
phase: 33-composer-knowledge-reorg
plan: "01"
subsystem: backend/memory
tags: [skills, whenToActivate, data-layer, REST, drizzle]
dependency_graph:
  requires: []
  provides: [DinoSkill.whenToActivate, MemoryService.updateSkill, PUT /api/skills/:id]
  affects: [agents.service.ts buildSystemPrompt, shared-types DinoSkill, SkillsController]
tech_stack:
  added: []
  patterns: [graceful-degradation, drizzle-returning-projection, NestJS-HTTP-only-controller]
key_files:
  created: []
  modified:
    - libs/shared-types/src/lib/dino.types.ts
    - apps/backend/src/app/database/schema.ts
    - apps/backend/src/app/memory/memory.service.ts
    - apps/backend/src/app/memory/memory.service.spec.ts
    - apps/backend/src/app/memory/skills.controller.ts
    - apps/backend/src/app/agents/agents.service.ts
decisions:
  - "whenToActivate coerced to SQL NULL on blank/whitespace input (not empty string)"
  - "updateSkill un-scoped by userId/dinoId — mirrors existing deleteSkill(id) pattern (T-33-01-01 accepted)"
  - "All skills still always injected; trigger is a non-binding rendering hint only (CMP-05)"
metrics:
  duration: ~25 min
  completed: 2026-06-06
---

# Phase 33 Plan 01: Skills Data Layer (whenToActivate + updateSkill) Summary

Introduced end-to-end editable skills data layer: nullable `whenToActivate` trigger field on shared type, Drizzle schema, service read/write paths, a new `PUT /api/skills/:id` update endpoint, and an optional rendering hint in the system prompt.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add whenToActivate to DinoSkill shared type | 12bdda6 | libs/shared-types/src/lib/dino.types.ts |
| 2 | Add nullable when_to_activate column to dino_skills | 8ed12d9 | apps/backend/src/app/database/schema.ts |
| 3 | Thread whenToActivate through getSkills/addSkill + add updateSkill | 11df51a | apps/backend/src/app/memory/memory.service.ts |
| 4 | Add PUT /api/skills/:id endpoint | 62bdd30 | apps/backend/src/app/memory/skills.controller.ts |
| 5 | Keep skills always-apply; render trigger as optional hint | fdfd10d | apps/backend/src/app/agents/agents.service.ts |
| 6 | Unit tests for updateSkill + whenToActivate round-trip | db2d3bb | apps/backend/src/app/memory/memory.service.spec.ts |
| 7 | [MANUAL BLOCKING] Push schema + smoke-test the edit API | — | Requires DATABASE_URL — human task |

## Verification Results

- `npx nx typecheck @org/shared-types` — PASSED
- `npx nx lint @org/backend` — PASSED
- `npx nx build @org/backend` — PASSED
- `node apps/backend/vitest.run.mjs memory.service` — 18/18 tests PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All logic is fully wired. The `whenToActivate` field will be null for existing skills until the DB column is pushed (Task 7, manual).

## Pending Manual Task (Task 7)

With `DATABASE_URL` set in `apps/backend/.env`, run:
```
cd apps/backend && npx drizzle-kit push
```
Then smoke-test:
1. `POST /api/skills` — confirm response includes `whenToActivate: null`
2. `PUT /api/skills/:id` with `{ title, whenToActivate, instruction }` — confirm updated skill returned
3. `GET /api/skills?userId=...&dinoId=...` — confirm `whenToActivate` reflects the update

The column is nullable with no backfill, so the push is non-destructive for existing rows.

## Threat Flags

None — all T-33-01-* threats were mitigated or accepted per the plan's threat model:
- T-33-01-01: IDOR un-scoped update accepted (mirrors existing deleteSkill pattern)
- T-33-01-02: DB errors caught, generic ServiceUnavailableException returned
- T-33-01-03: title/instruction validated; blank trigger coerced to null

## Self-Check: PASSED

Files verified:
- libs/shared-types/src/lib/dino.types.ts — contains `whenToActivate?: string`
- apps/backend/src/app/database/schema.ts — contains `text('when_to_activate')` nullable
- apps/backend/src/app/memory/memory.service.ts — defines `updateSkill(`, `SkillView.whenToActivate`
- apps/backend/src/app/memory/skills.controller.ts — contains `@Put('skills/:id')`
- apps/backend/src/app/agents/agents.service.ts — renders `(use when: ...)` conditionally
- apps/backend/src/app/memory/memory.service.spec.ts — 18 tests all pass
