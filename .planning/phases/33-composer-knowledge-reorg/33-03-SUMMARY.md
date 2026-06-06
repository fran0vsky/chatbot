---
phase: 33-composer-knowledge-reorg
plan: "03"
subsystem: frontend/skills
tags: [skills, inline-edit, skill-manager, knowledge-view, SkillService, presentational]
dependency_graph:
  requires: [DinoSkill.whenToActivate, PUT /api/skills/:id, MemoryService.updateSkill]
  provides: [SkillManager.skillEdited, SkillService.updateSkill, onSkillEdited, knowledge-view-skills-section]
  affects: [libs/ui skill-manager, apps/frontend chat host, Knowledge view]
tech_stack:
  added: []
  patterns: [inline-edit pattern with editingId state, FormsModule ngModel bindings, presentational output + smart handler]
key_files:
  created: []
  modified:
    - libs/ui/src/lib/skill-manager/skill-manager.ts
    - libs/ui/src/lib/skill-manager/skill-manager.html
    - libs/ui/src/lib/skill-manager/skill-manager.stories.ts
    - apps/frontend/src/app/chat/skill.service.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
decisions:
  - "Inline edit uses editingId string|null keyed field with seed-then-emit pattern; no new template-driven form component needed"
  - "Knowledge view loads learnedSkills via existing refreshLearned hooked into setActiveView"
  - "memories=[] passed to Knowledge view skill-manager to keep the view focused on skills only"
metrics:
  duration: ~20 minutes
  completed: 2026-06-06
---

# Phase 33 Plan 03: Skill Inline Edit + Knowledge View Skills Summary

**One-liner:** Inline skill editing (title/trigger/instruction) added to SkillManager with `skillEdited` output; Knowledge view gains a skills section reusing the same presentational component via one SkillService data source.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add inline-edit state + skillEdited output (TS) | 0b77d84 | skill-manager.ts, skill-manager.html |
| 2 | Inline edit UI in skill row (HTML) | 0b77d84 | skill-manager.html |
| 3 | Update Storybook story | 7607062 | skill-manager.stories.ts |
| 4 | Add SkillService.updateSkill + whenToActivate on addSkill | 86ef958 | skill.service.ts |
| 5 | Wire skillEdited + reuse skill-manager in Knowledge view | de492cc | chat.ts, chat.html |
| 6 | UAT — edit a skill in both surfaces | PENDING | manual |

## What Was Built

### SkillManager (presentational, `libs/ui`)

- Added `@Output() skillEdited` emitting `{ id, title, whenToActivate?, instruction }`
- Added inline-edit fields: `editingId`, `editTitle`, `editWhenToActivate`, `editInstruction`
- Added `startEdit(skill)`, `cancelEdit()`, `saveEdit()` — saveEdit trims, validates non-empty, emits, then cancels
- Imported `FormsModule` for `[(ngModel)]` bindings; component stays standalone + OnPush with no injected services
- HTML: static row shows Edit + Delete buttons; when editing, shows three inputs (title, whenToActivate optional, instruction textarea) + Save (disabled when title/instruction empty) + Cancel
- Static row now shows `whenToActivate` as a muted "When: ..." line when present

### Storybook story

- Added `skillEdited` to `argTypes` actions
- First sample skill now includes a `whenToActivate` value to exercise the new display and edit flow

### SkillService (`apps/frontend`)

- Added `updateSkill(id, {title, whenToActivate?, instruction})` issuing `PUT /api/skills/:id`
- Extended `addSkill` signature to accept optional `whenToActivate` forwarded in the POST body

### Chat host (`apps/frontend`)

- Added `onSkillEdited(payload)` handler: calls `skillService.updateSkill`, on success replaces the matching entry in `learnedSkills` signal; mirrors `onSkillDeleted` error handling pattern
- `setActiveView` now calls `refreshLearned` when switching to the `'knowledge'` view so the skills list populates without needing to open the teach modal
- Teach modal's `<app-skill-manager>` now binds `(skillEdited)="onSkillEdited($event)"`
- Knowledge view gained a "Skills" section below the file upload panel rendering `<app-skill-manager [skills]="learnedSkills()" [memories]="[]" (skillDeleted)="onSkillDeleted($event)" (skillEdited)="onSkillEdited($event)" />`

## Verification

- `npx nx build @chatbot/ui` — PASSED
- `npx nx lint frontend --quiet` — PASSED (0 errors, pre-existing ui-lib boundary warnings unchanged)
- `npx nx build frontend` — PASSED
- Task 6 (UAT): PENDING — requires live backend with DB (`dino_skills` table pushed)

## Deviations from Plan

None — plan executed exactly as written. Pre-existing `@nx/enforce-module-boundaries` lint errors in `@chatbot/ui` were verified to be pre-existing before this plan's changes.

## Known Stubs

None — learnedSkills is wired from SkillService.getLearned (real HTTP). The Skills section in the Knowledge view is fully data-driven.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All binding uses Angular interpolation/ngModel (auto-escaped). Threat model items T-33-03-02 (XSS) and T-33-03-03 (data loss) are mitigated: ngModel never uses innerHTML; Save is disabled when title/instruction empty.

## Self-Check

Files exist:
- libs/ui/src/lib/skill-manager/skill-manager.ts — modified
- apps/frontend/src/app/chat/skill.service.ts — modified
- apps/frontend/src/app/chat/chat.ts — modified
- apps/frontend/src/app/chat/chat.html — modified

Commits:
- 0b77d84 feat(33-03): add inline-edit state + UI to SkillManager
- 7607062 chore(33-03): wire skillEdited into SkillManager story + add whenToActivate sample
- 86ef958 feat(33-03): add SkillService.updateSkill + forward whenToActivate in addSkill
- de492cc feat(33-03): wire skillEdited in chat host + skills section in Knowledge view

## Self-Check: PASSED
