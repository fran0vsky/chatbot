---
phase: 42-custom-dino-creator
plan: "03"
subsystem: backend
tags: [custom-dinos, resolver, group-chat, dino-picker, security, review-fixes]
dependency_graph:
  requires: [42-01, 42-02]
  provides:
    - async resolveDino(id, userId, customDinoService) — covers built-in and custom: prefix ids
    - customDinoToDino(custom) — maps CustomDino to Dino agent-loop shape
    - Single-chat custom dino resolution (AgentsService.streamAgent)
    - Group-chat custom dino roster resolution (GroupAgentsService.resolveRoster)
    - GET /api/dinos?userId= merged endpoint (built-ins + custom dino summaries)
    - DinoSummary.avatarUrl optional field
    - 42-REVIEW CR-02 + WR-01 + WR-03 + WR-04 fixes
  affects:
    - apps/backend (AgentsModule — AgentsService, GroupAgentsService, DinosController)
    - libs/shared-types (Dino, DinoSummary)
tech_stack:
  added:
    - dino-resolver.ts (pure async module, no framework dep)
    - listSummaries(userId) on CustomDinoService
    - validateAvatarUrl() private guard on CustomDinoService
  patterns:
    - async resolver with custom: prefix branching (D-01/D-02)
    - no silent built-in fallback for unknown custom id → undefined (T-42-03-04)
    - tool gating preserved: resolveActiveTools intersects persisted toolNames with live catalogue (T-42-03-01)
    - cross-user data scoping: getById scoped by userId (T-42-03-02)
    - systemPrompt never leaves server: listSummaries uses toCustomDinoSummary allowlist (T-42-03-03)
    - http(s)-only avatarUrl validation prevents stored-XSS via javascript: (T-42-03-05)
key_files:
  created:
    - apps/backend/src/app/agents/dino-resolver.ts
    - apps/backend/src/app/agents/dino-resolver.spec.ts
  modified:
    - libs/shared-types/src/lib/dino.types.ts
    - apps/backend/src/app/agents/dinos/dinos.ts
    - apps/backend/src/app/agents/agents.service.ts
    - apps/backend/src/app/agents/group-agents.service.ts
    - apps/backend/src/app/agents/dinos.controller.ts
    - apps/backend/src/app/agents/custom-dinos.service.ts
    - apps/backend/src/app/agents/custom-dinos.service.spec.ts
    - apps/backend/src/app/database/schema.ts
decisions:
  - "resolveDino returns undefined for unknown custom id — no silent fallback to Rexford (D-01, T-42-03-04)"
  - "customDinoToDino sets imageGen:false — custom dinos are not image-gen in this phase (D-02)"
  - "resolveRoster converted to async; isImageGenDino removed; dino.imageGen read from resolved roster Dino (D-04)"
  - "listSummaries() added to CustomDinoService to keep DinosController thin (D-05)"
  - "HttpException re-throw in catch blocks prevents validation 400s from being swallowed (WR-01)"
metrics:
  duration: "~35 min"
  completed: "2026-06-19"
  tasks_completed: 7
  files_changed: 9
---

# Phase 42 Plan 03: Resolution + Merge Layer Summary

**One-liner:** Async `resolveDino` resolver wired through single-chat and group-engine loops + merged `GET /api/dinos?userId=` endpoint + `DinoSummary.avatarUrl` + four `42-REVIEW` findings closed.

## Tasks Completed

| # | Name | Commit | Key files |
|---|------|--------|-----------|
| 1 | DinoSummary.avatarUrl + toDinoSummary allowlist | 565f068 | libs/shared-types/src/lib/dino.types.ts, dinos.ts |
| 2 | dino-resolver.ts — async resolveDino + customDinoToDino | b25c95b | apps/backend/src/app/agents/dino-resolver.ts |
| 3 | Thread resolveDino through single chat | 4680b7f | apps/backend/src/app/agents/agents.service.ts |
| 4 | Thread resolveDino through the group engine | 43f13c6 | apps/backend/src/app/agents/group-agents.service.ts |
| 5 | Merge custom dinos into GET /api/dinos | e697e7d | apps/backend/src/app/agents/dinos.controller.ts, custom-dinos.service.ts |
| 6 | Close 42-REVIEW backend findings (CR-02, WR-01, WR-03, WR-04) | be7238d | apps/backend/src/app/agents/custom-dinos.service.ts, schema.ts |
| 7 | Tests — resolver + merged endpoint + review fixes | 723f105 | dino-resolver.spec.ts, custom-dinos.service.spec.ts |

## What Was Built

### dino-resolver.ts
- `customDinoToDino(custom: CustomDino): Dino` — maps a persisted custom dino to the Dino agent-loop shape. Sets `specialty='Custom dino'`, `imageGen=false`, carries `systemPrompt`, `toolNames`, `avatarUrl`. Optional fields default to `''`.
- `async resolveDino(id, userId, customDinoService): Promise<Dino | undefined>` — branches on `custom:` prefix: calls `getById` (scoped by userId) → maps or returns `undefined`; else calls synchronous `getDino`. Undefined id → undefined. No silent built-in fallback.

