---
phase: 41-autonomous-dino-minds
plan: 02
subsystem: backend/group-engine
tags: [group-chat, agents, autonomous-loop, cost-ceiling, engine-rewrite]
requires:
  - "Plan 41-01: DinoDecision + group/decision.ts (cost ceiling, prompt builder, parser, heuristic, predicates)"
  - "agents.service.ts streamAgent own-model resolution (Phase 37)"
  - "group/agent-profiles.ts getProfile (Phase 37)"
  - "dinos registry getDino().model / .imageGen"
provides:
  - "Group Engine v3 streamGroup: multi-round autonomous per-dino loop on each dino's own model"
  - "decideAction(profile, dino, state, roster, hasPriorDinoThisRound, signal): own-model DinoDecision with heuristic fallback"
  - "imageGenDecision: deterministic react-or-silent for image-gen dinos (no LLM)"
  - "buildDirective adapted to take a DinoDecision (no central topic)"
  - "lean governor.ts: ConversationState + initConversationState only"
affects:
  - "Plan 41-03 (frontend render + cost-cap docs + UAT consume this engine unchanged contract)"
tech-stack:
  added: []
  patterns:
    - "Per-dino own-model decision call (ChatOpenAI on dino.model) with try/catch+signal heuristic fallback"
    - "Multi-round loop where each completed answer is pushed to the transcript before the next dino decides (sequential thread context)"
    - "Flat cost-ceiling enforcement (per-dino cap / total cap / zero-answer-round stop / MAX_ROUNDS) replacing the governor TurnBudget"
key-files:
  created: []
  modified:
    - apps/backend/src/app/agents/group-agents.service.ts
    - apps/backend/src/app/agents/group/governor.ts
    - apps/backend/src/app/agents/group/governor.spec.ts
    - apps/backend/src/app/agents/group-agents.service.spec.ts
decisions:
  - "Round loop replaces the governor while-loop; round 0 moves @mentioned dinos to the front and forces them to answer (skipping their decision call); later rounds are pure autonomous decisions"
  - "decideAction builds a per-dino ChatOpenAI on dino.model (not a shared DIRECTOR_MODEL) and degrades to heuristicDecision on any error/abort"
  - "Image-gen dinos bypass the LLM via imageGenDecision (react with ARTIST_DEFAULT_REACTION on the latest message, else silent)"
  - "Random Phase 37 bystander reactions removed — reactions are now first-class autonomous decisions"
  - "governor.ts pruned to a lean ConversationState (transcript) + initConversationState; all central scheduling/intent/budget machinery deleted"
  - "buildDirective signature changed to (decision, profile, targetName); intent reads decision.intent ?? 'answer_user'; topicNote dropped"
metrics:
  duration: ~35m
  completed: 2026-06-17
  tasks: 4
  files: 4
---

# Phase 41 Plan 02: Group Engine v3 Autonomous Loop Summary

Rewrote `streamGroup` into the Group Engine v3 multi-round autonomous loop: the central director (topic analysis + governor speaker scheduling + intent constraints) is gone, and each round every participant dino independently makes ONE decision call on its OWN model against the full attributed thread so far, choosing answer / react / silent. Answers stream on the dino's own model and reference earlier turns from the same round; reactions pin an emoji with no generation; silences cost nothing. The Plan 01 flat cost ceiling is enforced every iteration and the existing SSE contract (empty `plan` first, interleaved events, terminating `group_done`) is unchanged so the frontend renders without modification.

## What Was Built

### Task 1 — own-model `decideAction` + `imageGenDecision` (commit 469f20f)
Added `protected async decideAction(profile, dino, state, roster, hasPriorDinoThisRound, signal): Promise<DinoDecision>`: builds a per-dino `ChatOpenAI({ model: dino.model, apiKey: OPENROUTER_API_KEY, configuration: { baseURL: openrouter } })`, renders the live attributed thread into the human turn via `buildDecisionPrompt`, invokes the dino's own model, and `parseDecision`s the output. The whole body is wrapped so any throw/abort logs via `this.logger.warn` and returns `heuristicDecision(profile, hasPriorDinoThisRound)` — a flaky free model causes a heuristic action, never a broken turn. Added `private imageGenDecision(state)` returning a react (ARTIST_DEFAULT_REACTION on the latest message) or silent when the transcript is empty, making no LLM call. Imported the Plan 01 symbols from `./group/decision`.

