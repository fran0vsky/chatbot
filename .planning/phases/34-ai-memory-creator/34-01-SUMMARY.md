---
phase: 34-ai-memory-creator
plan: 01
subsystem: api
tags: [openrouter, langchain, nestjs, skills, llm, paid-fallback, shared-types]

# Dependency graph
requires:
  - phase: 33-composer-knowledge-reorg
    provides: "DinoSkill.whenToActivate, MemoryService.updateSkill(id, fields), whenToActivate param on addSkill"
provides:
  - "Creator API contracts in shared-types (SynthesizedSkill, Suggest/Synthesize/SaveCreatedSkill request+response)"
  - "MemoryCreatorService: suggest / synthesize / reconcileAndSave over the dino's own model with paid fallback"
  - "MemoryCreatorController: POST /api/skills/suggest, /api/skills/synthesize, /api/skills/save"
  - "Server-side create-vs-update reconciliation against the user's existing skills (decision never surfaced)"
affects: [34-ai-memory-creator-plan-02-frontend, knowledge-view, skill-manager]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone one-shot LLM calls with module-level FALLBACK_MODEL + isCapabilityError, mirroring agents.service (no shared client)"
    - "invokeWithFallback: try primary dino model, retry once on openai/gpt-4o-mini for 429/capability errors"
    - "Exported pure parse helpers (parseSynthesized/parseReconcile) so LLM-output parsing is unit-testable without network"
    - "Sibling HTTP-only controller alongside SkillsController to keep each controller focused"

key-files:
  created:
    - apps/backend/src/app/memory/memory-creator.service.ts
    - apps/backend/src/app/memory/memory-creator.controller.ts
    - apps/backend/src/app/memory/memory-creator.service.spec.ts
  modified:
    - libs/shared-types/src/lib/dino.types.ts
    - apps/backend/src/app/memory/memory.module.ts

key-decisions:
  - "Reconcile is a separate LLM call given the new item + existing (id/title/instruction); decision is 'new' or an existing id"
  - "Image-gen dinos (imageGen:true) use FALLBACK_MODEL for all creator calls (they don't run the text loop)"
  - "Creator LLM failures degrade (suggest -> [], synthesize -> raw input, reconcile -> create) — never 500 the chat"
  - "SkillView.whenToActivate (string|null) coerced to undefined when mapped onto DinoSkill responses"

patterns-established:
  - "Creator engine reuses agents.service paid-fallback shape without importing/modifying agents.service.ts (D-02 invariant)"
  - "save reuses MemoryService.addSkill/updateSkill — no new persistence endpoint (D-08)"

requirements-completed: [MEMC-01, MEMC-02, MEMC-03]

# Metrics
duration: ~12min
completed: 2026-06-07
---

# Phase 34 Plan 01: AI Memory Creator Backend Engine Summary

**Three server-side creator operations (suggest / synthesize / reconcile-and-save) over the active dino's own OpenRouter model with paid fallback, writing DinoSkills with server-side create-vs-update reconciliation — agents.service.ts untouched.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-07T14:29Z
- **Completed:** 2026-06-07T14:34Z
- **Tasks:** 5
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Six creator request/response contracts added to `@org/shared-types`, importing `ChatHistoryItem` for the suggest payload.
- `MemoryCreatorService` implements `suggest` (≥3 conversation-derived behaviors), `synthesize` (free text/suggestion → 3-field skill JSON), and `reconcileAndSave` (server-side new-vs-update), all over the dino's own model with a single paid-fallback retry on 429/capability errors.
- `MemoryCreatorController` exposes `POST /api/skills/suggest|synthesize|save` with `BadRequestException` validation, HTTP-only, delegating all logic to the service.
- Wired both into `MemoryModule` (sibling to `SkillsController`/`MemoryService`); backend webpack build green.
- 12 unit tests cover the two pure parse helpers (clean/fenced/garbage JSON) and reconcile routing (created on empty, updated on id, created on "new", `ServiceUnavailableException` on null add/update) with a mocked `MemoryService` and stubbed LLM seam — no network.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add creator contracts to shared-types** - `0f1d045` (feat)
2. **Task 2: Create MemoryCreatorService** - `1bd0397` (feat)
3. **Task 3: Create MemoryCreatorController** - `19de790` (feat)
4. **Task 4: Wire MemoryCreator into MemoryModule** - `b0902bf` (feat)
5. **Task 5: Unit tests for parsing + reconcile routing** - `721a5b2` (test)

## Files Created/Modified
- `libs/shared-types/src/lib/dino.types.ts` - Added `SynthesizedSkill`, `SuggestSkillsRequest/Response`, `SynthesizeSkillRequest`, `SaveCreatedSkillRequest/Response`; imports `ChatHistoryItem`.
- `apps/backend/src/app/memory/memory-creator.service.ts` - Creator engine (suggest/synthesize/reconcileAndSave) + exported `parseSynthesized`/`parseReconcile` + `FALLBACK_MODEL`/`isCapabilityError`/`invokeWithFallback`.
- `apps/backend/src/app/memory/memory-creator.controller.ts` - Three POST routes with validation, HTTP-only.
- `apps/backend/src/app/memory/memory.module.ts` - Registered controller + service.
- `apps/backend/src/app/memory/memory-creator.service.spec.ts` - 12 tests (parse helpers + reconcile routing).

## Decisions Made
- Reconcile uses a dedicated LLM call (D-07) returning strict JSON `{decision, mergedTitle?, mergedWhenToActivate?, mergedInstruction?}`; an id that matches an existing skill maps to `updateSkill`, otherwise `addSkill`.
- The merged `whenToActivate` for an update falls back through `decision.mergedWhenToActivate ?? item.whenToActivate ?? match.whenToActivate ?? undefined` to avoid wiping an existing trigger.
- `SkillView.whenToActivate` is `string | null` but `DinoSkill.whenToActivate` is `string | undefined`; responses map `?? undefined` so the shared contract is satisfied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shared-types verify command target mismatch**
- **Found during:** Task 1 (build verification)
- **Issue:** The plan's verify step `npx nx build @org/shared-types` failed with "Cannot find configuration for task @org/shared-types:build" — this TS-solution lib exposes a `typecheck` target (`tsc --build`), not `build`.
- **Fix:** Ran `npx nx typecheck @org/shared-types` instead (the equivalent compile gate for this project type). Exited 0.
- **Files modified:** none (command-only)
- **Verification:** `npx nx typecheck @org/shared-types` green; downstream `npx nx build @org/backend` (which compiles the consuming code) also green.
- **Committed in:** n/a (no code change)

---

**Total deviations:** 1 auto-fixed (1 blocking — verify command only)
**Impact on plan:** No code impact; only swapped a non-existent nx target for the correct one. No scope creep.

## Issues Encountered
- None beyond the verify-target mismatch above.

## User Setup Required
None - no external service configuration required. (`OPENROUTER_API_KEY` is already required by the existing agent loop; the creator reuses it.)

## Next Phase Readiness
- The `/api/skills/suggest|synthesize|save` surface is live and typed via `@org/shared-types`, ready for Plan 02 (frontend creator modal body: thinking state, suggestions, editable 3-field form, save).
- D-02 invariant holds: `git diff` shows no changes to `apps/backend/src/app/agents/agents.service.ts`; the background `userMemories` extraction pipeline is untouched.
- Reconcile/suggest/synthesize quality is best verified live with a real `OPENROUTER_API_KEY` (the unit tests stub the LLM); recommend a manual smoke test once Plan 02 wires the UI.

## Self-Check: PASSED

---
*Phase: 34-ai-memory-creator*
*Completed: 2026-06-07*
