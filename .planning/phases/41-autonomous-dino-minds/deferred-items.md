# Phase 41 — Deferred / Out-of-Scope Items

| Item | Where | Why deferred | Found in |
|------|-------|--------------|----------|
| Pre-existing lint error: `'TurnBudget' is defined but never used` | `apps/backend/src/app/agents/group-agents.service.ts:20` | Pre-existing (introduced Phase 37 commit e607473); this file is NOT touched by Plan 41-01. It will be cleaned up in Plan 02 when `streamGroup`/the governor imports are rewritten. Out of scope per the executor scope boundary. | 41-01 Task 2 lint run |
