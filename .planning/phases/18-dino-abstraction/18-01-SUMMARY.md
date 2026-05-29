---
phase: 18-dino-abstraction
plan: 01
subsystem: api
tags: [nestjs, langchain, openrouter, dinos, tool-gating, vitest, nx, patch-package]

# Dependency graph
requires:
  - phase: 09-tool-calling-function-calling
    provides: manual agent loop + tools registry (get_current_time, web_search, fetch_page)
  - phase: 12-spinochat-foundation
    provides: shared-types lib, OpenRouter ChatOpenAI client, free-model roster
provides:
  - Shared Dino / DinoSummary / DinoId contracts in @org/shared-types
  - Backend dino registry (>=4 dinos = model + system prompt + tool subset) — single source of truth
  - Dino-aware agent loop (server-side system-prompt injection + tool gating)
  - GET /api/dinos endpoint returning DinoSummary[] (no system prompts leaked)
  - First runnable backend test target (Vitest) + dino/tool-gating unit tests
affects: [19-dino-picker-explore, 20-dino-mascots, 21-cross-thread-memory, 23-dino-groupchat, 24-arena-leaderboard]

# Tech tracking
tech-stack:
  added: [vitest (backend test runner), patch-package, postinstall-postinstall]
  patterns:
    - "Dino = fixed model + system prompt + tool subset, resolved server-side from a dinoId"
    - "Two-stage tool narrowing: dino.toolNames is the ceiling, client enabledTools may only narrow"
    - "Frontend-safe projection via explicit allowlist (toDinoSummary) so systemPrompt can never leak"

key-files:
  created:
    - libs/shared-types/src/lib/dino.types.ts
    - apps/backend/src/app/agents/dinos/dinos.ts
    - apps/backend/src/app/agents/dinos/index.ts
    - apps/backend/src/app/agents/dinos/dinos.spec.ts
    - apps/backend/src/app/agents/dinos.controller.ts
    - apps/backend/vitest.config.mts
    - apps/backend/vitest.run.mjs
    - patches/nx+22.7.0.patch
  modified:
    - apps/backend/src/app/agents/agents.service.ts
    - apps/backend/src/app/agents/agents.controller.ts
    - apps/backend/src/app/agents/agents.module.ts
    - apps/backend/src/app/agents/agents.service.spec.ts
    - apps/backend/src/app/agents/model-capabilities.spec.ts
    - libs/shared-types/src/lib/chat.types.ts
    - libs/shared-types/src/index.ts

key-decisions:
  - "Executed inline (single plan, single wave) instead of spawning a worktree subagent — no parallel benefit and commits need manual approval in this environment"
  - "Extracted pure resolveActiveTools() helper for testable tool-gating without mocking ChatOpenAI"
  - "toDinoSummary uses an explicit field allowlist (not Omit-by-destructure) so a future Dino field can never leak systemPrompt"
  - "Reconciled the stale model-capabilities.spec.ts to the documented intentional behavior (reasoning disabled) rather than changing production logic"

patterns-established:
  - "Backend Vitest target via nx:run-commands + a drive-case-normalizing launcher (vitest.run.mjs)"
  - "Durable node_modules fixes via patch-package + postinstall hook"

requirements-completed: [DINO-01, DINO-02, DINO-03, DINO-04, DINO-05, DINO-06, PLAT-01]

# Metrics
duration: ~70min
completed: 2026-05-29
---

# Phase 18: Dino Abstraction Summary

**The "dino" is now a first-class backend concept — a registry of 4 dinos (each a fixed model + personality system prompt + allowed tool subset) that the agent loop resolves server-side, injecting the system prompt and gating tools, with the roster exposed via `GET /api/dinos`.**

## Performance

- **Duration:** ~70 min (much of it diagnosing/fixing a broken local Nx + test toolchain)
- **Completed:** 2026-05-29
- **Tasks:** 6 of 7 (Task 7 is a manual live-API smoke test — deferred to user)
- **Files modified/created:** 19

## Accomplishments
- Shared `Dino` / `DinoSummary` / `DinoId` contracts + optional `ChatRequest.dinoId` (backward compatible).
- Backend dino registry with 4 distinct dinos (Rexford, Veloce, Glyphos, Nimbus) — distinct models and tool subsets; `getDino` falls back safely, `toDinoSummary` strips the system prompt.
- Agent loop is dino-aware: injects `SystemMessage(dino.systemPrompt)`, sets `effectiveModel = dino.model`, and gates tools to `dino.toolNames` (client `enabledTools` can only narrow). No-`dinoId` requests behave exactly as before.
- `GET /api/dinos` returns `DinoSummary[]` with no system prompts.
- Stale LangGraph/MemorySaver architecture docs corrected (GSD-CONTEXT.md, CLAUDE.md); `.env.example` already documented `DATABASE_URL`.
- **First runnable backend test suite**: Vitest configured, dino + tool-gating tests added, orphaned specs reconciled — 23 tests green.

## Task Commits

Per project convention (one commit per GSD session, squashed), all tasks were delivered in a **single commit** rather than atomic per-task commits.

