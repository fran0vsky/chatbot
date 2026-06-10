---
quick_id: 260610-sxm
slug: group-chat-liveliness
status: in-progress
---

# Quick Task 260610-sxm: Group chat liveliness

## Problem

In group chat, with 4 dinos selected only ~2 actually answer; the rest vanish
(no visible presence) and inter-dino conversation is thin. Phase 35 intentionally
lets some dinos stay quiet, but the orchestrator (gpt-4o-mini) defaults
non-specialists to `silent` and rarely volunteers Round-2 replies, so the chat
reads as two parallel monologues rather than a conversation.

Root cause is entirely in the orchestrator prompt + caps in
[group-agents.service.ts](../../../apps/backend/src/app/agents/group-agents.service.ts):
- prompt says non-fitting dinos "may react or stay silent" → model picks silent
- prompt asks for the single best-fit answerer → only 1-2 answer
- `MAX_INTER_DINO_REPLIES = 2` and Round-2 only fires on a "genuinely different take"
- Round-2 **reactions** carry no `targetMessageId` (message ids don't exist at
  plan time) so a "thumbs-up on another dino's answer" is silently dropped by the
  frontend `attachReaction` guard.

## Tasks

### Task 1 — Liven the orchestrator (single file)
**File:** `apps/backend/src/app/agents/group-agents.service.ts`

1. Raise `MAX_INTER_DINO_REPLIES` 2 → 3 and update the cost-ceiling comment
   (new hard ceiling: 1 orchestrator + 4 Round-1 + 3 Round-2 = 8 LLM calls).
2. Rewrite the orchestrator system-prompt rules to:
   - Round 1: pick **2-3** answerers whose specialties fit (not just the single best).
   - Non-answerers should **`react` with a fitting emoji** by default; reserve
     `silent` only for when a reaction would be pure noise — so every picked dino
     is visibly present.
   - Round 2: up to 3 dinos either **answer** (build on / push back on / add to a
     prior dino, `respondingTo` set) or **`react`** to a specific dino's answer
     (also `respondingTo` set). Encourage genuine back-and-forth, not echoing.
3. Make Round-2 reactions actually attach: when a Round-2 `react` decision has no
   `targetMessageId` but has `respondingTo`, resolve it to the most-recent
   transcript message id from that dino before emitting the `reaction` event.

**Verify:** `nx test backend` (group-agents specs still pass; parse/clamp logic
unchanged). Type-check clean.
**Done:** All 4 picked dinos do something visible (answer or react); 2-3 answer
Round 1; Round-2 replies/reactions reference each other.

## must_haves
- `MAX_INTER_DINO_REPLIES === 3` with the cost-ceiling comment updated.
- Orchestrator prompt instructs 2-3 Round-1 answerers + react-by-default for the rest.
- Round-2 `react` decisions resolve `respondingTo` → a real target message id.
- Existing `parseOrchestratorPlan` / `buildAttributedHistory` behavior unchanged.
