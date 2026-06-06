---
phase: 33-composer-knowledge-reorg
verified: 2026-06-06T22:30:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Run the frontend (npx nx serve frontend). In a 1:1 chat: (1) confirm a brain icon appears leftmost in the composer; hover the separate Tools (sliders) button — confirm its tooltip reads 'Tools' and the checkbox popover still opens."
    expected: "Brain button opens teach panel; Tools button tooltip reads 'Tools'; tool checkboxes still toggle tools"
    why_human: "Button rendering, tooltip text, and popover behavior require visual/interactive browser verification"
  - test: "Click the brain button — confirm the teach panel opens and is noticeably wider than before (was max-w-lg, now max-w-2xl)."
    expected: "Teach modal opens; modal is visibly wider (max-w-2xl)"
    why_human: "Visual comparison of modal width and panel opening requires live browser check"
  - test: "Type '/' in the composer and confirm a /teach autocomplete popover appears. Select /teach — confirm the teach panel opens. Also type '/teach Always answer in haiku' then select /teach — confirm the instruction field is pre-filled with 'Always answer in haiku' and the name field is blank."
    expected: "/teach menu appears; selecting it opens teach panel; trailing text populates instruction field"
    why_human: "Autocomplete UI behavior and instruction pre-fill require interactive testing"
  - test: "Send a normal message (no leading /) and confirm Enter sends it normally (no command-menu interference)."
    expected: "Normal message sends on Enter; command menu does not trigger"
    why_human: "Key routing behavior with normal vs. slash drafts requires live interaction"
  - test: "With the backend running and the schema pushed (plan 01 Task 7): teach a skill. In the teach modal, click Edit on that skill, change the name + add a 'when to activate' + change the instruction, Save, and confirm the row reflects the update."
    expected: "Skill edit persists; the row shows the updated title, trigger, and instruction"
    why_human: "Inline-edit round-trip requires live backend with the pushed DB schema (Task 7)"
  - test: "Open the Knowledge view (via nav/tab). Confirm the Skills section appears and lists the active dino's taught skills, each with Edit + Delete buttons."
    expected: "Knowledge view shows the skills list with edit + delete actions; list loads without opening the teach modal"
    why_human: "Knowledge view content and skill list population require live rendering verification"
  - test: "[BLOCKING - requires DATABASE_URL] Run: cd apps/backend && npx drizzle-kit push. Then smoke-test PUT /api/skills/:id: POST a skill, PUT it with new title + whenToActivate + instruction, GET to confirm the update persisted."
    expected: "drizzle-kit push adds when_to_activate column non-destructively; PUT round-trip works"
    why_human: "Requires a live Postgres DB with DATABASE_URL configured (no local DB in CI)"
---

# Phase 33: Composer & Knowledge Reorg — Verification Report

