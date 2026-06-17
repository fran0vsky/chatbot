# Phase 41 — Deferred / Out-of-Scope Items

| Item | Where | Why deferred | Found in |
|------|-------|--------------|----------|
| Pre-existing lint error: `'TurnBudget' is defined but never used` | `apps/backend/src/app/agents/group-agents.service.ts:20` | Pre-existing (introduced Phase 37 commit e607473); this file is NOT touched by Plan 41-01. It will be cleaned up in Plan 02 when `streamGroup`/the governor imports are rewritten. Out of scope per the executor scope boundary. | 41-01 Task 2 lint run |
| `frontend:test` runner crashes at bundle generation | Nx + esbuild/TS `getReferencedFileLocation` (`referencedFiles`/`pos`) on this Windows env | Pre-existing environment bug (documented in STATE.md since Phase 27/35); reproduces on the pre-change baseline and on unrelated `libs/ui` rootDir resolution. Not caused by 41-03. The new v3 spec is lint-clean and type-sound but cannot be executed locally; it stands as the CI regression guard. | 41-03 Task 1/3 test run |
| Plan verify commands reference `@org/frontend` | `41-03-PLAN.md` verify blocks | The frontend Nx project id is `frontend` (not `@org/frontend`), per STATE.md. `@org/frontend` resolves to no project (`No tasks were run`). Used `frontend` for all frontend lint/build/test runs. Doc-only mismatch in the plan. | 41-03 gate runs |
