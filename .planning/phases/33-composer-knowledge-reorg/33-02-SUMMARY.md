---
phase: 33-composer-knowledge-reorg
plan: 02
subsystem: ui
tags: [angular, tailwind, input-composer, teach, slash-command, skill-panel]

# Dependency graph
requires:
  - phase: 22-skill-teaching
    provides: skillPanelOpen, openSkillPanel, skillInstruction signals in chat host
  - phase: 33-01
    provides: context for composer restructure direction
provides:
  - Brain button on InputComposer emitting teachOpen output
  - /teach slash-command autocomplete popover with instruction prefill
  - Dedicated Tools button (sliders icon, title/aria-label "Tools")
  - openSkillPanel accepts optional prefillInstruction param
  - Teach modal enlarged to max-w-2xl
affects: [33-03, future-composer-work, teach-skill-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slash-command detection via regex getter (commandMenuOpen) on draft signal"
    - "Optional prefill param passed through EventEmitter<string|undefined> → component method"

key-files:
  created: []
  modified:
    - libs/ui/src/lib/input-composer/input-composer.ts
    - libs/ui/src/lib/input-composer/input-composer.html
    - libs/ui/src/lib/input-composer/input-composer.stories.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html

key-decisions:
  - "Brain button emits teachOpen.emit(undefined) directly from template; no new TS method needed for direct click"
  - "commandMenuOpen is a getter (not signal) — OnPush change detection picks it up via ngModel binding on draft"
  - "chooseTeach() closes toolsOpen as a guard; menu popover is above the main flex row via sibling div"
  - "Groupchat composer left without teachOpen binding as specified (no teach in group context)"

patterns-established:
  - "Slash-command menu: @if(commandMenuOpen) renders above composer; Enter in onKeydown routes to chooseTeach()"
  - "Prefill pattern: EventEmitter<string|undefined> carries optional context; host checks truthiness before setting signal"

requirements-completed: [CMP-01, CMP-02, CMP-05]

# Metrics
duration: 25min
completed: 2026-06-06
---

# Phase 33 Plan 02: Composer Restructure — Brain, Tools Button, /teach Summary

**Brain button + /teach slash-command added to InputComposer; teach modal widened to max-w-2xl; openSkillPanel prefills instruction from trailing /teach text**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-06T20:45:00Z
- **Completed:** 2026-06-06T21:10:00Z
- **Tasks:** 4 auto (committed) + 1 manual UAT (pending human)
- **Files modified:** 5

## Accomplishments

- Added `@Output() teachOpen = new EventEmitter<string | undefined>()` to InputComposer with a brain SVG button as the leftmost composer control
- `/teach` slash-command: `commandMenuOpen` getter detects leading-slash drafts; `chooseTeach()` parses trailing text as prefill and emits `teachOpen`; Enter key routes through command menu when open
- Tools button re-iconed from wrench to sliders glyph; title changed to "Tools" (aria-label already "Tools"); popover and toolToggled wiring unchanged
- Both main-chat composers wired `(teachOpen)="openSkillPanel($event)"`; groupchat composer untouched
- `openSkillPanel` gained optional `prefillInstruction?: string` param; sets `skillInstruction` signal when present
- Teach modal box widened from `max-w-lg` to `max-w-2xl` (CMP-02)

## Task Commits

1. **Task 1: Add teachOpen output + commandMenuOpen + chooseTeach (TS)** - `44c7327` (feat)
2. **Task 2: Brain button, Tools icon, /teach command menu (HTML)** - `bc3d3aa` (feat)
3. **Task 3: Update Storybook story for teachOpen** - `0886915` (chore)
4. **Task 4: Wire teachOpen + enlarge teach modal (chat host)** - `7f2ec8d` (feat)

## Files Created/Modified

- `libs/ui/src/lib/input-composer/input-composer.ts` — teachOpen output, commandMenuOpen getter, chooseTeach(), onKeydown routing
- `libs/ui/src/lib/input-composer/input-composer.html` — brain button (first control), sliders Tools icon, @if(commandMenuOpen) menu popover
- `libs/ui/src/lib/input-composer/input-composer.stories.ts` — teachOpen action registered, CommandMenu story variant added
- `apps/frontend/src/app/chat/chat.ts` — openSkillPanel(prefillInstruction?) sets skillInstruction signal
- `apps/frontend/src/app/chat/chat.html` — (teachOpen) on both main composers, teach modal max-w-2xl

## Decisions Made

- Brain button emits `teachOpen.emit(undefined)` directly in the template rather than routing through a TS method — cleaner for a simple no-arg emit
- `commandMenuOpen` is a class getter (not a separate signal) so Angular's OnPush picks it up on each draft ngModel change cycle
- `/teach` menu popover is placed as a sibling `div` above the main `flex items-center` row to avoid z-index clipping inside the flex container
- Groupchat composer intentionally left without `(teachOpen)` binding per D-01 (no teach in group context)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing lint errors in other `@chatbot/ui` files (empty arrow functions in stories, module boundary violations) were confirmed as pre-existing and out of scope. The `input-composer.ts` and related files had no lint errors.

## User Setup Required

None - no external service configuration required.

## Pending UAT (Task 5)

**Task 5 is a manual UAT task** (`autonomous="false"`). Run `npx nx serve frontend` and verify:

1. Composer shows a brain button (leftmost) and a separate tools button (sliders icon, tooltip "Tools")
2. Click brain → enlarged teach panel opens (noticeably wider)
3. Type `/` → /teach autocomplete appears; select it → teach panel opens
4. Type `/teach Always answer in haiku` + select → panel opens with instruction pre-filled, name blank
5. Send a normal message → Enter still sends (no menu interference)

Acceptance satisfies CMP-01 (brain + labeled Tools), CMP-02 (/teach + wider modal), CMP-05 (no send/tool regression).

## Next Phase Readiness

- Phase 33-03 (skill editing) can now build on the enlarged teach modal and the openSkillPanel(prefillInstruction) signature
- Teach flow is reachable from two composer entry points (brain button, /teach), ready for further skill UX iterations

---
*Phase: 33-composer-knowledge-reorg*
*Completed: 2026-06-06*
