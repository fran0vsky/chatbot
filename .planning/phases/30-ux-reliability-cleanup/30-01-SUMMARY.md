---
phase: 30-ux-reliability-cleanup
plan: 01
subsystem: ui
tags: [angular, ngrx, signals, tailwind, skeleton, ux]

requires:
  - phase: 27-ngrx-state-refactor
    provides: NgRx store with selectMessages selector and switchSession action

provides:
  - threadSwitching transition flag on ChatComponent covering the message swap during session switch
  - animate-pulse skeleton placeholder in the message-list region during thread transitions

affects: [chat, session-switching, ux-reliability]

tech-stack:
  added: []
  patterns:
    - "One-frame transition flag (rAF + markForCheck) to cover synchronous state swaps in OnPush components"

key-files:
  created: []
  modified:
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html

key-decisions:
  - "Use requestAnimationFrame + markForCheck to clear threadSwitching — minimal overhead, correct for OnPush"
  - "Skeleton replaces only the message-list region; dino header and composer stay mounted"
  - "Inline Tailwind animate-pulse bars (no separate component needed for 4 skeleton rows)"

patterns-established:
  - "threadSwitching flag pattern: set true before dispatch, clear via rAF for OnPush-safe one-frame cover"

requirements-completed: [REL-01]

duration: 10min
completed: 2026-06-04
---

# Phase 30 Plan 01: Thread-Switch Skeleton Summary

**animate-pulse skeleton covers the message-list region for one rAF frame during session switches, eliminating stale-message flash in the Angular OnPush ChatComponent**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-04T00:00:00Z
- **Completed:** 2026-06-04T00:10:00Z
- **Tasks:** 2 automated (Task 3 is manual verification, pending user)
- **Files modified:** 2

## Accomplishments

- Added `threadSwitching = false` flag to ChatComponent, set true before `switchSession` dispatch and cleared via `requestAnimationFrame` + `markForCheck`
- Wrapped the message-list `@else` branch in an `@if (threadSwitching)` skeleton / `@else` real-list guard in chat.html
- Skeleton is 4 `animate-pulse rounded-2xl` bars matching `jungle-surface` theme colors
- Empty-state hero branch (messages().length <= 1) is unaffected
- Lint and build pass

## Task Commits

1. **Task 1: Add threadSwitching transition flag** - `a7bbc71` (feat)
2. **Task 2: Render skeleton while switching** - `926ff92` (feat)
3. **Task 3: Verify no stale-flash on switch** - PENDING manual verification

## Files Created/Modified

- `apps/frontend/src/app/chat/chat.ts` - Added `threadSwitching` field; updated `switchToSession` to set/clear it around the dispatch
- `apps/frontend/src/app/chat/chat.html` - Added `@if (threadSwitching)` skeleton branch over the message-list region

## Decisions Made

- Used `requestAnimationFrame` (not `queueMicrotask`) to clear `threadSwitching` — ensures the skeleton renders for at least one paint frame before the real messages appear
- Removed the now-redundant `cdr.detectChanges()` call at the end of `switchToSession`; `markForCheck` inside the rAF callback is correct for OnPush
- Inlined 4-bar skeleton markup directly in chat.html — no separate UI component warranted for this simple placeholder

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Pending Manual Verification

**Task 3 (REL-01 verification):** Serve the frontend, create two chats with clearly different messages, switch back and forth several times (desktop + mobile sidebar). Confirm:
- No frame shows the outgoing thread's messages during a switch
- A brief skeleton appears, then the target thread's messages
- Sending/streaming and the empty-state hero are unaffected

## Next Phase Readiness

- REL-01 automation complete; manual smoke test pending user
- Phase 30 Plan 02 can proceed (textarea fix, active-badge removal, Explore removal)

---
*Phase: 30-ux-reliability-cleanup*
*Completed: 2026-06-04*
