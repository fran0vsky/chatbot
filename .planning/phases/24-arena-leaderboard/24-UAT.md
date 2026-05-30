---
status: testing
phase: 24-arena-leaderboard
source: [24-01-SUMMARY.md, 24-VERIFICATION.md, 24-HUMAN-UAT.md]
started: "2026-05-30T00:00:00Z"
updated: "2026-05-30T00:00:00Z"
---

## Current Test

number: 1
name: Arena battle with live DB + key
expected: |
  With DATABASE_URL + OPENROUTER_API_KEY set and the dino_ratings table pushed
  (npx drizzle-kit push), start the backend + frontend fresh. Open Arena, enter a
  prompt, click Start battle. Two anonymous panels (A / B) stream answers in
  parallel with identities hidden. Once both finish, the vote buttons enable; cast
  a vote. Both dinos reveal (name + mascot) and updated ratings show. Open the
  Leaderboard tab — the winner moved up, the loser down. Run 2–3 more battles and
  confirm the leaderboard updates cumulatively (ratings persist in the real DB).
awaiting: user response

## Tests

### 1. Arena battle with live DB + key
expected: With DATABASE_URL + OPENROUTER_API_KEY set and dino_ratings pushed, fresh boot of backend+frontend; Arena streams two anonymous panels in parallel, identities hidden until a vote; voting reveals both dinos + updated ratings; Leaderboard reflects results and persists across multiple battles.
result: [pending]

### 2. Null-DB graceful degradation
expected: With DATABASE_URL unset, restart the backend. Arena still runs (prompt → stream → vote works); the Leaderboard tab shows all dinos at rating 1000 with 0 games; no crash and no misleading error in the UI.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

[none yet]