### Shared types (libs/shared-types)
- `Dino` gained `avatarUrl?: string`; `DinoSummary = Omit<Dino,'systemPrompt'>` inherits it.

### dinos.ts
- `toDinoSummary` extended with `avatarUrl: dino.avatarUrl` (built-ins leave it undefined).

### agents.service.ts (single chat — CDINO-02)
- `CustomDinoService` injected into `AgentsService` constructor.
- `getDino(dinoId)` replaced with `await resolveDino(dinoId, userId, this.customDinoService)`.
- `resolveActiveTools` tool-gating preserved; imageGen, memory, fallback logic untouched.

### group-agents.service.ts (group chat — CDINO-04)
- `CustomDinoService` injected into `GroupAgentsService` constructor.
- `resolveRoster` converted to async: `await resolveDino` per id, drops unresolved ids, dedupes, caps to `MAX_GROUP_DINOS`.
- `isImageGenDino` helper removed; `dino.imageGen === true` read from the already-resolved roster Dino at the call site (avoids a second lookup and works for custom dinos).
- `userId` threaded from `streamGroup` into `resolveRoster`.

### dinos.controller.ts (CDINO-01 server half)
- `CustomDinoService` injected.
- `list(@Query('userId') userId?: string): Promise<DinoSummary[]>` — returns built-ins; when `userId` present, appends user's custom dino summaries via `customDinoService.listSummaries(userId)`. `systemPrompt` never included.

### custom-dinos.service.ts (42-REVIEW fixes)
- **CR-02:** `update()` rejects empty patch with `BadRequestException('update request must include at least one field')` before any DB contact.
- **WR-01:** Both `create()` and `update()` catch blocks `if (err instanceof HttpException) throw err` before logging + returning null — validation 400s now surface correctly.
- **WR-03:** `validateAvatarUrl(url)` private helper requires absolute `http:`/`https:` URL via `new URL()`; `javascript:`/`data:` and malformed strings throw `BadRequestException`. Called from `create()` when `avatarUrl` provided, and from `update()` when `req.avatarUrl !== undefined && not empty`.
- **listSummaries(userId)** — new method returning projected custom dino summaries; used by DinosController.

### schema.ts (42-REVIEW fix)
- **WR-04:** `customDinos.updatedAt` gains `.$onUpdate(() => new Date())` — timestamp now updates automatically via Drizzle, not just from the manual `updatedAt: new Date()` in the service.

## Verification

- `npx nx lint @org/backend` — PASSED
- `npx nx build @org/backend` — PASSED (webpack compiled successfully)
- `npx nx test @org/backend` — PASSED (17 files, 199 tests; up from 182 in Plan 02)

## Deviations from Plan

None — plan executed exactly as written. All design decisions D-01 through D-07 implemented as specified.

## Known Stubs

None — the resolver layer is fully implemented. End-to-end behavioral verification (chatting with a custom dino, joining a group chat) is deferred to Plan 04 UAT, as explicitly scoped in the plan.

## Threat Surface Scan

All mitigations from the plan's `<threat_model>` are implemented:

- T-42-03-01 (privilege escalation via toolset): `customDinoToDino` carries only persisted toolNames; `resolveActiveTools` re-intersects with live catalogue — client cannot widen. MITIGATED.
- T-42-03-02 (cross-user data access): `getById`/`list` scoped by userId; unknown custom id → undefined, not another user's dino. MITIGATED.
- T-42-03-03 (system-prompt disclosure): `listSummaries` projects via `toCustomDinoSummary` allowlist — systemPrompt never serialized. MITIGATED.
- T-42-03-04 (default-dino impersonation): missing custom dino → undefined, not a silent fallback to Rexford. MITIGATED.
- T-42-03-05 (stored XSS via avatarUrl): `validateAvatarUrl` rejects non-http(s) URLs. MITIGATED.

## Self-Check: PASSED

Files exist:
- apps/backend/src/app/agents/dino-resolver.ts — FOUND
- apps/backend/src/app/agents/dino-resolver.spec.ts — FOUND
- libs/shared-types/src/lib/dino.types.ts — FOUND (modified)
- apps/backend/src/app/agents/dinos/dinos.ts — FOUND (modified)
- apps/backend/src/app/agents/agents.service.ts — FOUND (modified)
- apps/backend/src/app/agents/group-agents.service.ts — FOUND (modified)
- apps/backend/src/app/agents/dinos.controller.ts — FOUND (modified)
- apps/backend/src/app/agents/custom-dinos.service.ts — FOUND (modified)
- apps/backend/src/app/database/schema.ts — FOUND (modified)

Commits exist: 565f068, b25c95b, 4680b7f, 43f13c6, e697e7d, be7238d, 723f105 — all verified in git log.
