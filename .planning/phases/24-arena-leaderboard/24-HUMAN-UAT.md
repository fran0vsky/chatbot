---
status: partial
phase: 24-arena-leaderboard
source: [24-VERIFICATION.md]
started: "2026-05-30T00:00:00Z"
updated: "2026-05-30T00:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Arena smoke test with live DB + key
expected: With `DATABASE_URL` + `OPENROUTER_API_KEY` set and the `dino_ratings` table pushed (`npx drizzle-kit push`): open Arena, enter a prompt, two anonymous panels (A/B) stream in parallel with identities hidden; once both finish, cast a vote; both dinos reveal (name + mascot + persona) and updated ratings show; the Leaderboard tab reflects the result (winner up, loser down); running 2–3 battles updates the leaderboard cumulatively and ratings persist in the real DB.
result: [pending]

### 2. Null-DB degradation
expected: With `DATABASE_URL` unset, restart backend → Arena still runs (prompt → stream → vote works); Leaderboard shows all dinos at rating 1000 with 0 games; no crash and no misleading UI error.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
