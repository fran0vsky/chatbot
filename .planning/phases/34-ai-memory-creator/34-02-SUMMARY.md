---
phase: 34-ai-memory-creator
plan: 02
subsystem: frontend
tags: [angular, signals, onpush, skills, creator, openrouter, shared-types, tailwind]

# Dependency graph
requires:
  - phase: 34-ai-memory-creator
    provides: "POST /api/skills/suggest|synthesize|save + shared-types creator contracts (Suggest/Synthesize/SaveCreatedSkill, SynthesizedSkill)"
  - phase: 33-composer-knowledge-reorg
    provides: "brain entry point, teach overlay shell, <app-skill-manager> list, SkillService.updateSkill"
provides:
  - "SkillService.suggest / synthesize / saveCreated — frontend reach into the creator engine (services-only)"
  - "ChatComponent creator orchestration: auto-suggest on brain open → pick/free-text → synthesize → prefill 3-field form → save (server reconciles)"
  - "Creator modal body in chat.html: thinking placeholder, suggestion list, free-text input, editable name/when/instruction form"
  - "skillWhenToActivate signal — the editable trigger field the creator form (and manual teach) prefill"
affects: [knowledge-view, skill-manager, teach-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Both pick-suggestion and free-text converge on one private synthesizeInto() step (D-05) — single synthesize call, fully editable form"
    - "Save delegates create-vs-update entirely to the backend; component does NO new-vs-update branching (D-07) — UI shows no toggle"
    - "Creator failures degrade silently (suggest error → empty list → free-text fallback; synthesize/save error → clear flags) — never blocks chat or teach flow (T-34-02-03)"
    - "LLM-derived text rendered via Angular interpolation only, never [innerHTML] (T-34-02-01)"

key-files:
  created: []
  modified:
    - apps/frontend/src/app/chat/skill.service.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html

key-decisions:
  - "Brain button rewired from openSkillPanel() to openCreator() (auto-fires suggestions); the manual teach form is preserved under a disclosure so SC#4 holds"
  - "Added skillWhenToActivate signal to ChatComponent — Phase 33 added the column + skill-manager edit path but never added a chat-level when-to-activate form signal; the creator form needs it (deviation Rule 3)"
  - "synthesize maps SynthesizedSkill.whenToActivate (string|undefined) → signal via '?? \"\"'; saveCreated omits whenToActivate when blank so the backend keeps the existing trigger on update"

patterns-established:
  - "Creator reuses the existing OnPush markForCheck() pattern after every async subscription callback"
  - "History for suggest is derived inline from messages() (user/assistant, non-empty) — no new history plumbing, mirrors buildHistory's filter shape"

requirements-completed: [MEMC-01, MEMC-02, MEMC-03]

# Metrics
duration: ~15min
completed: 2026-06-07
---

# Phase 34 Plan 02: AI Memory Creator Frontend Summary

**The brain modal now runs the full creator flow — auto-fired conversation-derived suggestions behind an animated dino "thinking" state, pick-a-suggestion OR free-text both synthesizing into one editable name/when/instruction form, and a save that lets the backend reconcile create-vs-update with no UI toggle — all HTTP through SkillService, OnPush, Tailwind only, with the Phase 22/33 teach flow kept intact.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-07T14:40Z
- **Completed:** 2026-06-07T14:55Z
- **Tasks:** 4 (3 code tasks executed; Task 4 is a HUMAN-UAT runtime gate — pending)
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments
- `SkillService` gained `suggest` / `synthesize` / `saveCreated`, posting to `/api/skills/suggest|synthesize|save`, typed with `@org/shared-types` (`SuggestSkillsResponse`, `SynthesizedSkill`, `SaveCreatedSkillResponse`), each scoped by `userId × dinoId`. Existing methods untouched.
- `ChatComponent` gained creator state (`creatorThinking`, `creatorSuggestions`, `creatorInput`, `creatorSynthesizing`) plus `skillWhenToActivate`, and handlers `openCreator` / `pickSuggestion` / `submitCreatorInput` / `synthesizeInto` (private) / `saveCreated`. Both entry paths converge on the one synthesize step (D-05); save delegates reconciliation to the backend (D-07) then `refreshLearned`.
- `chat.html` brain button now calls `openCreator()`; the overlay renders the thinking placeholder (animated dino, `animate-bounce`/`animate-pulse`) → suggestion list → always-available free-text input → editable 3-field form with a `saveCreated()` button. The manual teach form moved under a `<details>` disclosure and the `<app-skill-manager>` list is unchanged (SC#4).
- Verification gate green: `npx nx run-many -t lint,build --projects=frontend`.

## Task Commits

Each code task was committed atomically:

1. **Task 1: Add suggest/synthesize/saveCreated to SkillService** — `6b0adb6` (feat)
2. **Task 2: Add creator orchestration to ChatComponent** — `94cbe58` (feat)
3. **Task 3: Build the creator modal body in chat.html** — `e475ec3` (feat)
4. **Task 4: HUMAN-UAT** — not committed (runtime-only verification gate; see below)

## Files Created/Modified
- `apps/frontend/src/app/chat/skill.service.ts` — Added the three creator HTTP methods + creator-type imports.
- `apps/frontend/src/app/chat/chat.ts` — Added creator signals, `skillWhenToActivate`, and the openCreator/pick/submit/synthesizeInto/saveCreated/resetCreator orchestration; `closeSkillPanel` now also resets creator + the when field.
- `apps/frontend/src/app/chat/chat.html` — Brain button → `openCreator()`; added the creator body (thinking / suggestions / free-text / editable 3-field form) and wrapped the legacy teach form in a disclosure.

## Decisions Made
- The brain button was rewired from `openSkillPanel()` to `openCreator()`. `openCreator` opens the same overlay, resets creator state, refreshes the learned list, and auto-fires `suggest`. The manual `saveSkill()` teach form is kept under a "teach a skill manually" disclosure so the Phase 22/33 flow is fully preserved (SC#4).
- `saveCreated` omits `whenToActivate` when the field is blank, so an update never wipes an existing trigger; synthesize prefills the field via `skill.whenToActivate ?? ''`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `skillWhenToActivate` form signal**
- **Found during:** Task 2
- **Issue:** The plan and must-haves assume Phase 33 added a `skillWhenToActivate` signal to `ChatComponent` alongside `skillTitle`/`skillInstruction`. It did not — Phase 33 added the `whenToActivate` DB column and the skill-manager *edit* path (`onSkillEdited`), but the chat-level teach form only has title + instruction. The creator's editable 3-field form needs the trigger signal.
- **Fix:** Added `readonly skillWhenToActivate = signal('')` plus `updateSkillWhenToActivate(event)`; wired it into the creator form, `synthesizeInto` (prefill), `saveCreated` (payload), and both `closeSkillPanel`/`resetCreator`.
- **Files modified:** `apps/frontend/src/app/chat/chat.ts`, `apps/frontend/src/app/chat/chat.html`
- **Verification:** lint + build green.
- **Committed in:** `94cbe58` (Task 2) and `e475ec3` (Task 3).

**2. [Rule 3 - Blocking] Verify command project name mismatch**
- **Found during:** Task 1
- **Issue:** The plan's `<verify>` blocks target `@org/frontend`, but `nx show projects` lists the frontend project as `frontend` (only `@org/backend` and `@org/shared-types` use the scoped name). `npx nx lint @org/frontend` failed with "Cannot find project '@org/frontend'".
- **Fix:** Ran the equivalent commands against the real project id `frontend` (`npx nx lint frontend`, `npx nx build frontend`, `npx nx run-many -t lint,build --projects=frontend`).
- **Files modified:** none (command-only).
- **Verification:** all three commands exit 0.
- **Committed in:** n/a.

---

**Total deviations:** 2 auto-fixed (both blocking — 1 missing form signal, 1 verify-command name). No scope creep; no architectural changes.

## Issues Encountered
- Pre-existing build warnings about prismjs CommonJS modules (`prism-bash`/`prism-css`/`prism-python`) — unrelated to this plan, build still exits 0. Left untouched (out of scope).

## Known Stubs
None — all creator UI is wired to live `SkillService` calls; no hardcoded/empty data paths.

## HUMAN-UAT Pending (Task 4 — BLOCKING for phase verification)
SC#1–SC#3 are observable only at runtime against a live backend. With Phase 33 + 34-01 deployed and `DATABASE_URL` + `OPENROUTER_API_KEY` set (and `dino_skills` pushed via drizzle), serve the app (`npx nx serve frontend` + `npx nx serve backend`), and in a conversation with a dino:
1. Click the brain → confirm the dino "thinking" state shows, then ≥3 conversation-derived suggestions appear (SC#1).
2. Pick a suggestion AND, separately, type free text → confirm each prefills the editable name/when/instruction form (SC#2).
3. Save → confirm the item appears in the skill manager and auto-applies next chat; save a clearly-overlapping item and confirm it UPDATES the existing skill (no duplicate, no new-vs-update toggle) (SC#3).
4. Confirm the manual teach form (under the disclosure) + stored skills/memories still work (SC#4).

## Next Phase Readiness
- The creator is fully wired end-to-end in code; only live UAT remains to confirm suggestion/synthesis/reconcile quality (the engine's LLM behavior is best judged with a real key).
- No new persistence or contracts were introduced — Plan 02 consumes 34-01's surface as-is.

## Self-Check: PASSED

---
*Phase: 34-ai-memory-creator*
*Completed: 2026-06-07*
