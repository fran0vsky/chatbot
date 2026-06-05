# Phase 35: Conversational Group Chat - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing **parallel fan-out** groupchat (Phase 23) with a **turn-based, real-chat group conversation**. On each user message, every selected dino independently **answers / emoji-reacts / stays silent**; an `@mention` forces a reply; dinos can reply to each other within bounded turns; and the whole thread reads top-to-bottom with clear per-dino attribution and **persists in the history panel** (today's groupchat is ephemeral).

**In scope:** turn-based orchestrator/router (per-dino speak/react/silent decision), directed-mention forcing, bounded inter-dino dialogue, emoji reactions, persisted group threads, removal of the old parallel fan-out.
**Out of scope:** the old `GroupchatService` parallel fan-out (removed, **no fallback**); DB-backed group persistence; context summarization; per-turn cost dashboards. Loop bounds + cost caps are designed in this phase, building on the Phase 23 `MAX_DINOS = 4` cap.

</domain>

<decisions>
## Implementation Decisions

### Turn Engine (participation + ordering)
- **D-01 — Central orchestrator (user delegated; "do what's best for the project / mentor's intent").** A single **cheap orchestrator call** (reuse the existing `gpt-4o-mini` paid-fallback model) sees the user message + participant roster + recent transcript and returns a **structured plan**: which dinos answer, which emoji-react (+ which emoji + target message), which stay silent, and the speaking order. Then **only the "answer" dinos** make full in-character calls on their own registry models. Chosen over per-dino router pre-calls and inline per-dino calls because it **minimizes free-model hits** (silent/reacting dinos never burn a free-model call → fewer 429s), gives **central control** to enforce turn order and loop bounds, and keeps cost **deterministic**. Trade-off accepted: the speak/silent choice is not made "in character," but the actual replies fully are.
- **D-02 — One bounded inter-dino follow-up round.** Round 1: selected dinos answer the user. Round 2: the orchestrator may pick **up to a couple of dinos** to react/reply to what was just said, then the turn ends. A **hard cap on inter-dino calls per user message** bounds cost (chosen over N-bounded rounds for cost/429 safety; "no inter-dino" was rejected — it fails success criterion #3).
- **D-03 — Hybrid streaming/ordering.** Round 1 (answering the user): answerers **stream concurrently** but **render top-to-bottom in the orchestrator's chosen order** (fast, like today's UX). Round 2 (inter-dino): **sequential**, so a replying dino actually sees the message it reacts to. Balances latency against coherence (vs fully-sequential = too slow; fully-concurrent = dinos can't genuinely reference each other).

### Addressing (@mention)
- **D-04 — Typed `@` with autocomplete.** Typing `@` in the composer opens an autocomplete dropdown of the **current participant dinos** (filter by name) and inserts a styled mention token. An `@mention` **forces** that dino to reply (overrides the orchestrator's silent/react choice). Familiar Slack/Discord pattern; scales past the small roster; keyboard-friendly.
- **D-05 — Dino-to-dino mentions are a SOFT signal (between "forces" and "flavor").** The orchestrator's participation rule **actively favors a non-addressed dino volunteering** when it has a **genuinely different take, a disagreement, or a useful addition** — in which case it speaks **unasked** in the inter-dino round and **names the dino it is responding to / differing with**. If a dino has nothing distinct to add, it **stays silent** rather than echoing. Stronger than pure flavor (orchestrator hunts for dissent/additions), weaker than a guaranteed forced reply. *(Reflects user's recalled mentor note: "if a dino has a different view or his own thoughts, he should mention that and give his response unasked.")* Maps directly to success criterion #2 ("a non-addressed but competent dino may volunteer a reply or add to the addressed dino's answer").

### Emoji Reactions
- **D-06 — Reaction = chip pinned to the reacted message.** When a dino reacts, the emoji renders as a **small chip on the specific message** it reacts to (the user's message OR another dino's reply), showing the reacting dino's mascot + emoji. Keeps the transcript clean and clearly binds the reaction to its target (vs its-own-line, which doesn't bind; vs both/configurable, which is two patterns to maintain).
- **D-07 — One action per dino per round; single emoji.** Each round a dino does **exactly one** of: answer, react (a **single** emoji), or stay silent. The roadmap's "a reply + an emoji reaction" mix arises **across dinos** (one replies, another reacts) and across the two rounds — not within one dino's single action. Keeps the orchestrator's structured output simple and cost accounting bounded.

