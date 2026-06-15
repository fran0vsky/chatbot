# Phase 41: Autonomous Dino Minds (Group Engine v3) - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Source:** Direct planning Q&A (no discuss-phase agent) + Phase 37 code read

<domain>
## Phase Boundary

Refactor the group-chat engine (Phase 37 "Intent-Driven Group Engine") into **Group Engine v3**:
every participant dino is an independent mind. On each incoming user message, EVERY participant
dino makes its **own** decision call **on its own registered model** with its own persona, choosing
`answer` / `react` (emoji) / `silent`. There is **no central director** pre-selecting who speaks.
Every decision and every generated answer receives the user message + the full thread so far
(including other dinos' turns from the current round), so a dino can react to what another dino just
said. One user turn yields any mix of answers, reactions, and silences, rendered top-to-bottom with
attribution.

**In scope:** per-dino autonomous decision architecture, thread-context plumbing for every call,
multi-round threading, a documented cost ceiling replacing the Phase 37 governor budget, removal of
central speaker pre-selection + central topic analysis.

**Out of scope:** when-to-react configuration UI (Phase 43); custom dinos (Phase 42); any DB/schema
change (group chat is stateless per request, persisted client-side); changing the SSE event contract
beyond what the new engine needs (reuse existing `GroupStreamEvent` shapes).
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Turn structure — Multi-round threaded (user-confirmed)
- **Round 1:** every participant dino, in roster/selection order, makes one decision call and acts.
  Each dino's decision + answer sees the user message + all dinos who already went **this round**.
- **Follow-up rounds:** after Round 1, run bounded follow-up rounds (cap `MAX_ROUNDS`) where each dino
  again gets a decision call against the full updated thread and may answer/react/silent in response to
  another dino. This is what makes it read like a real thread.
- Terminate early when a whole round produces **zero answers** (everyone reacted or stayed silent) —
  the conversation has nothing more to add.

### Decision-call model — Own model, faithful (user-confirmed)
- Each dino's `answer/react/silent` decision call runs on **that dino's registered model**
  (`getDino(id).model`), not a shared cheap director model. This matches GRP3-01 and the mentor note
  ("każdy dino musi wykonać zapytanie do swojego modelu").
- The answer generation (when the decision is `answer`) runs on the same own model via the existing
  `agentsService.streamAgent(..., dinoId, ...)` path (which already resolves `dino.model`).
- Decision prompt is a tiny JSON-returning classification prompt → cheap even on a larger own model.

### What survives from the Phase 37 governor (scope note: "anti-chaos caps stay; speaker pre-selection goes")
- **GOES:** `pickNextSpeaker` / `scoreSpeaker` / `eligibleSpeakers` (central speaker scheduling),
  `analyzeTopic` / `heuristicTopic` / `TopicAnalysis` central director pre-analysis,
  `allowedIntents` / `validateIntent` intent-constraint machinery, the cheap shared `DIRECTOR_MODEL`.
- **STAYS (as a lean cost ceiling):** per-dino answer cap (anti-monologue), consecutive-silence /
  zero-answer-round termination, `MAX_GROUP_DINOS = 4`, a hard total-answer ceiling.

### Cost ceiling (replaces governor `TurnBudget`) — documented constants
- `MAX_GROUP_DINOS = 4` (unchanged)
- `MAX_ROUNDS = 3` (Round 1 + up to 2 follow-up rounds)
- `MAX_ANSWERS_PER_DINO = 2` (anti-monologue)
- `MAX_TOTAL_ANSWERS = 8` (hard generation ceiling — keeps worst-case near the old `1+4+3` budget)
- Worst-case calls per user turn ≈ (4 dinos × 3 rounds) decision calls + 8 answer calls.

### Decision shape & UI continuity
- New `DinoDecision { action: 'answer'|'react'|'silent'; intent?: SpeechIntent; emoji?; replyToMessageId?;
  replyToAgentId?; confidence? }`. For `answer`, the dino also picks its **own** stance (`intent`,
  reusing the existing `SpeechIntent` vocabulary) so the Phase 37 intent chips keep working — the dino
  decides its stance itself instead of a director assigning it.
- Reuse existing SSE events unchanged: `dino_token`, `dino_done` (carries `intent`/`replyTo*`),
  `reaction`, `dino_error`, `group_done`. The `plan` event stays emitted (empty) for contract stability;
  the frontend already creates slots dynamically from `dino_token`.

### Image-gen dino (Vinci) exception
- Vinci's registered model is an image model and cannot return a JSON text decision. Image-gen dinos
  skip the LLM decision and deterministically take the `react` (default artist emoji) or `silent` path,
  as in Phase 37. Documented as a known, intentional exception to "decision on own model".
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Group engine (the code being refactored)
- `apps/backend/src/app/agents/group-agents.service.ts` — Phase 37 engine: `streamGroup` loop,
  `analyzeTopic`, `decideIntent`, `buildAttributedHistory`, `buildDirective`, bystander reactions,
  image-gen react path, cost-ceiling comment block (L33-42).
- `apps/backend/src/app/agents/group/governor.ts` — pure governor: `TurnBudget`, `ConversationState`,
  `pickNextSpeaker`, `scoreSpeaker`, `allowedIntents`, `validateIntent`, `recordTurn`, `recordSilence`,
  `canContinue`. Most of this is pruned/replaced in v3.
- `apps/backend/src/app/agents/group/agent-profiles.ts` — `AGENT_PROFILES` (persona/expertise/biases),
  `getProfile` fallback. Personas still feed the per-dino decision prompt + heuristic fallback.
- `apps/backend/src/app/agents/group-agents.controller.ts` — SSE bridge (`POST /api/agents/group`),
  forwards any `GroupStreamEvent`. No change expected.

### Contracts & per-dino model resolution
- `libs/shared-types/src/lib/group.types.ts` — `GroupMessage`, `GroupStreamEvent` union, `DinoTurnDecision`,
  `GroupOrchestratorPlan`. Add `DinoDecision`; document the `plan`/orchestrator-plan types as v3-vestigial.
- `libs/shared-types/src/lib/group-social.ts` — `SpeechIntent`, `isTargetedIntent`, `AgentProfile`,
  `TopicAnalysis` (TopicAnalysis becomes unused after v3).
- `apps/backend/src/app/agents/agents.service.ts` — `streamAgent(message, threadId, model, signal,
  enabledTools, dinoId, userId, history, imageDataUrl, directive)`: when `dinoId` is set it resolves
  `dino.model`, system prompt, tool ceiling server-side. The answer path reuses this unchanged.
- `apps/backend/src/app/agents/dinos/dinos.ts` — dino registry: ids + models (rexford/veloce/glyphos/
  nimbus/iris text models; vinci `imageGen: true`).

### Frontend consumer (rendering must keep working)
- `apps/frontend/src/app/chat/groupchat.service.ts` — `applyEvent` routing: `plan` (creates Round-1
  slots), `dino_token`/`dino_done`, `reaction` (pins chip), `dino_error`, `group_done`. Slots are also
  created dynamically on `dino_token` for turns with no pre-created slot.

### Project rules
- `apps/backend/CLAUDE.md` — `process.env['VAR']`, no `any`, NestJS `Logger`, never let a side-channel
  break the chat (degrade to heuristic/silent).
- `apps/frontend/CLAUDE.md` — standalone OnPush components, Tailwind only, types from `@org/shared-types`.
</canonical_refs>

<specifics>
## Specific Ideas
- Mentor note (raw): "wpada wiadomość → każdy dino musi wykonać zapytanie do swojego modelu — dostaje
  message i wybiera rodzaj odpowiedzi: answer, reaction i no answer" · "dino odpowiadają w formie wątku —
  moja wiadomość + wątek mają brać pod uwagę przed każdą kolejną akcją".
- Every per-dino decision + answer call MUST be passed the attributed thread built from the live
  `state.transcript` (so it includes the current round's earlier turns), via the existing
  `buildAttributedHistory`.
- Observable proof of GRP3-02: a later dino's reply visibly references an earlier dino's turn in the
  same user turn.
</specifics>

<deferred>
## Deferred Ideas
- When-to-react / when-to-answer per-dino configuration → Phase 43.
- Custom dinos joining the engine → Phase 42 (the v3 engine must remain registry-driven so custom dinos
  plug in by resolving the same `getDino`/`getProfile` interfaces).
</deferred>

---

*Phase: 41-autonomous-dino-minds*
*Context gathered: 2026-06-12 via direct planning Q&A*
