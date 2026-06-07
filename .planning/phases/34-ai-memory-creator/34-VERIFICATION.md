---
phase: 34-ai-memory-creator
verified: 2026-06-07T15:05:00Z
status: human_needed
score: 7/7 code-verifiable truths verified (SC#1–SC#3 runtime behavior gated on HUMAN-UAT)
overrides_applied: 0
human_verification:
  - test: "Brain click → thinking state → ≥3 conversation-derived suggestions"
    expected: "Animated dino thinking placeholder shows, then ≥3 distinct suggestions render"
    why_human: "SC#1 suggestion quality/count is LLM output, observable only at runtime against a live OPENROUTER_API_KEY"
  - test: "Pick a suggestion AND type free text — both prefill the editable 3-field form"
    expected: "Each path fills name/when-to-activate/instruction; fields remain editable before save"
    why_human: "SC#2 synthesis quality is LLM output; convergent wiring is verified in code but field content is runtime"
  - test: "Save persists + auto-applies; an overlapping item updates instead of duplicating (no toggle)"
    expected: "New item appears in skill-manager and applies next chat; overlap updates existing skill server-side"
    why_human: "SC#3 reconcile decision is an LLM call needing DATABASE_URL + dino_skills table + live model"
  - test: "Manual teach flow + stored skills/memories still work (SC#4)"
    expected: "The 'teach a skill manually' disclosure saves; skill-manager edit/delete unaffected"
    why_human: "End-to-end regression check needs a running app + DB"
---

# Phase 34: AI Memory Creator Verification Report

**Phase Goal:** Clicking the brain opens an AI-assisted creator that proposes what to remember from the current conversation and auto-fills an editable skill/memory form.
**Verified:** 2026-06-07T15:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Mode:** mvp (User Story–adjacent; ROADMAP success criteria SC#1–SC#4 used as the contract)

## Goal Achievement

### Observable Truths (code-verifiable layer)

| #   | Truth (from PLAN must_haves + ROADMAP SC) | Status | Evidence |
| --- | ----------------------------------------- | ------ | -------- |
| 1 | D-01/D-02: creator writes DinoSkills only; background `extractAndStoreMemories` pipeline in agents.service.ts untouched | ✓ VERIFIED | `git diff --stat 0145238~7 0145238 -- agents.service.ts` is empty; creator service imports `MemoryService`/`getDino` only, never agents.service. reconcileAndSave calls `addSkill`/`updateSkill` (skills), never any userMemories method. |
| 2 | D-04: suggest/synthesize/reconcile use the active dino's own model via `getDino(dinoId).model` with paid fallback (`FALLBACK_MODEL = openai/gpt-4o-mini`) | ✓ VERIFIED | service.ts:16,118-120 `buildModel` returns `dino.model`; `invokeWithFallback` (143-155) retries once on FALLBACK_MODEL via `isCapabilityError` (22-34) mirroring agents.service shape. |
| 3 | Image-gen dinos fall back to a text model for all creator calls | ✓ VERIFIED | service.ts:118-120 `buildModel` returns `FALLBACK_MODEL` when `dino.imageGen` truthy; used by all three ops via `this.buildModel(dino)`. |
| 4 | D-07/D-08: reconcileAndSave decides new-vs-update server-side; 'new'→addSkill, `<id>`→updateSkill; decision never surfaced | ✓ VERIFIED | service.ts:226-284 — empty existing ⇒ addSkill/'created'; LLM reconcile returns id ⇒ `updateSkill(match.id, merged)`/'updated', else addSkill/'created'. Response is only `{ skill, action }`, no decision field. 12/12 unit tests cover all four routes incl. db-off→ServiceUnavailableException. |
| 5 | SC#1 (backend half): `POST /api/skills/suggest` parses ≥3 line-delimited suggestions from the conversation | ✓ VERIFIED (code) | service.ts:162-192 prompt asks for ≥3, parses with `replace(/^[-*\d.)\s]+/,'')`, drops blanks, caps at MAX_SUGGESTIONS=8; degrades to `[]` on error. Count is LLM-dependent → runtime gate. |
| 6 | D-06: brain click auto-fires suggest; thinking placeholder until suggestions arrive | ✓ VERIFIED | chat.ts:428-452 `openCreator()` opens overlay, maps `messages()`→ChatHistoryItem[], sets `creatorThinking`, subscribes to `suggest`; chat.html:419 brain button → `openCreator()`, :715-721 animated `🦖 animate-bounce` + `animate-pulse` placeholder gated on `creatorThinking()`. |
| 7 | D-05: pick-suggestion AND free-text both converge on one synthesize step → editable 3-field form | ✓ VERIFIED | chat.ts:455-496 both `pickSuggestion` and `submitCreatorInput` call private `synthesizeInto`, which prefills `skillTitle`/`skillWhenToActivate`/`skillInstruction`; chat.html:762-793 renders all 3 as editable inputs + `saveCreated()` save button. |

**Score:** 7/7 code-verifiable truths verified. SC#1–SC#3 *runtime behavior* (suggestion count/quality, synthesis quality, live reconcile against DB) remains gated on HUMAN-UAT.

### Requirement & Success-Criterion Verdicts

| Item | Verdict | Notes |
| ---- | ------- | ----- |
| **MEMC-01** (suggest) | PASS (code) / PARTIAL (runtime) | Route, dino-model routing, paid fallback, ≥3-parse all wired; live ≥3 count is UAT (SC#1). |
| **MEMC-02** (synthesize) | PASS (code) / PARTIAL (runtime) | Convergent synthesize → editable form fully wired; synthesis quality is UAT (SC#2). |
| **MEMC-03** (reconcile/save) | PASS | Server-side create-vs-update fully implemented + unit-tested; no client toggle. Live overlap-update is UAT (SC#3). |
| **SC#1** thinking → ≥3 suggestions | PARTIAL | Code path complete; ≥3 count observable only at runtime → HUMAN-UAT. |
| **SC#2** pick OR free-text → editable form | PARTIAL | Both paths wired to one synthesize; field content is runtime → HUMAN-UAT. |
| **SC#3** save persists + overlap updates, no toggle | PARTIAL | Reconcile fully server-side, unit-tested; live persist/update is runtime → HUMAN-UAT. |
| **SC#4** no regression to teach flow / stored items | PASS (code) | Legacy teach form preserved under `<details>` (chat.html:795-824) with `saveSkill()`; `<app-skill-manager>` unchanged (:827-833); creator is purely additive. Runtime regression check folded into UAT. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `libs/shared-types/src/lib/dino.types.ts` | 6 creator contracts | ✓ VERIFIED | All 6 present (lines 83-121): SynthesizedSkill, Suggest/Synthesize/SaveCreatedSkill req/resp; `action: 'created'\|'updated'`. |
| `apps/backend/.../memory-creator.service.ts` | suggest/synthesize/reconcileAndSave + parse helpers | ✓ VERIFIED | 286 lines, all 3 methods + exported `parseSynthesized`/`parseReconcile`; no `any` (unknown+narrowing). |
| `apps/backend/.../memory-creator.controller.ts` | 3 POST routes, HTTP-only | ✓ VERIFIED | `@Post('skills/suggest\|synthesize\|save')` each with BadRequestException validation; delegates to service. |
| `apps/backend/.../memory.module.ts` | controller+service registered | ✓ VERIFIED | controllers: [SkillsController, MemoryCreatorController]; providers: [MemoryService, MemoryCreatorService]. |
| `apps/backend/.../memory-creator.service.spec.ts` | parse + reconcile-routing tests | ✓ VERIFIED | 12/12 pass (`node apps/backend/vitest.run.mjs memory-creator`). |
| `apps/frontend/.../skill.service.ts` | suggest/synthesize/saveCreated | ✓ VERIFIED | Lines 62-90; all post userId×dinoId; existing methods untouched. |
| `apps/frontend/.../chat.ts` | creator orchestration | ✓ VERIFIED | Lines 395-544; signals + openCreator/pick/submit/synthesizeInto/saveCreated/resetCreator, markForCheck after each async. |
| `apps/frontend/.../chat.html` | creator modal body | ✓ VERIFIED | Lines 712-833; thinking/suggestions/free-text/3-field form/save + legacy teach + skill-manager. |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| MemoryCreatorController | MemoryCreatorService | constructor DI | ✓ WIRED |
| reconcileAndSave | MemoryService.addSkill/updateSkill | constructor-injected MemoryService | ✓ WIRED (service.ts:235,268,279) |
| buildModel | getDino + ChatOpenAI(OpenRouter) | pure import + imageGen→FALLBACK | ✓ WIRED |
| Routes under `/api` prefix | global prefix | main.ts:14 `setGlobalPrefix('api')` | ✓ WIRED — resolves to `/api/skills/suggest\|synthesize\|save`, no collision with `@Post('skills')`/`@Delete('skills/:id')`/`@Put('skills/:id')`. |
| brain button | openCreator | chat.html:419 `(click)="openCreator()"` | ✓ WIRED (rewired from old openSkillPanel) |
| openCreator | SkillService.suggest | messages()→ChatHistoryItem[]; thinking signal | ✓ WIRED |
| pick/free-text | SkillService.synthesize → prefill signals | both → synthesizeInto | ✓ WIRED |
| saveCreated | SkillService.saveCreated → POST /save → refreshLearned | server reconciles, no toggle | ✓ WIRED |

### Routing Reconciliation (addSkill vs updateSkill)

Confirmed server-side in `reconcileAndSave`:
- `existing.length === 0` → always `addSkill` → `action: 'created'`.
- LLM reconcile `decision` matches an existing skill `id` (`existing.find(s => s.id === decision.decision)`) → `updateSkill(id, mergedFields)` → `action: 'updated'`. `whenToActivate` merge chain `mergedWhenToActivate ?? item.whenToActivate ?? match.whenToActivate ?? undefined` avoids wiping an existing trigger.
- `decision === 'new'` (or unmatched id) → `addSkill` → `action: 'created'`.
- Any `null` from add/update (DB off) → `ServiceUnavailableException`.
- The `decision`/merged fields are never returned to the client — only `{ skill, action }`. Frontend `saveCreated` does NO new-vs-update branching (chat.ts:503-531). D-07/D-08 satisfied.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Backend creator unit suite | `node apps/backend/vitest.run.mjs memory-creator` | Test Files 1 passed, Tests 12 passed | ✓ PASS |
| D-02 invariant (agents.service untouched) | `git diff --stat 0145238~7 0145238 -- agents.service.ts` | empty (no changes) | ✓ PASS |
| Live suggest/synthesize/save endpoints | requires running backend + OPENROUTER_API_KEY + DATABASE_URL | not run (no live services) | ? SKIP → HUMAN-UAT |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| — | No TBD/FIXME/XXX markers in phase-34 files | — | None |
| — | Empty-array/[] returns in service are documented graceful degradation (suggest→[] on LLM error), overwritten in happy path; not stubs | ℹ️ Info | Intentional fail-safe per design_decisions |
| — | `return null`-style stubs in creator UI | — | None found; SUMMARY "Known Stubs: None" confirmed against code |

No blocking anti-patterns. Brain button `[title]`/svg still read "Teach" (pencil glyph) rather than a brain glyph — cosmetic only; the click target correctly fires `openCreator()`. ROADMAP/Phase 33 own the brain-icon visual; not a Phase 34 gap.

### Human Verification Required (BLOCKING runtime gate — documented in 34-02 Task 4)

This is the single remaining open item. All code paths the UAT exercises are present and wired (verified above); only live LLM/DB behavior is unverifiable statically.

1. **Suggestions (SC#1):** Brain → thinking state → ≥3 conversation-derived suggestions.
2. **Synthesis (SC#2):** Pick a suggestion AND type free text → each prefills the editable name/when/instruction form.
3. **Reconcile/save (SC#3):** Save persists + auto-applies next chat; a clearly-overlapping item UPDATES the existing skill (no duplicate, no toggle).
4. **No regression (SC#4):** Manual teach disclosure + stored skills/memories still work.

Prereqs: Phase 33 + 34-01 deployed, `DATABASE_URL` + `OPENROUTER_API_KEY` set, `dino_skills` pushed via drizzle; `nx serve frontend` + `nx serve backend`.

### Gaps Summary

No code gaps. The backend engine (routes, dino-model routing with paid fallback, server-side reconcile, db-off handling) and the frontend creator (auto-suggest on brain open → convergent synthesize → editable 3-field form → save→refresh list) are fully implemented, wired, and unit-tested (12/12). The D-02 invariant holds (agents.service.ts unchanged across the phase). SC#4's additive structure is verified in the template. The only outstanding item is the **documented BLOCKING HUMAN-UAT** for SC#1–SC#3, whose runtime LLM/DB behavior cannot be verified statically — status is `human_needed`, not `gaps_found`.

---

_Verified: 2026-06-07T15:05:00Z_
_Verifier: Claude (gsd-verifier)_
