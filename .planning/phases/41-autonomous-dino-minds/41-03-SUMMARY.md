---
phase: 41-autonomous-dino-minds
plan: 03
subsystem: frontend/group-chat + docs
tags: [group-chat, v3, frontend-render, cost-ceiling, legacy-types, human-uat]
requires:
  - "Plan 41-01: DinoDecision + group/decision.ts cost-ceiling constants"
  - "Plan 41-02: streamGroup v3 multi-round autonomous loop (unchanged SSE contract)"
provides:
  - "Frontend v3 regression test proving empty-plan + ordered answers + targeted reaction render correctly"
  - "Legacy @deprecated annotations on DinoTurnDecision/GroupOrchestratorPlan"
  - "Expanded cost-ceiling doc in decision.ts (worst-case call count, replaces governor TurnBudget)"
  - "41-HUMAN-UAT.md observable acceptance script for GRP3-01/02/03 + cost ceiling"
affects:
  - "Phase 41 verification (Success Criterion #3 GRP3-03 + #4 cost-ceiling doc half)"
tech-stack:
  added: []
  patterns:
    - "Scripted async-generator SSE-event test driving applyEvent against a v3 sequence (Vitest + TestBed)"
key-files:
  created:
    - .planning/phases/41-autonomous-dino-minds/41-HUMAN-UAT.md
  modified:
    - apps/frontend/src/app/chat/groupchat.service.spec.ts
    - libs/shared-types/src/lib/group.types.ts
    - apps/backend/src/app/agents/group/decision.ts
    - .planning/phases/41-autonomous-dino-minds/deferred-items.md
decisions:
  - "No groupchat.service.ts patch needed: applyEvent already returns early on empty plan (L281) and creates slots dynamically from dino_token — the v3 stream renders unchanged (D-01 confirmed)"
  - "@deprecated JSDoc (not deletion) on DinoTurnDecision/GroupOrchestratorPlan — kept solely for the empty `plan` SSE event (D-02)"
  - "Cost-ceiling doc states worst-case 4×3=12 decision calls + ≤8 answer calls and that it replaces the Phase 37 governor TurnBudget (D-03)"
  - "HUMAN-UAT covers GRP3-01/02/03 + cost ceiling + single-dino/Arena regression, on localhost AND live site (D-04)"
metrics:
  duration: ~10m
  completed: 2026-06-17
  tasks: 3
  files: 5
---

# Phase 41 Plan 03: Frontend v3 Render Proof, Legacy Marking & Human UAT Summary

Closed Group Engine v3: proved (with a regression test) that the frontend renders the v3 autonomous stream unchanged, annotated the now-legacy Phase 35 orchestrator-plan types, expanded the cost-ceiling documentation that replaces the Phase 37 governor budget, and wrote the human UAT script proving GRP3-01/02/03 end-to-end. The full workspace gate is green except the pre-existing `frontend:test` bundle crash (environment bug, not this plan).

## What Was Built

