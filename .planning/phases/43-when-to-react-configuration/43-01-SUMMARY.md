---
phase: 43-when-to-react-configuration
plan: "01"
subsystem: backend/agents
tags: [reactivity, group-engine, persistence, api]
dependency_graph:
  requires: [Phase 41 group engine v3]
  provides: [ReactivityService, ReactivityController, /api/dino-reactivity, buildDecisionPrompt level nudge, never-clamp in streamGroup]
  affects: [GroupAgentsService.streamGroup, buildDecisionPrompt, group chat behavior]
tech_stack:
  added: [dinoReactivity drizzle pgTable, ReactivityService, ReactivityController]
  patterns: [null-db graceful degradation mirror MemoryService, onConflictDoUpdate upsert, level nudge in decision prompt]
key_files:
  created:
    - libs/shared-types/src/lib/dino.types.ts (ReactionLevel, REACTION_LEVELS, DinoReactivityMap, SetReactivityRequest, ReactivityResponse added)
    - apps/backend/src/app/agents/reactivity.service.ts
    - apps/backend/src/app/agents/reactivity.controller.ts
    - apps/backend/src/app/agents/reactivity.service.spec.ts
  modified:
    - apps/backend/src/app/database/schema.ts (dinoReactivity table + types)
    - apps/backend/src/app/agents/agents.module.ts (ReactivityController + ReactivityService wired)
    - apps/backend/src/app/agents/group/decision.ts (level nudge in buildDecisionPrompt)
    - apps/backend/src/app/agents/group/decision.spec.ts (nudge + no-op tests)
    - apps/backend/src/app/agents/group-agents.service.ts (ReactivityService injection, levels resolution, never-clamp)
    - apps/backend/src/app/agents/group-agents.service.spec.ts (fakeReactivity stub to fix broken constructor tests)
decisions:
  - "ReactionLevel = 'never'|'rarely'|'normal'|'chatty'; REACTION_LEVELS readonly array is the single source of truth"
  - "'normal' adds no nudge line — default behavior byte-identical to pre-Phase-43 (SC#4)"
  - "'never' is a hard deterministic clamp BEFORE any LLM call; @mentioned dinos bypass the clamp (D-06 exception)"
  - "Level nudge appended AFTER persona lines so persona governs content, level governs frequency (D-06/SC#3)"
  - "ReactivityService degrades gracefully (null-db returns {} / no-ops) — never breaks group chat (T-43-01-03)"
  - "dino_reactivity table must be created on Cloud SQL manually at deploy time (no auto-migration runner)"
metrics:
  duration: "~40 minutes"
  completed: "2026-06-19"
  tasks_completed: 7
  files_changed: 10
---

# Phase 43 Plan 01: When-to-React Persistence + Engine Hook Summary

**One-liner:** Per-dino `ReactionLevel` contract + `dino_reactivity` Drizzle table + `ReactivityService` (get/set, graceful degradation, validation) + REST `GET`/`PUT` endpoints + `buildDecisionPrompt` frequency nudge (rarely/chatty) + deterministic `never`→silent clamp in `streamGroup`.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Reaction-level shared types | 6fa1ca4 | libs/shared-types/src/lib/dino.types.ts |
| 2 | dino_reactivity drizzle table | b25e633 | apps/backend/src/app/database/schema.ts |
| 3 | ReactivityService (get/set, graceful degradation, validation) | fc7ac3c | apps/backend/src/app/agents/reactivity.service.ts |
| 4 | ReactivityController + module wiring | 0329034 | apps/backend/src/app/agents/reactivity.controller.ts, agents.module.ts |
| 5 | Decision-prompt level nudge (normal = no-op) | 77767fb | apps/backend/src/app/agents/group/decision.ts |
| 6 | Engine hook — resolve levels, never-clamp, thread the nudge | 5c7be22 | apps/backend/src/app/agents/group-agents.service.ts |
| 7 | Unit tests — service + nudge + clamp invariants | 72ec57a | reactivity.service.spec.ts, decision.spec.ts, group-agents.service.spec.ts |

## What Was Built

### Shared Types (Task 1)
`ReactionLevel = 'never' | 'rarely' | 'normal' | 'chatty'` union and `REACTION_LEVELS` readonly array added to `dino.types.ts`. Also `DinoReactivityMap = Record<string, ReactionLevel>`, `SetReactivityRequest`, and `ReactivityResponse` — the full API contract shared between backend and frontend (Plan 02).

### Database Table (Task 2)
`dinoReactivity` pgTable with `id` (uuid pk), `userId`, `dinoId`, `level`, `createdAt`, `updatedAt`. A `uniqueIndex('dino_reactivity_user_dino_idx')` on `(userId, dinoId)` enables single-row upserts. `DinoReactivityRow`/`NewDinoReactivityRow` inferred types exported. The table covers built-in and `custom:` ids uniformly with no `customDinos` schema change.

### ReactivityService (Task 3)
`getLevels(userId)` returns a `DinoReactivityMap` of all stored rows for that user (reduces to `Record<dinoId, level>`). `setLevel(userId, dinoId, level)` validates `level ∈ REACTION_LEVELS` (throws `BadRequestException` on bad value) then upserts via `onConflictDoUpdate`. Both methods mirror `MemoryService`: null-db / empty-userId guards return safe values; try/catch logs + returns safe defaults on infra errors.