**Phase Goal:** Restructure the composer and skill management around a brain entry point, and make skills first-class (view + edit, not just delete).
**Verified:** 2026-06-06T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A brain icon replaces the wrench in the composer; a dedicated, clearly-labeled tools button exposes the tool toggles (CMP-01) | VERIFIED (code) / ? UAT | `input-composer.html` line 52–63: brain SVG button with `aria-label="Teach a skill"` + `(click)="teachOpen.emit(undefined)"` is the first control. Separate tools button at line 67–89 with `aria-label="Tools"` and `title="Tools"` using a sliders icon (not the wrench). No wrench path found. `input-composer.ts` line 89: `@Output() teachOpen = new EventEmitter<string | undefined>()`. |
| 2 | A `/teach` slash-command in the composer opens the teach flow; the teach modal is noticeably larger (wider + taller) (CMP-02) | VERIFIED (code) / ? UAT | `commandMenuOpen` getter at `input-composer.ts` line 100–103 matches `^/\w*$` and checks `/teach.startsWith(trimmed)`. `chooseTeach()` emits trailing text via `teachOpen` and clears draft. `input-composer.html` lines 34–48: `@if(commandMenuOpen)` block renders `/teach — Teach this dino a skill` calling `chooseTeach()`. `chat.html` line 688: modal uses `max-w-2xl max-h-[85vh]` (no longer `max-w-lg`). |
| 3 | A saved skill can be edited in place in the skill manager (name / trigger / instruction), not only deleted (CMP-03) | VERIFIED (code) / ? UAT | `skill-manager.ts` lines 33–58: `skillEdited` output, `editingId`/`editTitle`/`editWhenToActivate`/`editInstruction` fields, `startEdit`/`cancelEdit`/`saveEdit` methods. `skill-manager.html` lines 15–77: `@if(editingId !== skill.id)` static view with Edit+Delete; `@else` branch with three inputs + disabled-when-empty Save + Cancel. `skill.service.ts` lines 38–40: `updateSkill` calls `PUT /api/skills/${id}`. `chat.ts` lines 472–480: `onSkillEdited` handler calls `updateSkill` and updates `learnedSkills` signal. `skills.controller.ts` lines 69–80: `@Put('skills/:id')` calls `memory.updateSkill`. |
| 4 | The Knowledge view lists the active dino's learned skills (each with edit + delete) (CMP-04) | VERIFIED (code) / ? UAT | `chat.html` lines 390–400: "Skills" section inside `@else if (activeView() === 'knowledge')` block renders `<app-skill-manager [skills]="learnedSkills()" [memories]="[]" (skillDeleted)="onSkillDeleted($event)" (skillEdited)="onSkillEdited($event)" />`. `chat.ts` lines 310–312: `setActiveView` calls `refreshLearned(dinoId)` when switching to `'knowledge'` view so the list is populated. |
| 5 | No regression: existing tool toggling and teach/save still work (CMP-05) | VERIFIED (code) / ? UAT | Tools popover + checkbox + `toolToggled` wiring intact in `input-composer.html` lines 66–116. `buildSystemPrompt` in `agents.service.ts` maps every skill regardless of `whenToActivate`; the conditional only adds `(use when: ...)` hint for non-empty triggers. Schema column `text('when_to_activate')` is nullable with no `.notNull()` and no `.default()` — existing rows unaffected. 18 unit tests pass covering the always-apply path. |