### Task 1 — v3 frontend render proof (commit da64013)
Added a scripted v3-sequence test to `groupchat.service.spec.ts` driving `applyEvent` through: empty `plan{round1:[],round2:[]}` → `dino_token`/`dino_done`(rex, intent answer_user) → `dino_token`/`dino_done`(philo, replyToAgentId=rex, replyToMessageId=s-rex, intent disagree_with_agent) → `reaction`(glyphos targets philo's s-philo) → `group_done`. Asserts: the empty plan creates NO premature slots; the two answers render in arrival order (rex before philo); overall transcript is `[user, dino, dino]`; philo carries its reply metadata and intent chip source; glyphos's reaction is a chip on philo (matched by `serverMessageId`) adding no extra line; `streaming === false` at the end.

**No service patch was required.** Confirmed `applyEvent`'s `plan` case returns early when `answerers.length === 0` (L281), and `appendToken`/`finalizeDino` create slots dynamically via `findOpenSlot` — so the v3 empty-plan stream is already handled (D-01 validated). The test stands as the regression guard against any future empty-plan mishandling (mitigates T-41-03-01).

### Task 2 — legacy markers + cost-ceiling doc (commit 8516238)
- `group.types.ts`: added `@deprecated` JSDoc blocks above `DinoTurnDecision` and `GroupOrchestratorPlan` stating they are the Phase 35 orchestrator-plan contract, superseded by the autonomous `DinoDecision` (v3), and retained ONLY for the still-emitted empty `plan` SSE event (D-02). Types not deleted (the `plan` event + frontend still reference `GroupOrchestratorPlan`).
- `decision.ts`: expanded the cost-ceiling comment to spell out the worst-case LLM-call count (decision ≤ MAX_GROUP_DINOS × MAX_ROUNDS = 4×3 = 12; answers ≤ MAX_TOTAL_ANSWERS = 8; ≤20 absolute worst case with early `shouldStopRounds` termination) and that these flat caps REPLACE the Phase 37 governor `TurnBudget`/`defaultBudget` (D-03, Success Criterion #4 doc half).

### Task 3 — HUMAN-UAT + full gate (commit 3cf9a48)
Created `41-HUMAN-UAT.md` with 5 observable PENDING checks: GRP3-01 (independent per-dino own-model decisions, no fixed "everyone answers" pattern, one decision call per dino in logs), GRP3-02 (a later dino visibly references an earlier dino's turn + cross-round inter-dino replies with attribution), GRP3-03 (mixed answers/reaction chips/silences rendered top-to-bottom with name+mascot attribution and intent chips), cost ceiling + @mention forcing, and single-dino/Arena regression. Instructed to run on both localhost and https://dinoagents.duckdns.org (v2.2 parity). Logged two gate deviations to `deferred-items.md`.

## Verification

- Task 1: `npx nx lint frontend` → 0 errors (1 pre-existing `main.ts` console warning). Spec is type-sound and lint-clean.
- Task 2: `npx nx run-many -t lint,build --projects=@org/backend,frontend` → backend webpack compiled successfully + lint 0 errors; frontend lint+build succeeded.
- Task 3: `npx nx test @org/backend` → **14 files, 154 tests passed**. Frontend lint+build green. `frontend:test` fails on the pre-existing bundle-generation crash only.

## Deviations from Plan

### Process deviations (no code impact)

**1. [Rule 3 — Blocking] Plan verify commands use `@org/frontend`; correct id is `frontend`**
- **Found during:** Task 2/3 gate runs.
- **Issue:** `npx nx ... --projects=@org/frontend` resolves to no project (`No tasks were run`), so frontend was never linted/built/tested by the plan's literal commands.
- **Fix:** Re-ran all frontend targets with `--projects=frontend` (the real Nx id, per STATE.md). Logged to `deferred-items.md`.
- **Files modified:** none (command-level only).

**2. [Documented gate exception] `frontend:test` runner crash**
- **Found during:** Task 1 & Task 3 test runs.
- **Issue:** `nx test frontend` crashes at esbuild/TS bundle generation (`getReferencedFileLocation` `referencedFiles`/`pos`) — a pre-existing Windows environment bug (STATE.md, since Phase 27/35), reproducing on baseline and on unrelated `libs/ui` rootDir resolution.
- **Resolution:** Not caused by 41-03. Validated the new spec via lint (clean) instead. Test stands as the CI regression guard. Logged to `deferred-items.md`. Per `environment_notes`, this is noted rather than treated as a failure.

No code-behavior deviations — `groupchat.service.ts` needed no patch (D-01 held).

## Deferred Issues

- `frontend:test` cannot run locally (pre-existing env bug). The v3 spec is unverified-by-execution here but lint-clean and type-sound; CI will execute it.

## Known Stubs

None. This plan adds a test, doc comments, and a UAT script — no data-flow or UI stubs.

## Self-Check: PASSED

- Files exist: `41-HUMAN-UAT.md` (FOUND), `groupchat.service.spec.ts` (FOUND), `group.types.ts` (FOUND), `decision.ts` (FOUND), `deferred-items.md` (FOUND).
- Commits exist: da64013 (FOUND), 8516238 (FOUND), 3cf9a48 (FOUND).
