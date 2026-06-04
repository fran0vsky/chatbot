---
phase: 30-ux-reliability-cleanup
plan: 03
subsystem: ui
tags: [angular, tailwind, dino-card, storybook]

requires:
  - phase: 30-ux-reliability-cleanup
    provides: Phase 30 UX context and other cleanup tasks

provides:
  - dino-card template without the Active text badge pill
  - ring highlight remains the sole active affordance on dino picker

affects: [dino-picker, ui]

tech-stack:
  added: []
  patterns:
    - "Active state communicated via ring highlight only (no redundant text badge)"

key-files:
  created: []
  modified:
    - libs/ui/src/lib/dino-card/dino-card.html

key-decisions:
  - "Removed only the @if badge span; active input, aria-pressed, and ring classes untouched"
  - "Stories required no changes — they assert active: true/false (ring state), not badge text presence"

patterns-established:
  - "Selection ring as sole active indicator: eliminates text badge redundancy"

requirements-completed: [REL-03]

duration: 8min
completed: 2026-06-04
---

# Phase 30 Plan 03: Remove Active Badge from Dino-Card Summary

**Dino-card Active text badge removed; selection ring remains as the only active affordance in the dino picker**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-04T17:00:00Z
- **Completed:** 2026-06-04T17:08:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Deleted the `@if (active) { <span>Active</span> }` pill from `dino-card.html`
- Kept the `active`-driven ring classes (`ring-2`, `ring-jungle-accent`, `dark:ring-jungle-night-accent`) and `aria-pressed` attribute intact
- Confirmed stories required no changes — `Active: Story` sets `active: true` only to demonstrate the ring, not to assert badge text
- Verified no new lint errors introduced (pre-existing `@nx/enforce-module-boundaries` errors in other files remain unchanged)

## Task Commits

1. **Task 1: Remove the Active badge from the template** - `22b486c` (feat)
2. **Task 2: Keep Storybook consistent** - no file changes needed (stories had no badge text assertions)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified

- `libs/ui/src/lib/dino-card/dino-card.html` — Removed 3 lines (the `@if (active)` badge span); all other bindings preserved

## Decisions Made

- Removed badge span only; did not simplify the `flex items-center justify-between` header wrapper (harmless, per design decisions)
- Stories left unchanged — the `Active` story name is about the ring affordance, not a text badge assertion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Pre-existing: Storybook build failure** — `build-storybook ui` fails with `AngularLegacyBuildOptionsError` even after the `63a6438` fix commit. The error is pre-existing (reproduced before this plan's changes) and is unrelated to the badge removal. Logged to deferred items. The stories file itself is valid and has no badge text references.
- **Pre-existing: `@nx/enforce-module-boundaries` lint errors** — affect all ui components including `dino-card`; known pre-existing issue documented in STATE.md (Phase 24 decisions).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REL-03 satisfied: dino picker is cleaner with ring as sole selection indicator
- Ready for Plan 30-04 (remove Explore tab or other remaining REL-04 work)

---
*Phase: 30-ux-reliability-cleanup*
*Completed: 2026-06-04*
