---
phase: 24-arena-leaderboard
plan: "01"
subsystem: arena
tags: [elo, arena, leaderboard, groupchat, streaming, drizzle]
dependency_graph:
  requires: [19-01, 23-01]
  provides: [arena-elo, arena-service, arena-frontend, leaderboard]
  affects: [frontend-chat, backend-app, ui-lib, shared-types]
tech_stack:
  added: []
  patterns:
    - "Pure Elo function: updateElo(ra, rb, result) with K=24, base=1000"
    - "Drizzle upsert with onConflictDoUpdate for idempotent rating writes"
    - "Parallel SSE streams reusing ChatService.streamMessage (same pattern as GroupchatService)"
    - "Phase-driven arena state machine: idle -> streaming -> voted"
key_files:
  created:
    - apps/backend/src/app/arena/elo.ts
    - apps/backend/src/app/arena/elo.spec.ts
    - apps/backend/src/app/arena/arena.service.ts
    - apps/backend/src/app/arena/arena.service.spec.ts
    - apps/backend/src/app/arena/arena.controller.ts
    - apps/backend/src/app/arena/arena.module.ts
    - libs/shared-types/src/lib/arena.types.ts
    - apps/frontend/src/app/chat/arena.service.ts
    - libs/ui/src/lib/leaderboard/leaderboard.ts
    - libs/ui/src/lib/leaderboard/leaderboard.html
    - libs/ui/src/lib/leaderboard/leaderboard.stories.ts
  modified:
    - apps/backend/src/app/database/schema.ts
    - apps/backend/src/app/app.module.ts
    - libs/shared-types/src/index.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
    - libs/ui/src/index.ts
    - libs/ui/src/lib/history-panel/history-panel.ts
    - libs/ui/src/lib/history-panel/history-panel.html
decisions:
  - "Skip treatment: 'draw' in the Elo system (Sa=Sb=0.5), as specified in the plan"
  - "K_FACTOR=24 for moderate volatility on a small roster of 4 dinos"
  - "Arena phase machine (idle/streaming/voted) drives UI reveal: identity hidden until voted"
  - "ui lint pre-existing failures (buildable/non-buildable boundary): leaderboard.ts follows the same @org/shared-types import pattern as all other ui components (group-response.ts, dino-card.ts, etc.) — this is a workspace-level config issue, not introduced by this plan"
  - "Vote buttons disabled until all panels reach done/error status (prevents premature votes)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-29T22:15:00Z"
  tasks_completed: 4
  tasks_total: 5
  files_created: 11
  files_modified: 8
---

# Phase 24 Plan 01: Dino Arena + Leaderboard Summary

Elo-rated blind dino comparison arena: two anonymous dinos stream answers to the same prompt, the user votes, identities are revealed, and Elo ratings update. A ranked Leaderboard tab persists results across battles. All features degrade gracefully when no database is connected.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Elo logic (pure + tested) + schema | e53915b | Done |
| 2 | ArenaService + ArenaController + module | 4fc8184 | Done |
| 3 | Arena frontend (blind compare + vote) | c331ab5 | Done |
| 4 | Leaderboard component + tab | ae151ce | Done |
| 5 | Arena + leaderboard smoke test (DB + key) | — | Pending (human UAT) |

## What Was Built

### Task 1 — Elo logic + schema + shared types
`elo.ts` exports a pure `updateElo(ra, rb, result)` function using the documented formula (K=24, base=1000). An exhaustive spec (15 tests) covers symmetry, expected-score monotonicity, draw splits, winner gains/loser loses, and rounding.

`dinoRatings` pgTable added to `schema.ts`: `dinoId` (text pk), `rating` (integer default 1000), `wins`, `losses`, `draws`, `games` (integer default 0), `updatedAt`.

Shared types: `DinoRating`, `ArenaVote`, `LeaderboardRow` in `arena.types.ts`, re-exported from `@org/shared-types`.

