---
quick_id: 260610-tg7
slug: group-reaction-tooltips
status: complete
date: 2026-06-10
---

# Quick Task 260610-tg7: Group reaction emoji tooltips — Summary

## What changed

Reaction emoji chips in group chat now show a descriptive caption on hover
(e.g. 💡 → "thought that's clever"), and the orchestrator is constrained to a
captioned emoji vocabulary so every reaction always resolves to a tooltip.

1. **Shared vocabulary (single source of truth).** New
   [group-reactions.ts](../../../libs/shared-types/src/lib/group-reactions.ts):
   `REACTION_TOOLTIPS` (emoji → caption), `REACTION_EMOJIS`, and
   `reactionTooltip(emoji)` with a neutral fallback. Covers the full set the
   user specified (core, AI-specific, debate/multi-agent, character-rich).
   Re-exported from the shared-types barrel.

2. **Frontend tooltip.**
   [group-response.ts](../../../libs/ui/src/lib/group-response/group-response.ts)
   gains a thin `reactionTooltip()` delegating to the shared helper;
   [group-response.html](../../../libs/ui/src/lib/group-response/group-response.html)
   binds it to the chip's `[title]` and `[attr.aria-label]` (also adds
   `cursor-default`). Native title = reliable hover text + accessible label.

3. **Orchestrator constrained to the vocabulary.**
   [group-agents.service.ts](../../../apps/backend/src/app/agents/group-agents.service.ts)
   now lists the captioned set in the system prompt and tells the model to pick
   the emoji whose meaning fits — so reactions are both meaningful and always
   captioned. The frontend fallback ("reacted") covers any off-vocabulary slip.

## Verification

- `nx test backend` (group-agents): **14 passed** (new shared export resolves).
- `nx run @chatbot/ui:typecheck`: clean (shared-types + ui build green).

## Notes

- The sparse-answer symptom in the latest UAT (only Veloce answered, Glyphos
  errored) is mostly the known OpenRouter free-model 429 (see project memory),
  not orchestrator logic — the 💡 reaction attaching to Veloce's answer confirms
  the Phase-35 round-2 reaction fix (260610-sxm) is working.
- Captions are dino-agnostic ("liked that"); could later prefix the reacting
  dino's name ("Veloce liked that") if the component is given the roster.
