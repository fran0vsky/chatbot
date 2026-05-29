---
phase: 24-arena-leaderboard
verified: 2026-05-30T00:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Arena live smoke test — DB connected + OpenRouter key active"
    expected: "Navigate to Arena, enter a prompt, confirm two anonymous panels stream in parallel. Vote for one — both dinos reveal with name/mascot/species/persona and updated ratings appear. Navigate to Leaderboard and confirm ranking reflects the vote result (winner higher, loser lower). Run 2-3 more battles and confirm leaderboard order updates after each."
    why_human: "Requires live DATABASE_URL (dino_ratings table pushed via drizzle-kit push), live OPENROUTER_API_KEY, and running dev servers. Cannot verify SSE streaming, visual panel layout, or real Elo persistence programmatically."
  - test: "Null-DB degradation — DATABASE_URL unset"
    expected: "With DATABASE_URL unset, restart the backend. Arena still starts a battle and streams two responses. Leaderboard shows all dinos at rating 1000 (no crash). Voting does not crash the frontend (204 is silently discarded server-side)."
    why_human: "Requires server restart in a specific env configuration. Code paths are unit-tested (13 ArenaService tests cover null-db) but live env behavior must be confirmed."
---

# Phase 24: Dino Arena + Leaderboard Verification Report

**Phase Goal:** A blind head-to-head where two dinos answer the same prompt; the user votes, identities are revealed, scores update, and a Leaderboard ranks dinos.
**Verified:** 2026-05-30T00:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Arena shows two side-by-side answers to the same prompt from two randomly chosen dinos, identities hidden until the user votes | VERIFIED | `chat.html` lines 204-257: `@let revealed = arenaPhase() === 'voted'`; anonymous A/B headers (circle + letter) shown during streaming; `arenaPanels()` drives two side-by-side `@for` panels. `ArenaService.startBattle()` fetches matchup and fans out two parallel SSE streams. |
| 2 | After voting, both dinos are revealed and their ranking scores update | VERIFIED | `chat.html` lines 292-314: phase `voted` block reveals `dinoById(panel.dinoId)` name/mascot/species/persona + shows updated ratings from `arenaLeaderboard()`. `ArenaService.vote()` POSTs the vote then fetches `/api/arena/leaderboard` and sets the `leaderboard` signal. |
| 3 | Scores use a documented Elo-style system persisted server-side (per dino); a tie/skip option is handled | VERIFIED | `elo.ts`: JSDoc documents K=24, base=1000, formula `Ea = 1/(1+10^((Rb-Ra)/400))`, draw as Sa=Sb=0.5. `dinoRatings` pgTable in `schema.ts` with dinoId PK, rating/wins/losses/draws/games columns. `ArenaService.recordVote()` loads or seeds both ratings, applies `updateElo`, increments counters, upserts. 69 backend tests pass (15 Elo unit tests + 13 ArenaService tests + 5 ArenaController validation tests). |
| 4 | A Leaderboard tab ranks all dinos by score with wins/losses/games | VERIFIED | `activeView` signal includes `'leaderboard'`; `setActiveView('leaderboard')` calls `arenaService.loadLeaderboard()`. `chat.html` lines 318-330 render `<app-leaderboard [rows]="leaderboardRows()">`. `Leaderboard` component (`leaderboard.ts`) is OnPush/standalone with `@Input() rows: LeaderboardRow[]`; `leaderboard.html` renders rank, mascot, name, species, rating, color-coded W/L/D, and games. Exported from `@chatbot/ui`. Three Storybook stories present (`WithData`, `Empty`, `SingleRow`). |
| 5 | Everything degrades gracefully when DATABASE_URL is unset (ratings just aren't persisted) | VERIFIED | `ArenaService.getMatchup()` has no DB dependency (reads DINOS registry directly). `recordVote()` checks `if (!db)` and logs a warning then returns. `getLeaderboard()` skips DB query when `db` is null and returns all registry dinos at `DEFAULT_RATING`/0 games. Tested in 5 null-db test cases in `arena.service.spec.ts`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/app/arena/elo.ts` | Pure Elo update function (documented K-factor); exports `updateElo`, `DEFAULT_RATING`, `K_FACTOR` | VERIFIED | All three exports present; JSDoc documents every formula parameter; `MatchResult` type is `'a' \| 'b' \| 'draw'`; no default branch needed (TypeScript exhaustive switch on union type) |
| `apps/backend/src/app/arena/arena.service.ts` | Record a match result; compute new ratings; read leaderboard | VERIFIED | Three public methods: `getMatchup()`, `recordVote(vote)`, `getLeaderboard()`; Drizzle upsert with `onConflictDoUpdate`; null-db guards on all write/read paths |
| `libs/ui/src/lib/leaderboard/leaderboard.ts` | Presentational leaderboard table | VERIFIED | Standalone, OnPush, `@Input() rows: LeaderboardRow[]`; exports `Leaderboard`; re-exported from `libs/ui/src/index.ts` line 20 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `arena.controller.ts POST /api/arena/vote` | `ArenaService.recordVote -> updateElo` | `winnerDinoId/loserDinoId (or draw) -> rating deltas persisted` | WIRED | Controller validates `result` against `VALID_RESULTS` set before delegating. `recordVote` calls `updateElo(rowA.rating, rowB.rating, vote.result)` and upserts both rows via Drizzle `onConflictDoUpdate`. |
| Frontend `onArenaVote(result)` | `ArenaService.vote(aDinoId, bDinoId, result)` | Panel dinoIds extracted from `arenaPanels()` | WIRED | `chat.ts:207-213` extracts panels a/b, calls `arenaService.vote()` which POSTs to `/api/arena/vote` then fetches leaderboard |
| `setActiveView('leaderboard')` | `ArenaService.loadLeaderboard()` | `chat.ts:166-168` | WIRED | Confirmed in source |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `leaderboard.ts` | `rows: LeaderboardRow[]` | `arenaService.leaderboard` signal, populated by `GET /api/arena/leaderboard` | DB query: `db.select().from(dinoRatings)` then merged with DINOS registry | FLOWING |
| `chat.html` arena panels | `arenaPanels()` from `ArenaService.panels` signal | `ChatService.streamMessage()` SSE fan-out per panel | Real SSE stream from backend ChatService (same as groupchat pattern) | FLOWING |
| `chat.html` post-vote ratings | `arenaLeaderboard()` | `arenaService.leaderboard` signal set after `vote()` call | `GET /api/arena/leaderboard` returns live DB rows merged with registry | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend 69 tests pass | `npx nx test backend --skip-nx-cache` | `Tests 69 passed (69)` — 7 test files, 971ms | PASS |
| Backend lint clean | `npx nx lint backend --skip-nx-cache` | Exit 0, no errors | PASS |
| Elo exports present | File read `elo.ts` | `updateElo`, `DEFAULT_RATING`, `K_FACTOR` all exported at module level | PASS |
| Controller validation guards | File read `arena.controller.ts` | `VALID_RESULTS` set check, empty-string check, self-match check; throws `BadRequestException` | PASS |
| Leaderboard exported from ui | `grep Leaderboard libs/ui/src/index.ts` | `export { Leaderboard } from './lib/leaderboard/leaderboard.js'` | PASS |
| Arena + Leaderboard in activeView | File read `chat.ts:82` | `signal<'chats' \| 'explore' \| 'knowledge' \| 'groupchat' \| 'arena' \| 'leaderboard'>('chats')` | PASS |
| dinoRatings schema present | File read `schema.ts:88-96` | `pgTable('dino_ratings', {...})` with all required columns | PASS |

### Probe Execution

No probe scripts declared or found for this phase. Step 7c: SKIPPED (no probe scripts).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ARN-01 | 24-01 | Arena mode splits the screen and has two dinos answer the same prompt; dino identities are hidden until after voting | SATISFIED | `chat.html` arena view: two-column grid of anonymous panels; `revealed` gated on `arenaPhase() === 'voted'`; anonymous A/B headers shown during streaming phase |
| ARN-02 | 24-01 | The user votes for the better answer, after which both dinos are revealed | SATISFIED | Vote buttons (A better / Tie / B better) enabled when `bothDone`; on click `onArenaVote()` calls `arenaService.vote()` which sets phase to `'voted'`; template then shows `panelDino.name`, `panelDino.species`, mascot, persona |
| ARN-03 | 24-01 | Votes update a persistent dino ranking score (Elo-style or equivalent), defined and documented | SATISFIED | `elo.ts` has JSDoc documenting every parameter (K=24, base=1000, formula, draw=0.5). `dinoRatings` table persists ratings server-side. `ArenaService.recordVote()` applies `updateElo` and upserts. 15 Elo unit tests + 13 ArenaService tests confirm correctness. |
| ARN-04 | 24-01 | A Leaderboard tab ranks all dinos by their ranking score | SATISFIED | `'leaderboard'` added to `activeView`; `setActiveView('leaderboard')` triggers `loadLeaderboard()`; `<app-leaderboard [rows]="leaderboardRows()">` renders the ranked table; sorted by rating desc in `getLeaderboard()` |

All 4 required requirement IDs (ARN-01..ARN-04) are accounted for and satisfied at the code level.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No blockers found | — | — | — | — |

No `TBD`, `FIXME`, or `XXX` markers found in any arena-phase files. No empty return stubs. No hardcoded empty data arrays in rendering paths.

**Code Review Findings Disposition (from 24-REVIEW.md):**
- CR-01 (NaN ratings): FIXED in commit b1d0072 — `arena.controller.ts` validates `result` against `VALID_RESULTS` set and throws `BadRequestException`; 5 controller tests cover all invalid-input cases.
- CR-02 (non-atomic upsert): Explicitly accepted per threat model T-24-02 as portfolio-scale-acceptable. Not a gap.
- CR-03 (self-match): FIXED in commit b1d0072 — `arena.controller.ts` rejects `aDinoId === bDinoId` with `BadRequestException`; covered by controller spec.

**Pre-existing infra issues (not regressions, not gaps):**
- `@angular/build:unit-test` crashes on Angular 21 + TS 5.9: affects all frontend specs, pre-dates Phase 24.
- `@nx/enforce-module-boundaries` lint errors in `@chatbot/ui`: leaderboard follows identical `@org/shared-types` import pattern as group-response, dino-card, skill-manager — workspace-level config issue pre-dating Phase 24.

### Human Verification Required

#### 1. Arena Live Smoke Test (DB + OpenRouter key)

**Test:** With `DATABASE_URL` set and `dino_ratings` table created (run `npx drizzle-kit push`), start both dev servers (`npx nx serve backend` + `npx nx serve frontend`). Navigate to **Arena** in the sidebar. Enter a prompt and click "Start battle". Confirm two anonymous panels labeled "Dino A" and "Dino B" stream responses in parallel. Once both panels complete, click a vote button (A better / Tie / B better). Confirm both dinos are revealed with name, species, mascot, and persona shown. Confirm updated ratings appear below the panels. Navigate to **Leaderboard** and confirm the winner has a higher rating than their pre-battle rating and the loser has lower.

**Expected:** Two anonymous SSE streams complete; vote POST returns 204; both dinos are revealed; leaderboard reflects Elo delta (winner gains, loser loses, draw shifts by ~0); running 2-3 more battles causes leaderboard order to shift.

**Why human:** Requires live DATABASE_URL + OPENROUTER_API_KEY; SSE streaming behavior and visual panel layout cannot be verified statically; Elo persistence requires actual DB writes; leaderboard rank ordering after multiple battles requires live state.

#### 2. Null-DB Degradation

**Test:** Unset `DATABASE_URL`, restart the backend, then navigate to Arena in the frontend. Enter a prompt and run a battle. Vote. Navigate to Leaderboard.

**Expected:** Arena battle runs and streams correctly (no crash). Vote is silently discarded (server logs "DB unavailable — vote not persisted"). Leaderboard shows all dinos at rating 1000 / 0 games / no crash. Frontend shows no error state.

**Why human:** Requires env configuration change + server restart; live null-db code path is unit-tested but end-to-end degradation (no misleading error in UI) requires visual confirmation.

### Gaps Summary

No gaps found. All 5 must-have truths are VERIFIED at the code level. All 4 requirement IDs (ARN-01..ARN-04) are satisfied. CR-01 and CR-03 from the code review were fixed before this verification ran. The only outstanding item is Task 5 — the manual live smoke test — which is intentionally deferred to human UAT per the established pattern for this project (phases 21/22/23 each have a pending smoke test in the same position).

---

_Verified: 2026-05-30T00:30:00Z_
_Verifier: Claude (gsd-verifier)_