### Task 2 — ArenaService + ArenaController + module
`ArenaService` provides:
- `getMatchup()` — two distinct random dino IDs from the DINOS registry; always works without a DB
- `recordVote(vote)` — loads or seeds both ratings, applies `updateElo`, increments counters, upserts; no-ops silently when DB is null
- `getLeaderboard()` — merges DB rows with registry for all dinos; returns defaults when DB is off; sorted by rating desc

`ArenaController` exposes `GET /api/arena/matchup`, `POST /api/arena/vote` (204), `GET /api/arena/leaderboard`.

13 tests cover all methods under both with-DB and null-DB paths.

### Task 3 — Arena frontend (blind compare + vote)
`ArenaService` (frontend) fetches a matchup via HttpClient, fans out two parallel SSE streams (same `ChatService.streamMessage` pattern as GroupchatService), and drives a phase state machine (`idle → streaming → voted`).

In the arena view:
- Prompt box → "Start battle" → two anonymous panels (A/B) stream concurrently
- Vote buttons (A better / B better / Tie) enabled only after both panels complete
- On vote: `POST /api/arena/vote`, then `GET /api/arena/leaderboard`; phase shifts to `voted`
- Dino identities revealed (mascot + name + species + persona + updated rating)
- "Next battle" resets to idle

Arena and Leaderboard nav buttons added to HistoryPanel.

### Task 4 — Leaderboard presentational component + tab
`Leaderboard` (standalone, OnPush): `@Input() rows: LeaderboardRow[]`. Renders rank, mascot (via `app-mascot`), name, species, rating, W/L/D (color-coded), and games. Empty state shown when no battles have occurred. Three Storybook stories: `WithData`, `Empty`, `SingleRow`. Exported from `@chatbot/ui`.

The Leaderboard tab loads data via `ArenaService.loadLeaderboard()` on view entry.

## Deviations from Plan

None — plan executed exactly as written.

The ui lint `@nx/enforce-module-boundaries` errors on `leaderboard.ts` and `leaderboard.stories.ts` are pre-existing workspace configuration issues affecting all ui components that import from `@org/shared-types` (confirmed identical errors on `group-response.ts`, `dino-card.ts`, `skill-manager.ts`, etc.). These errors were present before this phase and are not introduced by this plan. Frontend lint passes clean (0 errors).

## Known Stubs

None — all data paths are wired end-to-end. When DATABASE_URL is unset, the leaderboard shows all dinos at default rating (1000) which is the intended graceful-degradation behavior, not a stub.

## Pending Human UAT (Task 5)

**Task 5: Arena + leaderboard smoke test** — requires live `DATABASE_URL` + `OPENROUTER_API_KEY`.

Steps:
1. Push the new `dino_ratings` table: `npx drizzle-kit push` (or the project's equivalent) with `DATABASE_URL` set
2. `npx nx serve backend` + `npx nx serve frontend`
3. Navigate to **Arena** in the sidebar → enter a prompt → confirm two anonymous panels stream in parallel
4. Vote → confirm both dinos are revealed with name/mascot/rating shown
5. Navigate to **Leaderboard** → confirm rating reflects the vote result (winner higher, loser lower)
6. Run 2–3 more battles → confirm leaderboard order updates
7. Unset `DATABASE_URL` → restart backend → confirm arena still runs (ratings not persisted) and leaderboard shows all dinos at 1000 without crashing

See also existing pending UAT items in STATE.md (Phases 21–23 smoke tests).

## Self-Check: PASSED

All key files exist. All task commits verified in git log.

| Check | Result |
|-------|--------|
| elo.ts | FOUND |
| arena.service.ts | FOUND |
| arena.controller.ts | FOUND |
| arena.module.ts | FOUND |
| arena.types.ts | FOUND |
| arena.service.ts (frontend) | FOUND |
| leaderboard.ts | FOUND |
| leaderboard.html | FOUND |
| Commit e53915b (Task 1) | FOUND |
| Commit 4fc8184 (Task 2) | FOUND |
| Commit c331ab5 (Task 3) | FOUND |
| Commit ae151ce (Task 4) | FOUND |
