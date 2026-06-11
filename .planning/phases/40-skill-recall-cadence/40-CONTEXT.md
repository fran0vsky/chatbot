# Phase 40: Skill Recall Cadence - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Source:** Inline discuss + codebase audit (gsd-plan-phase 40)
**Mode:** mvp

<domain>
## Phase Boundary

Change *how taught skills are recalled into the dino's context* so it follows the mentor's
cadence: **once per conversation, pull the single most relevant learned skill** — instead of the
current behavior of re-injecting **every** taught skill on **every** turn.

In scope:
- Backend skill selection: pick exactly one most-relevant skill from the conversation's opening message.
- Stable across the thread (no per-turn re-selection) without persistence — derive deterministically
  from the opening user message, which is always recoverable from `history`.
- Single-skill injection into the system prompt.
- Observability: which skill was pulled is visible (small UI hint in the "what it remembers"/Knowledge
  surface) and logged backend-side.

Out of scope:
- Skill **extraction/saving** cadence (the mentor note was ambiguous; the goal text and MEM2-01 resolve
  it to *retrieval* — confirmed inline). Teach / edit / delete / manage flows are untouched.
- Embeddings / vector store. Memories (auto-extracted facts) are untouched — only the `dinoSkills`
  recall path changes.
- Schema changes. No new DB columns or persistence of the selected skill.
</domain>

<decisions>
## Implementation Decisions

### Cadence reading (LOCKED)
- **Retrieval cadence**, not extraction. Per conversation, select ONE most-relevant taught skill and
  keep it for the whole thread. Confirmed against goal text + MEM2-01 + mentor note "wyciąga jednego skilla".

### Selection mechanism (LOCKED)
- **Small LLM scorer.** One cheap LLM call on the FIRST turn matches the opening user message against
  each skill's `whenToActivate` (and `title`/`instruction` as fallback context) and returns the single
  most relevant skill id, or none.
- Reuse the established cheap-model + try/catch + timeout pattern from `extractAndStoreMemories`
  (`MEMORY_EXTRACTION_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free'`). Must NEVER throw into the chat;
  on any failure or timeout it falls back to injecting nothing (degrade gracefully).
- The call happens **once per conversation**. Determinism across turns comes from always scoring against
  the *opening* user message (recoverable from `history`), so no DB persistence is needed.

### Stability without persistence (LOCKED)
- The "opening message" = the first `role:'user'` item in `history` when history is non-empty, else the
  current `message` (turn 1). Selecting against it yields the same skill every turn of the thread.
- Optimization: only run the LLM scorer when `history` is empty (turn 1) is NOT required — but to bound
  cost, the scorer runs each turn against the opening message. **Decision:** run the scorer only when
  there is at least one taught skill; if zero skills, skip entirely (inject nothing).

### Injection shape (LOCKED)
- `buildSystemPrompt` injects **at most one** skill. When a skill is selected, the block names that one
  skill. Soften the current "apply ALL of them in every single response" wording to a single standing
  instruction (one skill, applied this conversation).
- No relevant skill selected → inject nothing (empty skills block), exactly as today when there are zero skills.

### Observability (LOCKED)
- Backend: `Logger.log` line naming the selected skill (id + title) or "no skill selected".
- Frontend: emit a new `StreamEvent` variant `skill_active` (skillId, skillTitle) once per turn when a
  skill is active; the chat surface stores it and renders a small hint in the "what it remembers" /
  Knowledge area. Satisfies Success Criterion 2 (UI hint, roadmap "UI hint: yes (small)").

### Claude's Discretion
- Exact prompt wording for the scorer; exact UI placement/styling of the hint (small, unobtrusive,
  Tailwind only, follows desert/jungle theme); whether the scorer returns id directly or an index.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Backend agent loop & skill recall
- `apps/backend/src/app/agents/agents.service.ts` — `streamAgent` (skill fetch at ~L171-183),
  `buildSystemPrompt` (~L439-467), `extractAndStoreMemories` cheap-model pattern (~L474+),
  `MEMORY_EXTRACTION_MODEL` const (L27).
- `apps/backend/src/app/memory/memory.service.ts` — `getSkills(userId, dinoId)` (L106), `SkillView` (L9).
- `apps/backend/src/app/agents/agents.controller.ts` — SSE `write(event)` bridge (L26-32).
- `apps/backend/CLAUDE.md` — backend rules (env via `process.env['VAR']`, no `any`, NestJS `Logger`).

### Shared types
- `libs/shared-types/src/lib/chat.types.ts` — `StreamEvent` union (L151), `ChatHistoryItem` (L10),
  the per-event interfaces (L108-149).

### Frontend surface
- `apps/frontend/src/app/chat/chat.ts` — SSE event switch (~L1300-1360), `learnedSkills` signal (L613).
- `apps/frontend/src/app/chat/chat.html` — Knowledge view + Skills section (~L413-476).
</canonical_refs>

<specifics>
## Specific Ideas

- Current injected text to change: `## MANDATORY STANDING INSTRUCTIONS\nThe user has configured the
  following behaviors. You MUST apply ALL of them in every single response, without exception...`
  → single-skill standing instruction.
- StreamEvent variants to mirror for the new event: `StreamReasoningTokenEvent` is the simplest shape
  to copy. Add `skill_active` to the union and to the frontend switch.
</specifics>

<deferred>
## Deferred Ideas

- Multi-skill ranked retrieval / top-k. One skill only this phase.
- Embedding-based similarity (vector store) — not in this milestone.
- Persisting the selected-skill choice per thread in the DB — unnecessary given deterministic
  opening-message selection.
</deferred>

---

*Phase: 40-skill-recall-cadence*
*Context gathered: 2026-06-12 via inline discuss (gsd-plan-phase 40)*