### Task 2 — `streamGroup` rewritten as the multi-round loop (commit 35bc31f)
Replaced the topic-analysis + governor while-loop with the D-02 round loop: for each round (≤ `MAX_ROUNDS`), iterate every roster dino; round 0 moves @mentioned dinos to the front and forces them to answer (skipping their decision call), later rounds call `decideAction` (or `imageGenDecision` for image-gen dinos). Each decision is applied — `answer` streams via the unchanged `streamAgent` call shape, emits `dino_token`/`dino_done`, and pushes the dino message onto `state.transcript` **before the next dino decides** (sequential thread context, GRP3-02); `react` emits a pinned `reaction` event; `silent` emits nothing. Caps are enforced inline (a dino at `dinoAtAnswerCap` downgrades to react/silent; the loop returns at `atTotalAnswerCap`; rounds stop on `shouldStopRounds`). Removed the central director methods (`analyzeTopic`, `heuristicTopic`, `decideIntent`, `heuristicIntent`, `directorLlm`, `parseJson`), the `DIRECTOR_MODEL`/local-`MAX_GROUP_DINOS`/bystander constants, and the random bystander-reaction block. Adapted `buildDirective` to take a `DinoDecision`. Lint and build both green.

### Task 3 — pruned the governor (commit d6658ad)
Reduced `group/governor.ts` to a lean `ConversationState { transcript; topic? }` + `initConversationState(history, topic?)` — the only surface v3 imports. Deleted all central scheduling/intent/budget machinery: `pickNextSpeaker`, `scoreSpeaker`, `eligibleSpeakers`, `allowedIntents`, `validateIntent`, `resolveTarget`, `expertiseMatch`, `topicHitsWeakArea`, `recordTurn`, `recordSilence`, `canContinue`, `lastDinoMessage`, `TurnBudget`, `defaultBudget`, `IntentDecision`. Rewrote `governor.spec.ts` to cover only the surviving seeder (copy semantics, no source mutation). This also resolved the pre-existing `'TurnBudget' is defined but never used` lint error flagged in Plan 01.

### Task 4 — v3 engine unit coverage (commit 4eaf987)
Rewrote `group-agents.service.spec.ts` for the autonomous loop, stubbing the `decideAction` seam (per-dino decision factory) and `agentsService.streamAgent`. Tests assert: every participant dino is consulted once in round 0 (no pre-selection); `answer`→`dino_token`/`dino_done`+transcript push routed through the dino's own id, `react`→a `reaction` event with no generation, `silent`→nothing; each answer is pushed before the next dino decides (the consult sees 0,1,2 prior dino messages); an @mention forces a round-0 answer skipping the decision call; image-gen dinos react and never generate; the cost ceiling holds (`answers ≤ MAX_TOTAL_ANSWERS`, `decisions ≤ MAX_GROUP_DINOS × MAX_ROUNDS`); a zero-answer round stops the loop; the stream starts with `plan` and ends with `group_done`. Also updated the `buildDirective` tests to the new `DinoDecision` signature.

## Verification

- `npx nx lint @org/backend --quiet` → exit 0 (clean; pre-existing TurnBudget error resolved).
- `npx nx build @org/backend --skip-nx-cache` → webpack compiled successfully.
- `npx nx test @org/backend --skip-nx-cache` → **14 files, 154 tests passed**.
- Grep confirms `pickNextSpeaker`, `analyzeTopic`, `decideIntent`, `DIRECTOR_MODEL` no longer appear in `group-agents.service.ts` (0 matches).

## Deviations from Plan

None — the plan executed exactly as written across all four tasks. (Task 3's grep/lint also cleared the pre-existing TurnBudget lint error noted in Plan 01's deferred items, as the plan anticipated.)

## Deferred Issues

None new. `frontend` test target was not run (out of scope; known to crash locally at bundle generation per project memory). End-to-end GRP3-02/03 observable verification is Plan 03 UAT.

## Known Stubs

None. The engine is fully wired: real per-dino own-model decision calls, real own-model answer generation, real cost-ceiling enforcement. No placeholder data paths.

## Self-Check: PASSED

- Files exist: group-agents.service.ts (FOUND), group/governor.ts (FOUND), group/governor.spec.ts (FOUND), group-agents.service.spec.ts (FOUND).
- Commits exist: 469f20f (FOUND), 35bc31f (FOUND), d6658ad (FOUND), 4eaf987 (FOUND).
