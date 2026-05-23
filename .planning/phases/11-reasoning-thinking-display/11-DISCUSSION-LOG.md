# Phase 11: Reasoning / Thinking Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 11-reasoning-thinking-display
**Areas discussed:** Reasoning model pick, Collapse trigger, Visual treatment, Duration measurement

---

## Reasoning Model Pick

| Option | Description | Selected |
|--------|-------------|----------|
| DeepSeek R1 (`deepseek/deepseek-r1`) | Free tier on OpenRouter, well-known reasoning model, emits visible chain-of-thought. Good demo material, no cost risk. | ✓ |
| OpenAI o1-mini (`openai/o1-mini`) | Paid, polished, hides raw reasoning behind a summary in some integrations — may not surface deltas the way we want. | |
| Let researcher pick | Defer to gsd-phase-researcher against live OpenRouter availability + which models actually stream reasoning deltas through LangChain. | |

**User's choice:** DeepSeek R1
**Notes:** Free-tier availability + emits visible CoT deltas makes it the lowest-risk pick for getting reasoning visible on screen.

---

## Collapse Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On first content `token` | Collapses the moment the model starts producing the final answer. Focus shifts to the answer; reasoning is already "past". Mimics ChatGPT/Claude behavior. | ✓ |
| On `done` event | Reasoning stays expanded through answer streaming, collapses only when stream fully completes. | |

**User's choice:** On first content `token`
**Notes:** Snappier feel; aligns with how mainstream reasoning UIs handle the transition.

---

## Visual Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Left border + smaller text | Thin left border (`border-l-2 border-stone-300 dark:border-stone-700 pl-3`), `text-sm text-stone-500 dark:text-stone-400`. Quote-like, no background fill. | ✓ |
| Background tint + smaller text | Subtle bg fill (`bg-stone-100 dark:bg-stone-900/50 rounded-md p-2 text-sm`). Card-like region. | |
| Both — border + tint + italic | Stronger demarcation. May feel heavy/over-styled for something meant to be subordinate. | |

**User's choice:** Left border + smaller text
**Notes:** Lightest treatment that still demarcates the block; matches "secondary on first glance" SPEC criterion.

---

## Duration Measurement

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side, shipped on `done` | Backend records `Date.now()` on first and last `reasoning_token`, ships `reasoningDurationMs` on `done`. Measures actual model time, no network jitter. | ✓ |
| Client-side, computed in chat.service | Frontend stamps first/last `reasoning_token` arrival times locally. Simpler — no backend duration logic. | |

**User's choice:** Server-side
**Notes:** Single source of truth; network jitter excluded; SPEC already permits the `done` payload extension.

---

## Claude's Discretion

- Exact OpenRouter reasoning API shape (`reasoning: { effort: "medium" }` vs `include_reasoning: true` vs LangChain `extraBody` passthrough) — researcher resolves against live docs.
- Backend wiring for "reasoning-capable model? → send reasoning param" — planner picks the cleanest fit (model-config map vs per-model strategy).
- Whether `extractChunkText` is extended or a parallel `extractChunkReasoning` is added.
- Exact in-progress reasoning storage shape on the streaming message (signal-backed, following Phase 10 pattern).
- Where the "first content `token` after reasoning started" detection lives (chat.service vs message-bubble vs ReasoningBlock host).

## Deferred Ideas

None — discussion stayed within phase scope.
