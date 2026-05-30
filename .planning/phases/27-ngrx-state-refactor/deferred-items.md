# Phase 27 — Deferred / Environmental Items

| Category | Item | Status | Found |
|----------|------|--------|-------|
| Env (pre-existing) | `nx test frontend` (@angular/build:unit-test) crashes with TS `Cannot destructure property 'pos' of 'file.referencedFiles[index]'`. **Confirmed pre-existing**: the same crash reproduces on the pre-NgRx baseline (commit 2003446) after reverting all Phase 27 changes. Not introduced by this plan. | Deferred | 27-01 Task 5 |
| Env (pre-existing) | 4 locked leftover git worktrees under `.claude/worktrees/agent-*` (from prior GSD agent runs) pollute vitest test discovery (duplicate spec files). Cleaning them requires `git worktree remove --force` on locked worktrees — out of scope and destructive-git-sensitive. | Deferred | 27-01 Task 6 |
| Pre-existing warning | `libs/ui/.../message-bubble.html:79` NG8102 (`??` on non-nullable) — in the ui lib, unrelated to this plan. | Deferred | 27-01 Task 5 |

## Verification performed in lieu of the crashing `nx test` target
- `nx lint frontend` — GREEN
- `nx build frontend --configuration=development` — GREEN (stricter than test for unused-var / type errors; caught and fixed the unused HistoryService inject during Task 5)
- `action-catalogue.spec.ts` — run directly via `vitest run ... --environment jsdom`: **8/8 passing**
- `chat.spec.ts` (TestBed component spec) — compiles under the build pipeline; cannot run under bare vitest (needs Angular build resolution for @angular/animations). Same constraint as before this plan.
