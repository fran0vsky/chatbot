# Phase 34: AI Memory Creator - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Clicking the **brain** opens an AI-assisted creator that (1) shows a dino "thinking"
state, (2) proposes ≥3 things-worth-remembering derived from the current conversation,
(3) lets the user pick a suggestion **or** type free natural text, (4) auto-fills an
editable 3-field form (**name / when-to-activate / instruction**), and (5) on save
persists the item and **auto-reconciles create-vs-update** (an overlapping item updates
the existing one instead of duplicating — no user-facing "new vs update" toggle).

**In scope:** suggestion generation from the conversation, natural-text → form synthesis,
create-or-update reconciliation, the editable 3-field form (the brain modal's *body*).

**Out of scope:** cross-device sync (needs auth); surfacing the new-vs-update decision as
a toggle; the brain icon / modal *shell* and the 3-field skill form/column (built in
Phase 33). No regression to the Phase 22 teach flow or existing stored skills/memories.

</domain>

<decisions>
## Implementation Decisions

### Output target — what the creator writes (SC#2, SC#3)
- **D-01:** The creator writes **DinoSkills only** (the 3-field shape: `title` /
  `whenToActivate` / `instruction`). The form *is* the skill shape, and skills are the
  store that "auto-applies in later chats" (rendered as MANDATORY STANDING INSTRUCTIONS
  in `buildSystemPrompt`). "Memory" in the phase name is **user-facing branding**, not a
  second data path.
- **D-02:** The existing background **`userMemories` auto-extraction pipeline**
  (`extractAndStoreMemories`) is **left untouched** and runs independently. The creator
  does NOT read from or write to `userMemories`. (Chose "Skills only" over "synthesizer
  routes to both": one form, one store, one reconciliation path; a plain fact has no
  meaningful when/instruction split, so forcing it through the 3-field form is awkward.)
- **D-03:** SC#3's "overlaps an existing **memory**" is satisfied against the user's
  **existing skills** for the active (userId × dinoId) — reconciliation compares the new
  item to existing DinoSkills.

### Suggestion + synthesis engine (SC#1, SC#2)
- **D-04:** Suggestions and natural-text→form synthesis use the **active dino's own
  model** (the one in its registry entry) so recommendations feel in-character
  ("Claude-style recommendations"). Reuse the existing `buildLlm` + **paid-fallback**
  pattern (`FALLBACK_MODEL = openai/gpt-4o-mini`) so free-model 429s don't break the
  creator. (See `[[project_openrouter_db]]` — free models 429 transiently.)
- **D-05:** Both entry paths (pick-a-suggestion and type-free-text) converge on the same
  synthesis step that emits the 3 form fields; the form is fully editable before save
  regardless of path.

### Trigger & "thinking" state (SC#1)
- **D-06:** Generation fires **automatically on brain click** (modal open). While it runs,
  show an animated dino **faux "thinking"** placeholder (cosmetic) until suggestions
  arrive — matches SC#1 literally without coupling to streamed-reasoning infra.

### Create-or-update reconciliation (SC#3)
- **D-07:** On save, a dedicated **LLM reconciler call** compares the synthesized item
  against the user's existing skills and returns either **"new"** or the **id** of the
  skill to update (folding the +/- delta into the merged instruction). Chosen over fuzzy
  title/embedding match for robustness to paraphrase. The decision is **never surfaced**
  as a toggle (SC#3 / scope note).
- **D-08:** "Update" maps to the **Phase 33 `PUT /api/skills/:id`** endpoint; "new" maps
  to the existing `POST /api/skills`. No new persistence endpoint should be needed beyond
  what Phase 33 introduces — confirm during planning.

### Claude's Discretion
- **Image-gen dinos** (`imageGen: true`) don't run the text agent loop; for these the
  creator should fall back to a text-capable model (e.g. `FALLBACK_MODEL` or the cheap
  `MEMORY_EXTRACTION_MODEL`) for suggestion/synthesis/reconciliation. Planner's call.
- Whether the reconciler is a **separate call** or folded into the synthesis call (pass
  existing skills in, emit a target id) is an implementation detail — D-07 specifies
  behavior, not call count. Prefer fewer round-trips if quality holds.
- Suggestion **presentation** (cards vs chips), exact prompts, thinking-animation visuals,
  and natural-text input placement are open to standard approaches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & success criteria
- `.planning/ROADMAP.md` §"Phase 34: AI Memory Creator" — goal, 4 success criteria,
  scope note (synthesizer makes the new-vs-update call; no toggle).
- `.planning/phases/33-composer-knowledge-reorg/33-CONTEXT.md` — **hard dependency.**
  Defines the brain entry point, the 3-field skill form, `DinoSkill.whenToActivate`
  (nullable column, no backfill), `PUT /api/skills/:id`, shared `<app-skill-manager>`.
  ⚠️ Phase 33 is **planned but not yet executed** — its column/form/endpoint must land
  before Phase 34 can consume them.

### Code to modify / reuse (backend)
- `apps/backend/src/app/agents/agents.service.ts` — `buildLlm` + paid-fallback retry
  (lines ~112-221), `buildSystemPrompt` (skills as MANDATORY STANDING INSTRUCTIONS,
  ~399), `extractAndStoreMemories` + `MEMORY_EXTRACTION_MODEL`/`FALLBACK_MODEL`
  (~24-27, 417-451) — reuse model/prompt patterns; leave the auto-extraction path intact.
- `apps/backend/src/app/memory/memory.service.ts` — `getSkills` / `addSkill`
  (+ Phase 33's `updateSkill`); skill persistence scoped by (userId × dinoId), graceful
  DB-off degradation.
- `apps/backend/src/app/memory/skills.controller.ts` — existing `/api/skills`
  GET/POST/DELETE (+ Phase 33's `PUT skills/:id`); add the creator's suggest/synthesize
  endpoint here or in a sibling controller.
- `libs/shared-types/src/lib/dino.types.ts` — `DinoSkill` (gains `whenToActivate?` in
  Phase 33), `LearnedItems`; add the suggestion/synthesis request/response types here.

### Code to modify / reuse (frontend)
- `apps/frontend/src/app/chat/chat.html` (~line 659) — teach overlay shell that Phase 33
  wires to the brain; Phase 34 replaces its body with the creator.
- `apps/frontend/src/app/chat/chat.ts` — composer/brain wiring, `skillPanelOpen`.
- `apps/frontend/src/app/chat/skill.service.ts` — `getLearned`/`addSkill` (+ Phase 33's
  `updateSkill`); add the suggest/synthesize HTTP calls here (services-only rule).
- `libs/ui/src/lib/skill-manager/skill-manager.ts` — shared presentational list, reused
  in the modal.

No external ADR/spec docs — requirements fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`extractAndStoreMemories`** (`agents.service.ts`): a working one-shot LLM extraction
  over a turn (system prompt → "facts, one per line"). The same shape generalizes to
  "≥3 things worth remembering" across the whole conversation.
- **`buildLlm` + fallback retry**: existing OpenRouter wiring with paid fallback on 429 —
  the creator's LLM calls should route through the same pattern, not a fresh client.
- **`buildSystemPrompt`**: confirms skills = mandatory standing instructions (always
  apply) vs memories = soft facts — validates D-01 (creator targets skills).
- **`<app-skill-manager>`** + **`SkillService`**: Phase 33 makes these edit-capable;
  the saved item appears in the same list, one source of truth.

### Established Patterns
- Backend: controllers HTTP-only, logic in `MemoryService`/`AgentsService`, constructor
  DI, NestJS exceptions, types from `@org/shared-types`, graceful DB-off degradation.
- Frontend: standalone + OnPush, HTTP only via services, types from `@org/shared-types`,
  Tailwind only. Presentational components in `libs/ui` (no services, Storybook story).
- Dino resolution is **server-side**: the client sends `dinoId`; the backend owns the
  model/prompt. The creator's generation must resolve the dino server-side too.

### Integration Points
- New suggest/synthesize/reconcile endpoint(s) join the `/api/skills` surface, scoped by
  (userId × dinoId), feeding the modal body.
- Save path: synthesis → reconciler decision → `POST /api/skills` (new) or
  `PUT /api/skills/:id` (update) → item shows in `<app-skill-manager>` and auto-applies
  via `buildSystemPrompt` next chat.

</code_context>

<specifics>
## Specific Ideas

- "Claude-style recommendations" (SC#1) is the bar for suggestion quality/voice — drives
  D-04 (use the dino's own model).
- The 3 form fields map 1:1 to `DinoSkill`: name→`title`, when-to-activate→`whenToActivate`,
  instruction→`instruction`.
- "Plus/minus input" (SC#3) = the reconciler folds additive/subtractive deltas from the
  new item into the existing skill's instruction when updating, rather than appending a
  duplicate.

</specifics>

<deferred>
## Deferred Ideas

- **Streaming real reasoning** into the thinking state (vs faux animation) — possible
  future polish reusing Phase 11's reasoning display; not needed for SC#1.
- **Routing items to `userMemories` as well as skills** (the "both stores" option) —
  rejected for this phase; revisit only if plain-fact capture proves valuable separately.
- **Cross-device sync** of created skills — blocked on auth (AUTH-01), out of scope.

None of the above are blockers — discussion stayed within phase scope.

</deferred>

---

*Phase: 34-ai-memory-creator*
*Context gathered: 2026-06-05*
