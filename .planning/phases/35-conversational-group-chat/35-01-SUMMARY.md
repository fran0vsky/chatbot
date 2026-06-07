---
phase: 35-conversational-group-chat
plan: 01
subsystem: backend
tags: [group-chat, orchestrator, sse, agents, shared-types]
requires:
  - AgentsService.streamAgent (single-dino loop, reused unchanged)
  - dino registry (getDino / DINOS)
  - "@org/shared-types ChatHistoryItem"
provides:
  - GroupAgentsService (turn-based orchestrator engine)
  - GroupAgentsController (POST /api/agents/group SSE)
  - "group contracts in @org/shared-types (GroupStreamEvent et al.)"
affects:
  - apps/backend/src/app/agents/agents.module.ts
tech-stack:
  added: []
  patterns:
    - "cheap orchestrator call (gpt-4o-mini) returns a defensively-parsed JSON participation plan"
    - "concurrent Round 1 multiplexed onto one SSE stream + bounded sequential Round 2"
    - "engine-level @mention forcing decoupled from the LLM call for testability"
key-files:
  created:
    - libs/shared-types/src/lib/group.types.ts
    - apps/backend/src/app/agents/group-agents.service.ts
    - apps/backend/src/app/agents/group-agents.controller.ts
    - apps/backend/src/app/agents/group-agents.service.spec.ts
  modified:
    - libs/shared-types/src/index.ts
    - apps/backend/src/app/agents/agents.module.ts
decisions:
  - "Moved @mention forcing out of runOrchestrator into streamGroup so it is an engine-level guarantee independent of the LLM plan (also makes it unit-testable with a stubbed orchestrator)."
  - "Added a defensive round2.slice(MAX_INTER_DINO_REPLIES) clamp in streamGroup in addition to the clamp in parseOrchestratorPlan, so the cost ceiling holds regardless of plan provenance."
  - "Used `typecheck` (not a `build` target — shared-types has none) as the shared-types compile gate."
  - "tool_call_*, reasoning_token, and image StreamEvents are intentionally not surfaced in group mode; only token/done/error are re-tagged per dino."
metrics:
  duration: ~25m
  completed: 2026-06-07
  tasks: 5
  files: 6
---

# Phase 35 Plan 01: Backend Turn-Based Group Orchestrator Summary

A backend turn-based group-chat engine: one cheap `gpt-4o-mini` orchestrator call returns a defensively-parsed per-dino answer/react/silent plan; only "answer" dinos run full in-character `streamAgent` calls (Round 1 concurrent, multiplexed onto one SSE stream; Round 2 bounded + sequential), `@mentions` force a reply, and reactions cost no LLM call — all under a documented hard per-turn LLM-call ceiling of `1 + MAX_GROUP_DINOS(4) + MAX_INTER_DINO_REPLIES(2) = 7`.

## What Was Built

