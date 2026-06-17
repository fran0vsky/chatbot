---
phase: 41-autonomous-dino-minds
plan: 01
subsystem: backend/group-engine
tags: [group-chat, agents, decision-primitive, cost-ceiling, shared-types]
requires:
  - "@org/shared-types SpeechIntent + AgentProfile (Phase 37)"
  - "group/agent-profiles.ts AGENT_PROFILES (Phase 37)"
provides:
  - "DinoDecision shared type (autonomous per-dino decision output)"
  - "group/decision.ts: v3 cost-ceiling constants, buildDecisionPrompt, parseDecision, heuristicDecision, RoundCounters predicates"
affects:
  - "Plan 41-02 (streamGroup rewrite consumes this module)"
tech-stack:
  added: []
  patterns:
    - "Pure, LLM-free, exported + unit-tested module (mirrors group/governor.ts)"
    - "Tolerant fence-stripping JSON parse that never throws (mirrors GroupAgentsService.parseJson)"
key-files:
  created:
    - apps/backend/src/app/agents/group/decision.ts
    - apps/backend/src/app/agents/group/decision.spec.ts
  modified:
    - libs/shared-types/src/lib/group.types.ts
decisions:
  - "DinoDecision lives in group.types.ts next to DinoTurnDecision; reuses SpeechIntent; documents Phase 35 orchestrator-plan types as v3-vestigial"
  - "Cost ceiling is flat exported constants (MAX_GROUP_DINOS=4, MAX_ROUNDS=3, MAX_ANSWERS_PER_DINO=2, MAX_TOTAL_ANSWERS=8) replacing the governor TurnBudget"
  - "buildDecisionPrompt returns pure {system,human} strings (no Message objects) so it stays testable"
  - "parseDecision: unknown action→silent, react-without-emoji→silent, unknown answer intent→answer_user, confidence clamped, never throws"
  - "shouldStopRounds(roundIndex, answersThisRound) → true when answersThisRound===0 OR roundIndex+1>=MAX_ROUNDS"
metrics:
  duration: ~12m
  completed: 2026-06-17
  tasks: 3
  files: 3
---

# Phase 41 Plan 01: Autonomous Decision Primitive Summary

The LLM-free foundation of Group Engine v3: a shared `DinoDecision` type plus a pure, unit-tested `group/decision.ts` module owning the v3 flat cost ceiling, a persona decision-prompt builder, a tolerant (never-throwing) decision parser, a deterministic bias-driven heuristic fallback, and the round/cost-control predicates — wired into nothing yet, ready for Plan 02 to drive `streamGroup`.

## What Was Built

### Task 1 — `DinoDecision` shared type (commit 4727904)
Added `export interface DinoDecision { action: 'answer'|'react'|'silent'; intent?: SpeechIntent; emoji?; replyToMessageId?; replyToAgentId?; confidence? }` to `libs/shared-types/src/lib/group.types.ts`, reusing the already-imported `SpeechIntent`. Field-level comments document that `intent` applies only to `answer`, `emoji` only to `react`. A header doc comment notes this supersedes the Phase 35 `DinoTurnDecision`/`GroupOrchestratorPlan` for decision-making (those stay only for the still-emitted empty `plan` SSE event).

### Task 2 — `group/decision.ts` pure module (commit 419d1f9)
Mirrors `group/governor.ts` (pure, LLM-free, exported functions). Provides:
- **Cost ceiling constants:** `MAX_GROUP_DINOS=4`, `MAX_ROUNDS=3`, `MAX_ANSWERS_PER_DINO=2`, `MAX_TOTAL_ANSWERS=8`.
- **`buildDecisionPrompt(profile, attributedThreadText, hasPriorDinoThisRound)`** → `{ system, human }` strings; establishes the dino fully in persona, demands exactly one action and (for answer) its own `SpeechIntent` stance, returns ONLY JSON.
- **`parseDecision(raw)`** → validated `DinoDecision`; strips ``` fences (copied from `GroupAgentsService.parseJson`), validates/clamps, never throws (failure → `{ action: 'silent', confidence: 0 }`).
- **`heuristicDecision(profile, hasPriorDinoThisRound)`** → deterministic fallback from `interactionBiases` (modeled on Phase 37 `heuristicIntent`); always a valid shape.
- **`RoundCounters` + `initRoundCounters`, `recordAnswer`, `dinoAtAnswerCap`, `atTotalAnswerCap`, `shouldStopRounds`** plus an exported `clamp01`.

### Task 3 — `decision.spec.ts` unit tests (commit 0e51466)
Covers `parseDecision` tolerance (fenced, plain, garbage→silent, react-without-emoji→silent, unknown action→silent, unknown intent→answer_user, confidence clamp, replyTo* preservation), `heuristicDecision` validity across talkative and reticent profiles (incl. an exhaustive "emoji present iff react" sweep over all `AGENT_PROFILES`), and all three cost/round predicates at their boundaries. Uses real `AGENT_PROFILES` fixtures.

## Verification

- `npx eslint apps/backend/src/app/agents/group/decision.ts` → exit 0 (clean).
- `npx nx test @org/backend --skip-nx-cache` → **14 files, 166 tests passed** (includes the new `decision.spec.ts`).

## Deviations from Plan

None for the in-scope work — the plan executed exactly as written across all three tasks.

## Deferred Issues

- **Pre-existing lint error (out of scope):** `npx nx lint @org/backend` reports `'TurnBudget' is defined but never used` at `apps/backend/src/app/agents/group-agents.service.ts:20`. This file is NOT touched by Plan 41-01; the error was introduced in Phase 37 (commit e607473). Linting the new `decision.ts` in isolation is clean. The unused import will be removed naturally in Plan 02 when `streamGroup` and the governor imports are rewritten. Logged to `deferred-items.md`.

## Known Stubs

None. This plan only adds pure primitives (no UI, no data-flow). The module is deliberately not yet wired into `streamGroup` — that is Plan 02's scope, as designed.

## Self-Check: PASSED

- Files exist: `libs/shared-types/src/lib/group.types.ts` (FOUND), `apps/backend/src/app/agents/group/decision.ts` (FOUND), `apps/backend/src/app/agents/group/decision.spec.ts` (FOUND).
- Commits exist: 4727904 (FOUND), 419d1f9 (FOUND), 0e51466 (FOUND).
