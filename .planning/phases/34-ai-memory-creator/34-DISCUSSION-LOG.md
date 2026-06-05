# Phase 34: AI Memory Creator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 34-ai-memory-creator
**Areas discussed:** Output target, Suggestion engine, Trigger & thinking state, Reconciliation

---

## Output target — what the creator writes

| Option | Description | Selected |
|--------|-------------|----------|
| Skills only (3-field) | Everything saved becomes a DinoSkill (+whenToActivate); "memory" is branding; userMemories untouched | ✓ |
| Both — synthesizer decides | Classify each item as skill vs fact and route to two stores | |
| Memories only | Write userMemories (content); conflicts with the 3-field form | |

**User's choice:** "first or second option, decide the best fitting one" → Claude selected **Skills only**.
**Notes:** The 3-field form *is* the skill shape; skills are the store that auto-applies
(mandatory standing instructions in `buildSystemPrompt`); a plain fact has no meaningful
when/instruction split. One form, one store, one reconciliation path. The background
`userMemories` auto-extraction pipeline keeps running independently.

---

## Suggestion engine

| Option | Description | Selected |
|--------|-------------|----------|
| Cheap fixed model, reuse extractor | Reuse nemotron-3-nano:free pattern; generic wording | |
| Active dino's own model | Use the selected dino's model so suggestions feel in-character | ✓ |
| Cheap model + dino flavor | Cheap model seeded with dino persona | |

**User's choice:** Active dino's own model.
**Notes:** Route through the existing `buildLlm` + paid-fallback (gpt-4o-mini) pattern so
free-model 429s don't break the creator. Image-gen dinos fall back to a text model.

---

## Trigger & thinking state

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on brain click, faux thinking | Generate on open; animated dino "thinking" placeholder | ✓ |
| Auto on click, stream real reasoning | Stream actual reasoning tokens (Phase 11 display) | |
| On-demand button | User presses "Suggest from conversation" | |

**User's choice:** Auto on brain click, faux thinking.
**Notes:** Matches SC#1 literally without coupling to streamed-reasoning infra. Real
reasoning streaming deferred as future polish.

---

## Reconciliation (create-or-update)

| Option | Description | Selected |
|--------|-------------|----------|
| LLM reconciler call | LLM compares new item to existing skills, returns "new" or an id to merge | ✓ |
| Fuzzy title/semantic match | Heuristic threshold match | |
| Same call as synthesis | Synthesis call also emits target id | |

**User's choice:** LLM reconciler call.
**Notes:** Robust to paraphrase. "Update" → `PUT /api/skills/:id` (Phase 33); "new" →
`POST /api/skills`. Decision never surfaced as a toggle. Whether it's a separate call or
folded into synthesis is left to the planner (behavior is fixed, call count is not).

---

## Claude's Discretion

- Image-gen dinos fall back to a text-capable model for generation/reconciliation.
- Reconciler as separate call vs folded into synthesis — planner's call.
- Suggestion presentation (cards/chips), exact prompts, thinking visuals, natural-text
  input placement.

## Deferred Ideas

- Streaming real reasoning into the thinking state (Phase 11 reuse) — future polish.
- Routing items to `userMemories` as well as skills ("both stores") — rejected this phase.
- Cross-device sync of created skills — blocked on auth (AUTH-01).