- **Task 1 — Group contracts** (`group.types.ts` + barrel): `DinoTurnDecision`, `GroupOrchestratorPlan`, `GroupReaction`, `GroupMessage`, `GroupChatRequest`, and the `GroupStreamEvent` discriminated union (`plan`, `dino_token`, `dino_done`, `reaction`, `dino_error`, `group_done`). Re-exported with the `.js` suffix convention.
- **Task 2 — `GroupAgentsService`**: constants (`ORCHESTRATOR_MODEL`, `MAX_GROUP_DINOS=4`, `MAX_INTER_DINO_REPLIES=2`, `HISTORY_CAP=20`); exported pure helpers `parseOrchestratorPlan` (fence-strip → JSON.parse → coerce/validate → drop unknown ids → single-emoji react → clamp round2 → all-answer fallback on garbage) and `buildAttributedHistory` (D-09 speaker-labelled history, self→assistant, others→labeled user, reactions noted, sliced to HISTORY_CAP); private `parseMentions`, `runOrchestrator` (OpenRouter ChatOpenAI on the orchestrator model, degrades to fallback plan), `applyMentionForcing`, concurrent Round 1 driver, and the `streamGroup` async generator. Reuses `AgentsService.streamAgent` verbatim per answerer (re-tagging events with `dinoId`).
- **Task 3 — `GroupAgentsController`**: HTTP-only `@Post('group')` mirroring `AgentsController.chat` (event-stream headers, abort-on-close, write loop, `finally` cleanup); validates `message` + `participantDinoIds` with `BadRequestException` before streaming.
- **Task 4 — Module wiring**: `GroupAgentsController` + `GroupAgentsService` registered in `AgentsModule`; existing `AgentsService` provider resolves into the new service.
- **Task 5 — Unit tests** (13, all green): `parseOrchestratorPlan` (clean/fenced/unknown-id/clamp/single-emoji/garbage), `buildAttributedHistory` (self→assistant, others→labeled, HISTORY_CAP), and engine routing (answer-only `streamAgent` calls, react emits a reaction with no call, @mentioned silent dino forced, round-2 cap, plan-first/group_done-last).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @mention forcing moved to engine level for testability**
- **Found during:** Task 5 — the forcing test failed because `applyMentionForcing` ran inside `runOrchestrator`, which the test stubbed to avoid hitting OpenRouter, so forcing never executed.
- **Fix:** Moved the `applyMentionForcing` call out of `runOrchestrator` and into `streamGroup` (after the orchestrator returns). This also makes forcing an engine-level guarantee that holds even when the orchestrator/fallback plan omits the forced dino. `runOrchestrator` still receives `forcedIds` to name them in the prompt.
- **Files modified:** apps/backend/src/app/agents/group-agents.service.ts
- **Commit:** 80b41c4

**2. [Rule 2 - Critical] Defensive round-2 clamp in streamGroup**
- **Found during:** Task 5 — with a stubbed plan bypassing `parseOrchestratorPlan`, an over-long `round2` would have run uncapped.
- **Fix:** Added `.slice(0, MAX_INTER_DINO_REPLIES)` to the round-2 loop in `streamGroup` so the cost ceiling (T-35-01-01 DoS mitigation) holds regardless of how the plan arrived, not only via the parser.
- **Files modified:** apps/backend/src/app/agents/group-agents.service.ts
- **Commit:** 80b41c4

### Note (not a deviation)
- The plan's verify block uses `npx nx build @org/shared-types`; that project exposes a `typecheck` target (not `build`). Used `npx nx typecheck @org/shared-types` (exit 0) as the equivalent compile gate.

## Verification

- `npx nx typecheck @org/shared-types` — exit 0 (no `build` target exists; typecheck is the compile gate)
- `npx nx run-many -t lint,build --projects=@org/backend` — green (the lone lint warning is the pre-existing `apps/frontend/src/main.ts` console.error noted in STATE.md, not from these files)
- `node apps/backend/vitest.run.mjs group-agents` — 13/13 passing
- `git diff --stat apps/backend/src/app/agents/agents.service.ts` — empty (single-dino service untouched)

## Requirements Satisfied (engine half)

- **GRP2-01** — per-dino answer/react/silent plan; only answerers call a model.
- **GRP2-02** — `@mention` forces an answer (engine-level); orchestrator prompt favors volunteered Round-2 dissent with `respondingTo`.
- **GRP2-03** — bounded sequential Round 2 (≤2) where repliers see Round-1 answers via the attributed transcript (D-09), within the documented capped per-turn budget.

(Frontend wiring + old fan-out removal is Plan 02.)

## Threat Flags

None — no new security surface beyond the threat model in the plan. The new POST endpoint validates input (T-35-01-04) and the cost ceiling is enforced (T-35-01-01).

## Self-Check: PASSED

All four created files exist on disk; all five task commits (6f51b89, c1a0597, 55169f9, 247a1b2, 80b41c4) are present in `git log`.