**Score:** 5/5 truths VERIFIED in code. All 5 require UAT to confirm live behavior.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `libs/shared-types/src/lib/dino.types.ts` | `DinoSkill.whenToActivate?: string` | VERIFIED | Line 65: `whenToActivate?: string` with doc comment "Empty/absent = always apply (CMP-05)" |
| `apps/backend/src/app/database/schema.ts` | nullable `when_to_activate` column | VERIFIED | Line 78: `whenToActivate: text('when_to_activate')` — no `.notNull()`, no `.default()` |
| `apps/backend/src/app/memory/memory.service.ts` | `updateSkill` + `whenToActivate` in get/add | VERIFIED | `SkillView.whenToActivate?: string | null` (line 13); `getSkills` selects `dinoSkills.whenToActivate` (line 115); `addSkill` writes + returns it (lines 138–148); `updateSkill` fully implemented (lines 157–183) |
| `apps/backend/src/app/memory/skills.controller.ts` | `PUT /api/skills/:id` | VERIFIED | Lines 69–80: `@Put('skills/:id')` validates title+instruction, delegates to `memory.updateSkill`, maps null to `ServiceUnavailableException` |
| `apps/backend/src/app/agents/agents.service.ts` | Optional `(use when:)` hint, all skills always injected | VERIFIED | Lines 403–407: conditional renders `(use when: ${whenToActivate})` only when truthy; all skills still appended unconditionally |
| `apps/backend/src/app/memory/memory.service.spec.ts` | ≥3 new `updateSkill` tests | VERIFIED | Lines 162–197: 4 tests covering db-off, empty-title, empty-instruction, happy path with `whenToActivate`, and blank-trigger→null coercion. Plus `addSkill whenToActivate` test at lines 153–159 |
| `libs/ui/src/lib/input-composer/input-composer.ts` | `teachOpen` output, `commandMenuOpen`, `chooseTeach` | VERIFIED | Lines 89, 100–103, 110–120: all present, no `any`, OnPush, no injected services |
| `libs/ui/src/lib/input-composer/input-composer.html` | Brain button + Tools button (sliders) + command menu | VERIFIED | Brain at lines 52–63, Tools at 65–116 with `title="Tools"` and sliders SVG, `@if(commandMenuOpen)` at lines 34–48 |
| `libs/ui/src/lib/input-composer/input-composer.stories.ts` | `teachOpen` action + CommandMenu story | VERIFIED | Lines 13 and 41–46: `teachOpen: { action: 'teachOpen' }` and `CommandMenu` story exported |
| `apps/frontend/src/app/chat/chat.ts` | `openSkillPanel(prefillInstruction?)`, `onSkillEdited` | VERIFIED | Lines 400–408 and 472–480: both methods fully implemented, `skillInstruction.set(prefillInstruction)` when truthy, `updateSkill` → `learnedSkills.update` on success |
| `apps/frontend/src/app/chat/chat.html` | `(teachOpen)` on both main composers; `max-w-2xl` modal; Knowledge skills section | VERIFIED | Lines 468, 563: two main composers bind `(teachOpen)="openSkillPanel($event)"`. Line 688: `max-w-2xl`. Lines 390–401: Knowledge skills section with `app-skill-manager`. |
| `libs/ui/src/lib/skill-manager/skill-manager.ts` | `skillEdited` output, inline-edit state/methods | VERIFIED | Lines 33–58: complete, FormsModule imported, no injected services, standalone+OnPush |
| `libs/ui/src/lib/skill-manager/skill-manager.html` | Edit button + inline edit form + Save disabled when empty | VERIFIED | Lines 25–37 (Edit + Delete buttons), 39–72 (`@else` branch with inputs and disabled Save) |
| `libs/ui/src/lib/skill-manager/skill-manager.stories.ts` | `skillEdited` action + skill with `whenToActivate` | VERIFIED | Lines 6 and 22: first sample skill includes `whenToActivate`; `skillEdited: { action: 'skillEdited' }` in argTypes |
| `apps/frontend/src/app/chat/skill.service.ts` | `updateSkill` PUT + `whenToActivate` on `addSkill` | VERIFIED | Lines 27–40: `updateSkill` calls `this.http.put`; `addSkill` spreads `whenToActivate` when provided |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `InputComposer` brain button | `Chat.openSkillPanel($event)` | `(teachOpen)` binding on both main composers | WIRED | `chat.html` lines 468, 563 both bind `(teachOpen)="openSkillPanel($event)"` |
| `InputComposer.chooseTeach()` | `teachOpen.emit(trailing)` | EventEmitter carrying `string|undefined` | WIRED | `input-composer.ts` lines 113 |
| `app-skill-manager (skillEdited)` | `Chat.onSkillEdited → SkillService.updateSkill → PUT /api/skills/:id` | presentational output → smart handler → HTTP service | WIRED | `chat.html` line 400 (Knowledge view) + 744 (teach modal); `chat.ts` line 473 calls `skillService.updateSkill`; `skill.service.ts` line 39 issues `http.put` |
| `SkillsController.update (PUT skills/:id)` | `MemoryService.updateSkill` | constructor-injected `memory` service | WIRED | `skills.controller.ts` line 75: `this.memory.updateSkill(id, {title, instruction, whenToActivate})` |
| `setActiveView('knowledge')` | `refreshLearned(dinoId)` | direct method call in `setActiveView` guard | WIRED | `chat.ts` lines 310–312 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app-skill-manager` in Knowledge view | `learnedSkills()` signal | `refreshLearned` → `skillService.getLearned` → `GET /api/skills` → `MemoryService.getSkills` → Drizzle DB query | Yes — full DB query via `db.select({...}).from(dinoSkills).where(...)` | FLOWING |
| `app-skill-manager` in teach modal | `learnedSkills()` signal (same source) | `openSkillPanel` calls `refreshLearned` | Yes — same data path | FLOWING |
| `MemoryService.getSkills` | `dinoSkills` table rows | Drizzle `db.select({ id, title, instruction, whenToActivate }).from(dinoSkills).where(...)` | Yes — real select projection | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `@org/shared-types` builds with `whenToActivate` | `npx nx build @org/shared-types` | Per SUMMARY-01: PASSED | PASS (per SUMMARY) |
| Backend lints + builds with `PUT skills/:id` | `npx nx run-many -t lint,build --projects=@org/backend` | Per SUMMARY-01: PASSED | PASS (per SUMMARY) |
| Unit tests for `updateSkill` (18/18) | `node apps/backend/vitest.run.mjs memory.service` | Per SUMMARY-01: 18/18 PASSED | PASS (per SUMMARY) |
| `@chatbot/ui` builds with brain/tools/command-menu | `npx nx build @chatbot/ui` | Per SUMMARY-02/03: PASSED | PASS (per SUMMARY) |
| Frontend lints + builds | `npx nx run-many -t lint,build --projects=frontend` | Per SUMMARY-02/03: PASSED | PASS (per SUMMARY) |

_Note: Behavioral spot-checks were not re-run independently. The SUMMARY files contain explicit build/test pass claims. If independent confirmation is needed, run the commands above._

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|---------|
| CMP-01 | 33-02 | Brain icon replaces wrench as primary composer control; dedicated clearly-labeled Tools button | SATISFIED | Brain button in `input-composer.html` with `aria-label="Teach a skill"`; Tools button with `title="Tools"` + `aria-label="Tools"` and sliders SVG |
| CMP-02 | 33-02 | `/teach` slash-command opens teach flow; teach modal noticeably larger (wider + taller) | SATISFIED | `commandMenuOpen` getter + `chooseTeach()` in TS; `@if(commandMenuOpen)` menu in HTML; `max-w-2xl` on modal |
| CMP-03 | 33-01, 33-03 | Saved skill can be edited in place (name / trigger / instruction) via `PUT /api/skills/:id` | SATISFIED | `updateSkill` in `MemoryService`, `PUT skills/:id` in `SkillsController`, inline edit in `SkillManager`, `onSkillEdited` in chat host, `updateSkill` in `SkillService` |
| CMP-04 | 33-03 | Knowledge view lists the active dino's learned skills with edit + delete | SATISFIED | Skills section added to knowledge block in `chat.html`; `setActiveView('knowledge')` calls `refreshLearned` |
| CMP-05 | 33-01, 33-02, 33-03 | No regression: skills without trigger always applied, tool toggling and teach/save unchanged | SATISFIED | `buildSystemPrompt` still injects all skills; trigger only adds rendering hint; tools popover + `toolToggled` intact; 18 unit tests confirm graceful degradation |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `libs/ui/src/lib/input-composer/input-composer.html` | 121 | `title="Emoji (coming soon)"` — visible tooltip text indicating unimplemented feature | WARNING | Emoji button is visible in the UI but non-functional; tooltip text "coming soon" is shown to users. This is NOT a TBD/FIXME/XXX code marker (not a BLOCKER), but it is user-visible. Likely pre-existing before Phase 33 — the file was modified in this phase but the emoji button was not in scope. No formal issue reference exists on this line. |

_Assessment: The "coming soon" is in a `title` attribute (user-visible tooltip), not a code debt marker. Classified as WARNING, not BLOCKER. It does not affect any Phase 33 deliverable. The emoji button has no click handler and was not part of the phase scope._

---

### Human Verification Required

The automated code review confirms all five success criteria are implemented correctly in the codebase. The following items require live browser/backend verification:

#### 1. Composer UI — Brain + Tools Layout (CMP-01)

**Test:** Run `npx nx serve frontend`. Open a 1:1 chat. Confirm the composer shows a brain icon button as the leftmost control, and a separate sliders-icon Tools button. Hover the Tools button and confirm the tooltip reads "Tools". Click the Tools button and confirm the checkbox popover opens and tools still toggle.
**Expected:** Brain button and dedicated Tools button visible; tooltip "Tools"; tool checkboxes functional.
**Why human:** Button rendering, tooltip text, and popover interaction require a live browser.

#### 2. Brain Opens Enlarged Teach Panel (CMP-01 / CMP-02)

**Test:** Click the brain button. Confirm the teach panel opens. Confirm the modal is noticeably wider than before (the code changed `max-w-lg` to `max-w-2xl`).
**Expected:** Teach panel opens; modal is visibly wider.
**Why human:** Visual size comparison requires rendering in the browser.

#### 3. /teach Slash Command + Prefill (CMP-02)

**Test:** Type `/` in the composer. Confirm a `/teach — Teach this dino a skill` autocomplete popover appears. Select it — confirm the teach panel opens. Then type `/teach Always answer in haiku` and press Enter (or click /teach) — confirm the teach panel opens with "Always answer in haiku" in the instruction field and the name field blank.
**Expected:** Autocomplete appears on `/`; selection opens teach panel; trailing text pre-fills instruction.
**Why human:** Command-menu rendering and prefill behavior require interactive testing.

#### 4. Normal Send Not Interrupted (CMP-05)

**Test:** Type a regular message (no leading `/`) and press Enter. Confirm it sends normally.
**Expected:** Message sends; no command-menu interference with normal drafts.
**Why human:** Key-routing behavior (command-menu guard) requires live interaction.

#### 5. Inline Skill Edit — Teach Modal (CMP-03)

**Test:** With the backend running (after drizzle-kit push, see item 7): teach a skill. In the teach modal, click Edit on the skill. Change the name, add a "when to activate" value, and change the instruction. Click Save. Confirm the row updates immediately. Reopen the teach modal and confirm the update persisted.
**Expected:** Skill edit is reflected immediately and persists across reloads.
**Why human:** Requires live backend with pushed DB schema for edit round-trip.

#### 6. Skills in Knowledge View (CMP-04)

**Test:** Navigate to the Knowledge view. Confirm a "Skills" section appears below the file upload area, listing the active dino's taught skills with Edit and Delete buttons. Edit a skill from this view and confirm it persists. Confirm the skill list loads without needing to open the teach modal.
**Expected:** Knowledge view lists skills; edit + delete work; list populates automatically.
**Why human:** View navigation, list population, and edit flow require live rendering.

#### 7. [BLOCKING — requires DATABASE_URL] Schema Push (CMP-03 prerequisite)

**Test:** With `DATABASE_URL` set in `apps/backend/.env`, run: `cd apps/backend && npx drizzle-kit push`. Then: POST a skill and confirm `whenToActivate: null` in the response. PUT that skill with a new `whenToActivate` value. GET skills and confirm the value persisted.
**Expected:** Schema push is non-destructive; `when_to_activate` column added; PUT round-trip works.
**Why human:** Requires a live Postgres database with `DATABASE_URL` configured.

---

### Gaps Summary

No code-level gaps found. All five success criteria are verifiably implemented in the codebase. The phase goal is achieved at the implementation layer.

**Blocking path to full sign-off:** Item 7 (schema push) must be completed before the edit feature can work end-to-end in production. This was identified as a manual blocking task in the plan (33-01 Task 7) and is expected.

---

_Verified: 2026-06-06T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