### REST Endpoints (Task 4)
Thin `ReactivityController` at `/dino-reactivity`:
- `GET /api/dino-reactivity?userId=` → `{ levels: DinoReactivityMap }`
- `PUT /api/dino-reactivity/:dinoId` body `{ userId, level }` → `{ dinoId, level }`

Both registered in `AgentsModule`. `ReactivityService` exported from the module so `GroupAgentsService` can inject it.

### Decision-Prompt Nudge (Task 5)
`buildDecisionPrompt` gains an optional 4th param `level: ReactionLevel = 'normal'`. A `LEVEL_NUDGE` map provides distinct one-line steering for `'rarely'` ("stay quiet") and `'chatty'` ("chime in"). The nudge is appended **after** all persona/rules lines so the dino's persona governs content while the level governs frequency (D-06 / SC#3). `'normal'` adds nothing — output is byte-identical to pre-Phase-43.

### Engine Hook (Task 6)
`GroupAgentsService` now:
1. Injects `ReactivityService` in the constructor.
2. Calls `getLevels(userId ?? '')` once after `resolveRoster` (null-db-safe, returns `{}`).
3. Per-dino: computes `level = levels[dino.id] ?? 'normal'`.
4. If `level === 'never' && !isForcedAnswer` → sets `decision = { action: 'silent' }` **before** image-gen / LLM decision branches — a deterministic clamp that also short-circuits the image-gen path and saves the LLM call.
5. Threads `level` into `decideAction` → `buildDecisionPrompt` for `'rarely'`/`'chatty'` propensity nudges.
6. `@mentioned` dinos (`isForcedAnswer`) bypass the `'never'` clamp (explicit per-message mention beats standing config, D-06).

### Unit Tests (Task 7)
- `reactivity.service.spec.ts`: null-db `{}`, empty-userId `{}`, invalid level throws `BadRequestException`, valid set returns `{ dinoId, level }`, fake-db reduces rows to map correctly.
- `decision.spec.ts` extended: `'normal'` == no-level output; `'rarely'` injects "stay quiet" nudge; `'chatty'` injects "chime in" nudge; `'rarely'` ≠ `'chatty'`; `'never'` adds no text (clamp is engine-side).
- `group-agents.service.spec.ts` updated: added `fakeReactivity()` stub (returns `{}`) and passed it as third constructor arg to fix all existing tests broken by the new `ReactivityService` injection.
- **214/214 backend tests pass.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `and` import in reactivity.service.ts**
- **Found during:** Task 3 lint verification
- **Issue:** Initially imported `{ and, eq }` from drizzle-orm but `and` was not used in the service (only `eq` needed for the `where(eq(dinoReactivity.userId, userId))` clause)
- **Fix:** Removed `and` from the import
- **Files modified:** `apps/backend/src/app/agents/reactivity.service.ts`
- **Commit:** fc7ac3c

**2. [Rule 1 - Bug] Existing group-agents.service.spec.ts broken by new ReactivityService constructor arg**
- **Found during:** Task 7 test run
- **Issue:** Pre-existing spec constructed `GroupAgentsService(agents)` with one arg; after Task 6 added `ReactivityService` as the 3rd constructor parameter, all 10 `streamGroup` tests threw `TypeError: Cannot read properties of undefined (reading 'getLevels')`
- **Fix:** Added `fakeReactivity()` factory returning a no-op stub, and updated the two `new GroupAgentsService(...)` calls in the spec to pass it as the 3rd arg
- **Files modified:** `apps/backend/src/app/agents/group-agents.service.spec.ts`
- **Commit:** 72ec57a

## Deploy Note (Non-Blocking)

The `dino_reactivity` table must be created on Cloud SQL manually at deploy time. This repo has no auto-migration runner. Without the table, `getLevels` degrades to `{}` and every dino defaults to `'normal'` — identical to current behavior.

SQL to apply:
```sql
CREATE TABLE IF NOT EXISTS dino_reactivity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  dino_id text NOT NULL,
  level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dino_reactivity_user_dino_idx ON dino_reactivity (user_id, dino_id);
```

## Known Stubs

None. The settings UI (Plan 02) is out of scope for this plan; the API surface is fully functional.

## Threat Surface Scan

No new threat surfaces beyond those in the plan's `<threat_model>`. All four threats are mitigated:
- T-43-01-02: `level` validated against `REACTION_LEVELS` before DB write or prompt injection.
- T-43-01-03: `getLevels` try/catch returning `{}` prevents reactivity errors from aborting group chat.
- T-43-01-04: `never` short-circuits before the LLM decision call (fewer calls than today).

## Self-Check: PASSED

All 7 task commits verified present in git log (6fa1ca4 → 72ec57a). Key files confirmed created:
- `libs/shared-types/src/lib/dino.types.ts` — ReactionLevel types added
- `apps/backend/src/app/database/schema.ts` — dinoReactivity table added
- `apps/backend/src/app/agents/reactivity.service.ts` — created
- `apps/backend/src/app/agents/reactivity.controller.ts` — created
- `apps/backend/src/app/agents/reactivity.service.spec.ts` — created
- `apps/backend/src/app/agents/group/decision.ts` — level nudge added
- `apps/backend/src/app/agents/group-agents.service.ts` — engine hook added
- 214/214 backend tests pass (verified via `nx test @org/backend`)