### Persistence & Continuation
- **D-08 — Single interleaved localStorage session.** One `ConversationSession` in localStorage (the **same store as normal chats** — `history.service.ts`, per the Phase 32 finding that chat history is localStorage-only, DB tables unused) holds an **ordered, attributed message list**; each message carries its `dinoId`/`role` plus any reactions. The **participant roster** is saved on the session so it reopens correctly. No DB change, no migration (rejected per-dino sub-threads — fights the turn-based model; rejected DB tables — unneeded for MVP).
- **D-09 — Each answering dino receives the FULL attributed transcript on follow-up turns.** The whole interleaved group history is formatted with **speaker labels** (e.g. `Glyphos: …`, `User: …`, reactions noted) and fed to each answering dino via the existing **client `history` array** channel (stateless loop, Phase 32). So dinos remember what everyone said and stay coherent across turns. Token cost is bounded by the existing **20-turn `HISTORY_CAP`** + the Phase 32 context ring (rejected own-messages-only = dinos forget peers; rejected summarization = extra call + fidelity loss, unneeded at HISTORY_CAP scale).

### Claude's Discretion (within the locked directions above)
- The exact orchestrator **prompt + structured-output schema** (the decision JSON: per-dino action, emoji, target message id, order, dino-mentions).
- The precise **hard caps**: how many dinos may volunteer in round 2, and the per-turn inter-dino call ceiling (build on `MAX_DINOS = 4`; keep total LLM calls per user message bounded and documented per the roadmap scope note).
- Exact **emoji set/allow-list** (or free emoji), chip hover/affordance details, mention-token styling, and autocomplete interaction details.
- How the composer **enters/exits group mode** and how a persisted group thread is **visually distinguished** in the history panel (e.g. participant-mascot cluster + group icon).
- The exact **transcript attribution format** sent to models in D-09, and whether reactions are rendered into that text or summarized.
- Mechanics of **removing the old parallel fan-out** (`GroupchatService`, `group-response` usage) without regressing single-dino chat.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` § "Phase 35: Conversational Group Chat (supersedes Phase 23)" — goal, requirements GRP2-01..04, 4 success criteria, and the in/out scope note (loop bounds + cost caps designed in-phase, build on `MAX_DINOS = 4`). **Note:** GRP2-01..04 are defined inline in the ROADMAP phase entry, not in `REQUIREMENTS.md`.

### Prior phase context (dependencies)
- `.planning/phases/32-working-memory-context-ring/32-CONTEXT.md` — establishes the key architectural facts this phase relies on: **stateless agent loop**, all multi-turn context flows via the **client `history` array** (capped at `HISTORY_CAP = 20`), chat sessions persist to **localStorage only** (DB `sessions`/`messages` tables unused for chat), and the **context-usage ring** that bounds D-09 transcript growth.
- `.planning/phases/23-dino-groupchat/23-01-PLAN.md` and `23-01-SUMMARY.md` — the parallel fan-out being **replaced**; documents the `MAX_DINOS = 4` cap (T-23-01 DoS mitigation) and the `group-{groupId}-{dinoId}` per-dino thread scheme being retired.

### Code to modify / remove
- `apps/frontend/src/app/chat/groupchat.service.ts` — current parallel fan-out service (single-turn, ephemeral, per-dino threads). **To be rebuilt** around the turn-based orchestrator client + persisted session (D-08); `MAX_DINOS` cap carries forward.
- `libs/ui/src/lib/group-response/group-response.ts` (+ `.html`) — presentational per-dino panel; the attributed transcript / reaction-chip rendering (D-03, D-06) builds on or replaces this.
- `apps/backend/src/app/agents/agents.controller.ts` + `agents.service.ts` — `streamAgent` is the single-dino SSE entry; the orchestrator + per-dino answer calls (D-01) extend this (new group endpoint or orchestration service).
- `apps/backend/src/app/agents/dinos/dinos.ts` — dino registry (model + systemPrompt + toolNames per dino); the orchestrator reads the roster; answer calls use each dino's model/prompt.
- `apps/backend/src/app/agents/model-capabilities.ts` — the `gpt-4o-mini` paid-fallback model used for the orchestrator call (D-01) lives in this capability/fallback space.
- `apps/frontend/src/app/chat/history.service.ts` — localStorage session store; the interleaved group session (D-08) persists here.
- `libs/shared-types/src/lib/chat.types.ts` — `ChatRequest`/`ChatHistoryItem` contract; group messages need attribution (`dinoId`) + reactions; orchestrator plan shape is new shared types.

### Conventions
- `apps/backend/CLAUDE.md` — NestJS rules (controllers HTTP-only, logic in services, `Logger` not `console`, no `any`, env via `process.env['VAR']`, document new env vars in `.env.example`).
- `apps/frontend/CLAUDE.md` — standalone OnPush components, logic in services (not components), Tailwind-only, types from `@org/shared-types`.
- `.planning/codebase/ARCHITECTURE.md`, `CONVENTIONS.md` — workspace-level architecture/convention maps.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`GroupchatService`** already manages multiple concurrent SSE streams, an `entries` signal array, and `AbortController` lifecycle — the concurrency machinery for D-03 round 1 is reusable; the per-dino-thread workaround (documented as a v1 limitation in its comments) is dropped in favor of one interleaved session.
- **`group-response` component** (mascot + name header, streaming markdown body, status/typing indicator) is the attribution primitive for the top-to-bottom transcript.
- **Backend `streamAgent`** already resolves a dino server-side (system prompt + toolset never sent by client) and streams tokens — each answerer's full call reuses this path.
- **`gpt-4o-mini` paid fallback** already wired for free-model 429s — reuse as the cheap orchestrator model (D-01).
- **`history.service.ts` localStorage `ConversationSession`** store + history panel — the persistence substrate for D-08 (no DB work).

### Established Patterns
- Agent loop is **stateless per request**; all multi-turn context arrives via the client `history` array (`HISTORY_CAP = 20`). The group transcript (D-09) must flow through this channel, not server state.
- Dino = fixed **model + system prompt + tool subset** resolved server-side from `dinos.ts`; the client only sends `dinoId`. The orchestrator must operate on the registry, never widen toolsets.
- `MAX_DINOS = 4` participant cap (Phase 23) — carries forward as the base for the new cost caps.
- Free models 429 transiently → paid fallback; orchestration multiplies calls, so the per-turn call budget (orchestrator + answerers + bounded round 2) must stay capped (D-01/D-02).

### Integration Points
- The current SSE event types (`token`, `done`, `error`, `tool_call_*`, `reasoning_token`) need extension or a parallel group-event shape to carry **per-dino attribution**, **reaction** events, and the **orchestrator plan**.
- `ChatRequest`/`ChatHistoryItem` (shared-types) is the contract between the frontend group client and the backend orchestrator — extending it touches both apps + shared-types.

</code_context>

<specifics>
## Specific Ideas

- User explicitly delegated the **engine architecture** (D-01) to Claude, asking for "what's best for the project and follows the mentor's intent."
- **Mentor note (recalled by user), captured as D-05:** if a dino holds a different view or has its own thoughts, it should **say so and respond unasked** — i.e. volunteer a dissent/addition rather than only replying when addressed. The original note was not found in the repo (lives outside the project); D-05 encodes the user's stated intent.
- Success criterion mapping: #1 → D-01/D-07 (per-dino answer/react/silent); #2 → D-04/D-05 (forced mention + volunteered dissent); #3 → D-02/D-03/D-09 (bounded inter-dino, sequential round 2, attributed transcript); #4 → D-08 (persisted interleaved session reopens with full transcript).

</specifics>

<deferred>
## Deferred Ideas

- **Multi-round emergent banter (N bounded rounds)** — deferred; D-02 caps at one inter-dino follow-up round for cost/429 safety. Revisit if the single round feels too shallow.
- **A dino both replying AND reacting in one turn** — considered and rejected for MVP (D-07); reconsider if expressiveness is wanted later.
- **DB-backed group persistence (cross-device)** — out of scope; localStorage is the MVP substrate (D-08), consistent with current chat history.
- **Orchestrator-summarized long-thread context** — deferred (D-09 uses raw attributed transcript bounded by HISTORY_CAP); revisit if group threads routinely exceed the cap.
- **"In-character" speak/silent decision (per-dino router)** — rejected as the engine (D-01) for cost; the central orchestrator decides participation, replies stay in character.

### Reviewed Todos (not folded)
- `2026-05-29-replace-placeholder-dino-mascots` (matched on the keyword "dino") — **not folded**; it belongs to **Phase 20 (dino mascots)**, unrelated to group-chat orchestration.

</deferred>

---

*Phase: 35-conversational-group-chat*
*Context gathered: 2026-06-06*
