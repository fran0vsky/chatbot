---
phase: 30-ux-reliability-cleanup
plan: "04"
subsystem: frontend-navigation
tags: [navigation, cleanup, active-view, explore-removal]
dependency_graph:
  requires: [30-01]
  provides: [explore-free-navigation]
  affects: [history-panel, chat-template, action-catalogue, ui-store]
tech_stack:
  added: []
  patterns: [angular-standalone, ngrx-store, zod-schema]
key_files:
  created: []
  modified:
    - libs/ui/src/lib/history-panel/history-panel.html
    - libs/ui/src/lib/history-panel/history-panel.ts
    - apps/frontend/src/app/chat/chat.html
    - apps/frontend/src/app/store/ui/ui.actions.ts
    - apps/frontend/src/app/store/action-catalogue.ts
    - apps/frontend/src/app/store/action-catalogue.spec.ts
decisions:
  - "Remove 'explore' from ActiveView union and all touch points in lockstep to avoid dangling references"
  - "Retarget action-catalogue.spec.ts set_active_view fixture to 'chats' (a valid member)"
  - "Also updated history-panel.ts inline union types to match — required to fix TS2345 build error"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-04"
  tasks_completed: 3
  tasks_total: 4
  files_modified: 6
---

# Phase 30 Plan 04: Remove Explore View — Summary

One-liner: Removed Explore nav entry, view block, ActiveView union member, and voice catalogue reference in lockstep — dino gallery remains via picker modal.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove the Explore nav entry | 152a8c8 | libs/ui/src/lib/history-panel/history-panel.html |
| 2 | Remove the Explore view block from chat.html | 4da3cc5 | apps/frontend/src/app/chat/chat.html |
| 3 | Drop 'explore' from ActiveView type and voice catalogue | 974eca4 | ui.actions.ts, action-catalogue.ts, action-catalogue.spec.ts, history-panel.ts |
| 4 | Verify no dead Explore navigation | — | manual / pending |

## Task 4 — Manual Verification Pending

Task 4 is `autonomous="false"` and requires human verification:
- Serve the frontend and confirm the sidebar has no Explore entry
- Confirm every remaining nav item (Chats, Knowledge, Group chat, Arena, Leaderboard) navigates correctly
- Confirm the dino gallery is still reachable via "New chat" / the picker modal
- Confirm no console errors
- Optionally try the voice "go to explore" intent and confirm it is no longer recognized

## Verification Results

- `pnpm nx lint frontend --quiet`: PASSED
- `pnpm nx build frontend --skip-nx-cache`: PASSED (warnings only — pre-existing CommonJS module warnings)
- `pnpm nx test frontend`: BLOCKED by pre-existing `referencedFiles` TypeScript bug (documented in STATE.md); not caused by this plan's changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2345 type mismatch in history-panel.ts**
- **Found during:** Task 3 (build verification)
- **Issue:** `history-panel.ts` had inline string unions `'chats' | 'explore' | 'knowledge' | ...` on `@Input() activeView` and `@Output() viewChange` that still included `'explore'` after removing it from `ActiveView`. Angular's template type-checker raised TS2345 because chat.html passes `$event` from `viewChange` (still typed with `'explore'`) into `setActiveView` (which now expects `ActiveView` without `'explore'`).
- **Fix:** Removed `'explore'` from both inline union types in history-panel.ts to match the updated `ActiveView` type.
- **Files modified:** `libs/ui/src/lib/history-panel/history-panel.ts`
- **Commit:** 974eca4

## Known Stubs

None — all removed code paths were dead UI with no data dependencies. The dino gallery remains fully wired via the picker modal.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- [x] libs/ui/src/lib/history-panel/history-panel.html — no 'explore' references
- [x] apps/frontend/src/app/chat/chat.html — no `activeView() === 'explore'` branch
- [x] apps/frontend/src/app/store/ui/ui.actions.ts — ActiveView has no 'explore'
- [x] apps/frontend/src/app/store/action-catalogue.ts — enum and description omit 'explore'
- [x] apps/frontend/src/app/store/action-catalogue.spec.ts — fixture uses 'chats'
- [x] libs/ui/src/lib/history-panel/history-panel.ts — inline unions updated
- [x] Commits 152a8c8, 4da3cc5, 974eca4 exist in git log
- [x] Build passes; lint (frontend) passes
