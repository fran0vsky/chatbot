---
quick_id: 260610-sxm
slug: group-chat-liveliness
status: complete
date: 2026-06-10
---

# Quick Task 260610-sxm: Group chat liveliness — Summary

## What changed

All changes are in the backend orchestrator
[group-agents.service.ts](../../../apps/backend/src/app/agents/group-agents.service.ts)
(+ its spec). No frontend or contract changes — the existing `reaction` /
`dino_*` SSE events already carry everything needed.

1. **React-by-default for non-answerers.** Orchestrator system prompt now tells
   the model that every participant should usually do something visible: a dino
   that doesn't answer should *react with a fitting emoji*, and `silent` is
   reserved for when even a reaction would be noise. Fixes the "2 of 4 dinos
   vanish" symptom — the other dinos are now visibly present.

2. **2-3 Round-1 answerers.** Prompt now asks for the 2-3 best-fit specialties
   (multiple perspectives encouraged) instead of the single best answerer.

3. **Richer inter-dino conversation.** `MAX_INTER_DINO_REPLIES` raised 2 → 3 and
   the Round-2 rule rewritten so dinos build on / add to / respectfully push back
   on each other, or react to a specific dino's answer. Per-turn LLM-call ceiling
   updated 1+4+2=7 → 1+4+3=8 (comment updated).

4. **Round-2 reactions now actually attach.** Previously a Round-2 `react` had no
   `targetMessageId` (message ids don't exist at plan time) so the frontend's
   `attachReaction` guard silently dropped it — i.e. "thumbs-up on another dino's
   answer" never appeared. Now a Round-2 reaction resolves its `respondingTo`
   dinoId to that dino's most-recent transcript message id before emitting.

## Verification

- `nx test backend` (group-agents): **14 passed**.
- Updated two cap-asserting tests (clamp + Round-2 call count) to the new cap of
  3 and made the clamp test exercise the boundary (4 inputs → 3 kept).
- Added a new test locking in Round-2 reaction targeting (reaction pins to the
  responded-to dino's round-1 `messageId`).

## Notes / follow-ups

- The orchestrator is `openai/gpt-4o-mini`; behavior is prompt-driven, so exact
  liveliness will vary per turn. The parse/clamp layer still hard-caps cost.
- Worth a human UAT pass in a real 4-dino group chat to confirm the model honors
  the react-by-default guidance in practice.