## Files Created/Modified
- `libs/shared-types/src/lib/dino.types.ts` — Dino, DinoSummary, DinoId contracts
- `libs/shared-types/src/lib/chat.types.ts` — added optional `dinoId`
- `libs/shared-types/src/index.ts` — re-export dino.types
- `apps/backend/src/app/agents/dinos/dinos.ts` — the 4-dino registry + getDino/toDinoSummary
- `apps/backend/src/app/agents/dinos/index.ts` — barrel
- `apps/backend/src/app/agents/agents.service.ts` — dino resolution, system-prompt injection, `resolveActiveTools` helper, effectiveModel
- `apps/backend/src/app/agents/agents.controller.ts` — forwards `body.dinoId`
- `apps/backend/src/app/agents/dinos.controller.ts` — `GET /api/dinos`
- `apps/backend/src/app/agents/agents.module.ts` — registers `DinosController`
- `apps/backend/src/app/agents/dinos/dinos.spec.ts` — registry invariants (12 tests)
- `apps/backend/src/app/agents/agents.service.spec.ts` — rewritten: `resolveActiveTools` tool-gating (6 tests)
- `apps/backend/src/app/agents/model-capabilities.spec.ts` — reconciled to intentional behavior (5 tests)
- `apps/backend/vitest.config.mts`, `apps/backend/vitest.run.mjs` — backend test target
- `apps/backend/package.json` — `test` target
- `apps/backend/src/app/database/database.module.ts` — removed pre-existing empty-constructor lint error
- `.planning/GSD-CONTEXT.md`, `CLAUDE.md` — architecture docs corrected (PLAT-01)
- `patches/nx+22.7.0.patch`, `package.json` (postinstall), `package-lock.json` — durable Nx Windows fix

## Decisions Made
See `key-decisions` in frontmatter.

## Deviations from Plan

The plan's verification assumed a working local toolchain; in reality the environment was broken and had to be repaired before any verification could run. All deviations were either environment repairs or user-approved scope.

### 1. [Blocking] Local Nx CLI was completely non-functional
- **Issue:** `nx <anything>` crashed with `ERR_UNSUPPORTED_ESM_URL_SCHEME` ("protocol 'c:'"). Root cause: the launching shell supplies a **lowercase-drive cwd** (`c:\...`), so Nx's `isLocalInstall` check fails and it falls into the global→local handoff that does `await import("c:\\...")` without `pathToFileURL`.
- **Fix:** Patched the two `import()` calls in `node_modules/nx/dist/bin/nx.js` to use `pathToFileURL().href`, then made it durable via **patch-package** (`patches/nx+22.7.0.patch` + `postinstall` hook). This fix also makes Nx work under Node 24.
- **Also:** Installed Node 20.18.1 via nvm and `nvm use`d it during diagnosis (your default `node` is now 20.18.1 — see User Setup).

### 2. [Blocking] No backend test runner existed (Task 5 expansion — user approved)
- **Issue:** The backend had no `test` target; `agents.service.spec.ts` was orphaned and referenced a method (`extractChunkReasoning`) that no longer exists. `nx test backend` (the plan's command) could not run.
- **Fix:** Added Vitest (`vitest.config.mts`), a `test` target, and a launcher (`vitest.run.mjs`) that normalizes the lowercase-drive cwd so Vitest's workers bind correctly under Nx on Windows. Rewrote the orphaned spec into real `resolveActiveTools` tests.

### 3. [Blocking] Pre-existing backend lint failure
- **Issue:** `database.module.ts` had an empty `constructor() {}` → `@typescript-eslint/no-empty-function` error, failing `nx lint backend` independent of this phase.
- **Fix:** Removed the useless constructor (no DI in it).

### 4. [Stale test] model-capabilities.spec.ts reconciled
- **Issue:** Once a runner existed, this never-run spec failed 3 assertions expecting `reasoning=true`, contradicting the **intentional** disabling documented in `model-capabilities.ts`.
- **Fix:** Updated the spec to assert the documented current behavior (reasoning disabled). No production logic changed.

### 5. [Tooling] Package manager
- Plan used `pnpm nx ...`; this machine has no pnpm (npm + `package-lock.json`). Used the local `nx` binary. Install requires `--legacy-peer-deps` (pre-existing Storybook 8 vs Angular 21 peer conflict).

### 6. [Allowed] Extracted `resolveActiveTools` helper
- The plan explicitly permitted extracting a pure helper for testability; done.

**Impact on plan:** No scope creep on the dino feature itself — the registry, tool gating, endpoint, and docs match the plan exactly. The extra work was repairing a broken toolchain so the plan could be verified at all.

## Issues Encountered
- Vitest config initially failed to load as `.ts` in this CommonJS workspace (`ERR_REQUIRE_ESM`); switched to `.mts`.
- Vitest workers threw `Cannot read properties of undefined (reading 'config')` only under Nx (lowercase-drive cwd); fixed with the drive-normalizing launcher.

## User Setup Required
- **Node version:** Your active `node` is now **20.18.1** (via nvm) — I switched it while diagnosing. The Nx patch also fixes Node 24, so you can `nvm use` 24 again if you prefer; either works now.
- **Task 7 (manual smoke test):** Not run — needs a live `OPENROUTER_API_KEY`. With it set: `nx serve @org/backend`, then `curl http://localhost:3000/api/dinos` (expect 4 dinos, no `systemPrompt`), and POST the same message with `dinoId:"rexford"` vs `dinoId:"veloce"` to confirm distinct voices + tool gating.
- **Recommended:** add an `.npmrc` with `legacy-peer-deps=true` so `npm install` (and the new `postinstall` patch step) works without the manual flag.

## Next Phase Readiness
- Phase 19 (dino picker / Explore) can now fetch `GET /api/dinos` and send `dinoId`. Backend contract + types are ready and shared.
- Verification: `nx run-many -t lint,test --projects=@org/shared-types,@org/backend` is green; `nx build @org/backend` compiles.
- Note: backend `typecheck` target has 2 **pre-existing** errors (a NestJS `import type` decorator-metadata quirk in `agents.controller.ts` and a LangChain `tool.invoke` union-type quirk) — unrelated to this phase and not part of its lint+test gate; flagged for a future cleanup.

---
*Phase: 18-dino-abstraction*
*Completed: 2026-05-29*
