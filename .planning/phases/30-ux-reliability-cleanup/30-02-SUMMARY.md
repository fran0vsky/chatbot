---
phase: 30-ux-reliability-cleanup
plan: "02"
subsystem: ui/input-composer
tags: [ux, reliability, textarea, flex-layout, angular]
dependency_graph:
  requires: []
  provides: [REL-02]
  affects: [libs/ui/src/lib/input-composer]
tech_stack:
  added: []
  patterns:
    - "min-w-0 on flex-1 item to prevent overflow past flex container"
    - "AfterViewChecked with lastResizedDraft dirty guard for programmatic resize"
key_files:
  created: []
  modified:
    - libs/ui/src/lib/input-composer/input-composer.html
    - libs/ui/src/lib/input-composer/input-composer.ts
decisions:
  - "Use ngAfterViewChecked + lastResizedDraft dirty guard rather than a setter/effect — minimal change, no signal or input refactor needed"
  - "Treat pre-existing @nx/enforce-module-boundaries lint errors as out-of-scope (pre-existing workspace config issue noted in STATE.md)"
metrics:
  duration: ~10 min
  completed: "2026-06-04"
---

# Phase 30 Plan 02: Composer Textarea Overflow Fix Summary

Constrained the input-composer textarea so large pastes and long unbroken strings never break the pill layout. Added `min-w-0` to prevent horizontal flex overflow, and wired `ngAfterViewChecked` with a dirty guard so programmatic draft fills (STT transcript, suggestion prompts) immediately resize the textarea without requiring a keystroke.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Constrain textarea horizontally (min-w-0) | a53ffef | input-composer.html |
| 2 | Resize on programmatic draft changes | 4748f59 | input-composer.ts |
| 3 | Manual paste/overflow verification | — | Awaiting human |

## Deviations from Plan

None — plan executed exactly as written. The two auto tasks followed the design decisions specified in the plan (`min-w-0` fix + `ngAfterViewChecked` guard).

Note: `nx lint ui` reports pre-existing `@nx/enforce-module-boundaries` errors (including in `input-composer.ts` line 14/15) that exist on the baseline and are not introduced by this plan. This is a known workspace config issue documented in STATE.md under "Phase 24 Task 5" and "Phase 27" decisions.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-30-02-01 | `ngAfterViewChecked` guarded by `lastResizedDraft !== draft` — resize fires at most once per unique draft value, never loops |

## Pending Manual Verification (Task 3)

Serve the frontend (`npx nx serve frontend`) and verify:
- (a) Paste several paragraphs — height caps at ~8 rows, textarea scrolls internally, pill intact
- (b) Paste one 500-char unbroken string — wraps, send button stays in layout
- (c) Trigger a suggestion prompt or dictation fill — height adjusts without a keystroke
- (d) Short messages and send/stop buttons behave as before

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- a53ffef: fix(30-02): add min-w-0 to textarea to prevent horizontal overflow — FOUND
- 4748f59: fix(30-02): resize textarea on programmatic draft changes via AfterViewChecked — FOUND
- libs/ui/src/lib/input-composer/input-composer.html — FOUND (contains min-w-0)
- libs/ui/src/lib/input-composer/input-composer.ts — FOUND (contains AfterViewChecked, lastResizedDraft, ngAfterViewChecked)
