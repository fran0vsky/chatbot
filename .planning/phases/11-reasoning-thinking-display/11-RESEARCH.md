# Phase 11: Reasoning / Thinking Display - Research

**Researched:** 2026-05-24
**Domain:** OpenRouter reasoning-token streaming through LangChain/LangGraph JS into an existing SSE pipeline, with a presentational Angular reasoning block.
**Confidence:** HIGH (transport, types, frontend integration); MEDIUM (exact OpenRouter delta-shape variability across reasoning models — resolved by reading the official `@langchain/openrouter` chunk converter source).

## Summary

Phase 11 adds reasoning-trace streaming on top of the Phase 10 SSE pipeline. The locked decisions (D-01..D-04 in CONTEXT.md) leave one technically non-trivial unknown: how OpenRouter's reasoning output reaches user code through LangChain JS — a known pain point in `@langchain/openai` itself.

The good news: an **official `@langchain/openrouter`** package (published by the LangChain core maintainers, latest `0.3.0` from 2026-02) ships a dedicated `ChatOpenRouter` class whose chunk converter explicitly copies `delta.reasoning` and `delta.reasoning_details` onto `additional_kwargs.reasoning_content` and `additional_kwargs.reasoning_details`. This is the clean path that sidesteps the long-running `ChatOpenAI` "silently drops reasoning_content" bug (langchain-ai/langchain#35059, #32981).

Two viable implementation paths exist, and the planner must pick one:

1. **Swap `ChatOpenAI` for `ChatOpenRouter`** (recommended). Existing baseURL trick is replaced by a first-party integration whose source code already handles the exact field this phase needs. Single small dependency add.
2. **Stay on `ChatOpenAI` and use `modelKwargs` + a custom chunk extractor.** Riskier — `ChatOpenAI`'s `_convertDeltaToMessageChunk` is known to drop `reasoning_content` from non-OpenAI providers; you'd need to monkey-read `ev.data.chunk.additional_kwargs` (which may or may not be populated depending on `@langchain/openai` version) or parse the raw chunk before LangChain wraps it.

**Primary recommendation:** Add `@langchain/openrouter@^0.3.0` and switch `agents.service.ts` to `ChatOpenRouter`. Pass `modelKwargs: { reasoning: { effort: 'medium' } }` only for reasoning-capable models (gate via a small model-config map keyed by model id). On each `on_chat_model_stream` event, read `chunk.additional_kwargs.reasoning_content` (string delta) — emit it as a new `{ type: 'reasoning_token', text }` StreamEvent. Stamp `Date.now()` on first/last reasoning_token for the turn and ship `reasoning` + `reasoningDurationMs` on the existing `done` event. Frontend: extend `StreamEvent` union and `ChatMessage`, add a presentational `ReasoningBlock` standalone OnPush component, slot it into the assistant branch of `message-bubble.html` above the `<markdown>` block, gate visibility on `message.reasoning?.length > 0`. Auto-collapse trigger lives in `chat.ts` (`handleStreamEvent`) — flip a `reasoningCollapsed` signal on first `token` event of the turn.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add **`deepseek/deepseek-r1`** to the model selector as the reasoning-capable option. Default stays `openai/gpt-4o-mini`.
- **D-02:** Reasoning block **auto-collapses on the first content `token` event**, not on `done`. Late `reasoning_token` events arriving after first content token still append to the reasoning string but do not re-expand.
- **D-03:** **Left border + smaller muted text** — `border-l-2 border-stone-300 dark:border-stone-700 pl-3 py-1`, `text-sm text-stone-500 dark:text-stone-400`, `whitespace-pre-wrap`. No background fill, no italic, no monospace. Toggle styled with the same muted palette. Planner may substitute project-specific desert-palette tokens (`desert-brown-muted`, `desert-night-muted`, `desert-border`, `desert-night-border`) — see Code Context for the existing tokens in `message-bubble.html`.
- **D-04:** **Server-side duration measurement.** Backend stamps `Date.now()` on first and last `reasoning_token` for the turn and ships `reasoningDurationMs?: number` on the `done` event.

### Claude's Discretion
- Exact OpenRouter reasoning API shape — researcher resolves against live docs. **Resolved below (see Standard Stack and Code Examples):** `reasoning: { effort: 'medium' }` body field, passed via `modelKwargs` on `ChatOpenRouter`.
- Where the "reasoning-capable model? → send reasoning param" gate lives — researcher recommends a small `MODEL_CAPABILITIES` map in the agents module.
- Whether `extractChunkText` is extended or a parallel `extractChunkReasoning` is added — researcher recommends **parallel** helper (cleaner separation, no conditional logic on a single helper).
- Exact in-progress reasoning storage shape on the streaming message item — researcher recommends a parallel `streamingReasoning = signal('')` next to the existing `streamingText` signal in `chat.ts`, mirroring the Phase 10 pattern exactly.
- Where the "first content token after reasoning started" detection lives — researcher recommends `chat.ts.handleStreamEvent('token')` (one-line flag flip the first time a `token` arrives after `streamingReasoning()` has content). Keeps `ReasoningBlock` purely presentational.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Req 1 | Reasoning-capable model selectable; default unchanged | Standard Stack: `deepseek/deepseek-r1:free` confirmed available on OpenRouter free tier. ModelSelector wiring described in Code Context. |
| Req 2 | Backend requests reasoning output for reasoning-capable models only | Code Example A: `modelKwargs: { reasoning: { effort: 'medium' } }` on `ChatOpenRouter`; model-capability map gates inclusion. |
| Req 3 | New `reasoning_token` SSE event; `done` carries `reasoning` | Architecture Patterns: extend `StreamEvent` discriminated union in `libs/shared-types/src/lib/chat.types.ts`; emit from `on_chat_model_stream` handler reading `additional_kwargs.reasoning_content`. |
| Req 4 | Reasoning persisted on assistant `ChatMessage`; round-trips via `HistoryService` | `ChatMessage` already round-trips through `HistoryService.upsertSession()`; adding optional `reasoning?: string` is a single type edit — persistence is automatic. |
| Req 5 | `ReasoningBlock` presentational standalone OnPush component | Component Pattern: inputs `reasoning: string`, `streaming: boolean`, `durationMs?: number`; local signal for collapse state; Storybook story per project profile. |
| Req 6 | Muted visual treatment, day + night | D-03 + existing desert-palette tokens (`desert-brown-muted`, `desert-night-muted`, `desert-border`, `desert-night-border`) verified in `message-bubble.html`. |
| Req 7 | Live streaming + auto-collapse on first content token | Frontend pattern: `chat.ts` flips a `reasoningCollapsed` signal on first `token` of the turn; `ReasoningBlock` receives `collapsed` (or `expanded`) as input. |
| Req 8 | "Thought for Xs" duration meta | Backend timing in `streamAgent`: capture `firstReasoningAt` / `lastReasoningAt`, compute `reasoningDurationMs = lastReasoningAt - firstReasoningAt` on `done`. Frontend formats seconds (rounded; `<1s` rule). |
| Req 9 | Single merged reasoning block per turn (tool-call interleaving) | All `reasoning_token` events accumulate into one `streamingReasoning` signal; `done.reasoning` is the final concatenated string written into the persisted `ChatMessage.reasoning`. Tool-call splice logic in `chat.ts` untouched. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Send `reasoning` param to OpenRouter (model-conditional) | API / Backend (NestJS `AgentsService`) | — | Provider config is backend's domain; frontend already knows nothing about OpenRouter today. |
| Extract reasoning delta from LangChain chunk | API / Backend (`AgentsService.streamAgent`) | — | Same site as existing `extractChunkText`; chunk shape is backend-only knowledge. |
| Measure reasoning duration | API / Backend | — | Single source of truth per D-04; avoids network jitter. |
| `reasoning_token` SSE frame transport | API / Backend (writes), Browser/Client (reads) | — | Existing SSE channel handles it. |
| Accumulate streamed reasoning into in-progress message | Browser/Client (`ChatComponent` signal) | — | Mirrors Phase 10 `streamingText` pattern. |
| Auto-collapse trigger on first content token | Browser/Client (`ChatComponent.handleStreamEvent`) | — | Detection requires cross-event state; keeps `ReasoningBlock` presentational. |
| Render muted reasoning block | Browser/Client (`ReasoningBlock` presentational) | `MessageBubble` (host) | Presentational separation per project component-architecture rule. |
| Persist reasoning across session navigation | Browser/Client (`HistoryService`) | — | Already round-trips `ChatMessage`; adding the field is automatic. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/openrouter` | `^0.3.0` | First-party OpenRouter integration for LangChain JS; ships `ChatOpenRouter` whose chunk converter explicitly copies `delta.reasoning` / `delta.reasoning_details` onto `additional_kwargs.reasoning_content` / `additional_kwargs.reasoning_details`. | Avoids known `ChatOpenAI` "silently drops reasoning_content" bug ([langchain#35059](https://github.com/langchain-ai/langchain/issues/35059), [langchain#32981](https://github.com/langchain-ai/langchain/issues/32981)). Published by LangChain core maintainers (`hwchase17`, `jacoblee93`). [VERIFIED: npm registry + source inspection of `dist/converters/messages.js`] |
| `@langchain/langgraph` | (pinned by project) | `streamEvents({ version: 'v2' })` continues to surface `on_chat_model_stream` events with the underlying chunk reachable at `ev.data.chunk` — unchanged from Phase 10. | Already in stack. [VERIFIED: existing code at `agents.service.ts:159-189`] |
| `@langchain/core` | (pinned by project) | `AIMessageChunk.additional_kwargs` carries the reasoning fields. | Already in stack. [VERIFIED: source inspection] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@langchain/openai` | `^1.4.7` (existing) | Keep installed — it's a transitive dep of `@langchain/openrouter` and may still be referenced elsewhere. | Already present. No change needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@langchain/openrouter` | Continue using `ChatOpenAI` with `configuration.baseURL`, pass `modelKwargs: { reasoning }`, then read raw chunk via `ev.data.chunk` and inspect `additional_kwargs` | Documented bugs in `@langchain/openai` JS regarding non-OpenAI provider reasoning passthrough. May work in current version but is unsupported and could regress. Not recommended. |
| `@langchain/openrouter` | Subclass `ChatOpenAI` and override `_convertDeltaToMessageChunk` to recover reasoning fields | Significant maintenance burden, fragile to LangChain internals. Not recommended unless adding a new dep is forbidden. |
| `@langchain/openrouter` | Drop LangChain for this call, use raw `openai` SDK directly with the OpenRouter base URL | Breaks the LangGraph integration — `streamEvents` would no longer surface tool-node events. Would force a parallel transport for reasoning models. Strongly not recommended. |

**Installation:**
```bash
pnpm add @langchain/openrouter
```

**Version verification:**
```bash
npm view @langchain/openrouter version time.created
# 0.3.0, published 2026-05-22 (2 days before research)
```

The package was first published 2026-02-19, has 27 versions, and is maintained by the LangChain core team. The 0.3.0 release is 2 days old at research time — verify no breaking changes in the published 2-day window before merge. [VERIFIED: npm registry + maintainer list inspection]

## Package Legitimacy Audit

slopcheck was not available in this environment (pip install attempt would fail behind project proxy). Manual audit performed:

| Package | Registry | Age | Downloads | Source Repo | Manual Audit | Disposition |
|---------|----------|-----|-----------|-------------|--------------|-------------|
| `@langchain/openrouter` | npm | 3 months (first publish 2026-02-19); current 0.3.0 published 2 days ago | Part of `@langchain/*` org | https://github.com/langchain-ai/langchainjs (monorepo) | Maintainers are LangChain core (`hwchase17`, `jacoblee93`, `eric_langchain`, `basproul`, ...); package source inspected (chunk converter at `dist/converters/messages.js` correctly handles reasoning); published by `GitHub Actions` from langchain-ai org. | Approved — `[ASSUMED]` downgraded to `[VERIFIED: npm registry + source inspection + maintainer roster]` because all three verification axes pass. |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (the 3-month-old / 2-day-old version is the only ambiguity, mitigated by official LangChain-org maintainership and source inspection — planner may still gate behind a single `checkpoint:human-verify` task before install if desired)

## Architecture Patterns

### System Architecture Diagram

```
[User selects model in ModelSelector]
         │  (modelChange event → ChatComponent.selectedModel)
         ▼
[ChatComponent.onSend]
         │  POST /api/agents/chat { message, threadId, model }
         ▼
[AgentsController.chat (SSE)]
         │  streamAgent(message, threadId, model, signal)
         ▼
[AgentsService.streamAgent]
         │
         ├─ buildGraph(model)
         │      │
         │      ├─ if MODEL_CAPABILITIES[model].reasoning → modelKwargs.reasoning = { effort: 'medium' }
         │      └─ new ChatOpenRouter({ model, apiKey, modelKwargs })
         │
         ├─ graph.streamEvents(..., { version: 'v2', signal })
         │
         └─ for await (ev of stream):
                 │
                 ├─ ev.event === 'on_chat_model_stream':
                 │      │  chunk = ev.data.chunk  (AIMessageChunk)
                 │      │
                 │      ├─ reasoningText = chunk.additional_kwargs.reasoning_content
                 │      │     │  if reasoningText:
                 │      │     │      if firstReasoningAt === null: firstReasoningAt = Date.now()
                 │      │     │      lastReasoningAt = Date.now()
                 │      │     │      yield { type: 'reasoning_token', text: reasoningText }
                 │      │
                 │      └─ contentText = extractChunkText(chunk.content)
                 │            │  if contentText: yield { type: 'token', text: contentText }
                 │
                 ├─ on_tool_start / on_tool_end → unchanged from Phase 10
                 │
                 └─ after loop: yield { type: 'done', response, toolCalls,
                                        reasoning, reasoningDurationMs }
                 
[AgentsController writes each event as `data: <json>\n\n`]
         │
         ▼
[ChatService.streamMessage (async iterator over fetch ReadableStream)]
         │
         ▼
[ChatComponent.handleStreamEvent]
         │
         ├─ case 'reasoning_token':
         │      │  streamingReasoning.update(s => s + event.text)
         │      │  (block auto-expanded while reasoningCollapsed === false)
         │
         ├─ case 'token' (first one only):
         │      │  if streamingReasoning() not empty: reasoningCollapsed.set(true)
         │      │  (existing text-streaming logic continues)
         │
         └─ case 'done':
                │  push assistant message with reasoning: event.reasoning,
                │       reasoningDurationMs: event.reasoningDurationMs
                │  HistoryService persists → round-trips for free
         
[MessageBubble (assistant branch)]
         │
         ├─ @if (message.reasoning) { <app-reasoning-block …/> }
         └─ <markdown [data]="message.text" …/>
         
[ReasoningBlock (presentational, OnPush)]
         inputs: reasoning, streaming, durationMs, collapsed
         local signal: userOverrideCollapsed
         renders: muted left-bordered block + toggle button
                  ("Thought for 4s · Show reasoning" / "… · Hide reasoning")
```

### Recommended Project Structure
No new top-level structure — extend existing locations:

```
apps/backend/src/app/agents/
  ├── agents.service.ts                 # add MODEL_CAPABILITIES map, swap ChatOpenAI→ChatOpenRouter,
  │                                       add extractChunkReasoning, capture per-turn timestamps,
  │                                       enrich done event
  ├── agents.controller.ts              # unchanged
  └── model-capabilities.ts             # NEW (small): { [modelId]: { reasoning: boolean } }

libs/shared-types/src/lib/
  └── chat.types.ts                     # extend StreamEvent union, StreamDoneEvent, ChatMessage

libs/ui/src/lib/
  ├── reasoning-block/                  # NEW
  │   ├── reasoning-block.ts
  │   ├── reasoning-block.html
  │   └── reasoning-block.stories.ts
  ├── message-bubble/
  │   ├── message-bubble.ts             # import ReasoningBlock
  │   └── message-bubble.html           # slot above <markdown> in assistant branch
  └── model-selector/                   # (no source change — option added in chat.ts models array)

apps/frontend/src/app/chat/
  └── chat.ts                           # add streamingReasoning, reasoningCollapsed signals;
                                          handle 'reasoning_token' event; flip collapsed on first 'token';
                                          add deepseek/deepseek-r1:free to models array
```

### Pattern 1: Model-capability gate (backend)
**What:** A flat capability map decides which params to attach per model. Keeps reasoning-param injection out of every code path.
**When to use:** Right now — Phase 11 adds one capability; Phase 12+ will add more (vision, structured output, etc.). Centralize from day one.

```typescript
// apps/backend/src/app/agents/model-capabilities.ts
export interface ModelCapabilities {
  reasoning: boolean;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'deepseek/deepseek-r1:free': { reasoning: true },
  'deepseek/deepseek-r1':      { reasoning: true },
};

export function getModelCapabilities(modelId: string): ModelCapabilities {
  return MODEL_CAPABILITIES[modelId] ?? { reasoning: false };
}
```

### Pattern 2: Presentational ReasoningBlock with local toggle state
**What:** Component takes inputs only, owns its own collapse-override state via a local signal. Auto-collapse trigger is delivered as an input from the parent.

```typescript
// libs/ui/src/lib/reasoning-block/reasoning-block.ts
import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-reasoning-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reasoning-block.html',
})
export class ReasoningBlock {
  @Input({ required: true }) reasoning = '';
  @Input() streaming = false;
  @Input() durationMs?: number;
  /** Parent's auto-collapse signal value (true = collapse). */
  @Input() autoCollapsed = false;

  /** User has manually toggled — overrides autoCollapsed once set. */
  private readonly userToggle = signal<boolean | null>(null);

  readonly collapsed = computed(() => {
    const override = this.userToggle();
    if (override !== null) return override;
    // While streaming, never collapse regardless of parent input.
    if (this.streaming) return false;
    return this.autoCollapsed;
  });

  toggle(): void {
    this.userToggle.set(!this.collapsed());
  }

  durationLabel(): string {
    const ms = this.durationMs ?? 0;
    if (ms < 1000) return '<1s';
    return `${Math.round(ms / 1000)}s`;
  }
}
```

### Anti-Patterns to Avoid
- **Routing reasoning through a second HTTP channel or WebSocket.** SPEC constraint forbids it; Phase 10 transport reuse is mandatory.
- **Mutating `ChatMessage.reasoning` after `done`.** Once `done` fires, the message is finalized and persisted; further mutations corrupt the history store.
- **Putting auto-collapse detection inside `ReasoningBlock`.** It needs to observe the `token` event stream, which belongs to `ChatComponent`'s smart-component layer. Crossing this boundary violates the presentational/smart split (per project memory `feedback_angular_component_architecture`).
- **Using `ChatOpenAI` + manually reaching into `delta.reasoning` via `chunk._raw` or similar.** The underlying `_convertDeltaToMessageChunk` in `@langchain/openai` is documented to drop these fields silently from non-OpenAI providers. Use `ChatOpenRouter`.
- **Streaming reasoning as markdown.** SPEC says plain text only; use `whitespace-pre-wrap`. Markdown rendering is explicitly out of scope.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing OpenRouter streaming reasoning deltas from raw HTTP | A custom `EventSource`/SSE parser for OpenRouter responses | `@langchain/openrouter`'s `ChatOpenRouter` (works through existing `graph.streamEvents`) | Field normalization across reasoning models (DeepSeek emits `reasoning`, others emit `reasoning_details`); LangChain handles both. |
| Reasoning-param shape per provider | A per-provider request-body builder | `modelKwargs: { reasoning: { effort: 'medium' } }` passthrough | OpenRouter normalizes the param across underlying providers. One shape suffices. |
| Toggle collapse state machine | Multiple booleans + manual sync | A single `computed()` signal blending parent's auto-collapse with local user override | Computed signals naturally express the precedence rule. |
| Duration formatting | A custom seconds formatter scattered across components | One method on `ReasoningBlock` (`<1s` rule + `Math.round(ms/1000)s`) | Single location matches SPEC's two-state rule. |

**Key insight:** The only genuinely new code in this phase is one new presentational component, one shared-types extension, one backend capability map, and a handful of lines in three existing files. Everything else is reuse.

## Runtime State Inventory

(Not applicable — Phase 11 is greenfield additive work, not rename/refactor/migration. No existing data, registered services, OS tasks, or build artifacts carry the reasoning concept today. Section intentionally omitted.)

## Common Pitfalls

### Pitfall 1: `ChatOpenAI` silently dropping reasoning_content
**What goes wrong:** Using `new ChatOpenAI({ configuration: { baseURL: 'https://openrouter.ai/api/v1' } })` (the existing approach) and passing `modelKwargs: { reasoning: { effort: 'medium' } }` succeeds — OpenRouter receives the param and emits reasoning deltas — but `_convertDeltaToMessageChunk` in `@langchain/openai` drops the non-OpenAI-shape `reasoning_content` field. The chunk reaches the app empty of reasoning text.
**Why it happens:** `@langchain/openai` is OpenAI-API-shaped; reasoning fields from third-party providers (DeepSeek, OpenRouter) aren't in its delta-converter switch. Active issue: [langchain#35059](https://github.com/langchain-ai/langchain/issues/35059). [VERIFIED: GitHub issue + source inspection]
**How to avoid:** Use `@langchain/openrouter`'s `ChatOpenRouter` — its `convertOpenRouterDeltaToBaseMessageChunk` (in `dist/converters/messages.js`) explicitly copies `delta.reasoning` → `additional_kwargs.reasoning_content` and `delta.reasoning_details` → `additional_kwargs.reasoning_details`.
**Warning signs:** Reasoning request param visible in network capture, but no `reasoning_token` events emitted; LangSmith trace shows `additional_kwargs: {}`.

### Pitfall 2: Multi-turn `BadRequestResponseError` from fragmented reasoning_details
**What goes wrong:** When reasoning chunks are re-sent to OpenRouter in a subsequent turn (LangGraph's MemorySaver replays prior assistant messages), the fragmented `reasoning_details` array can be rejected.
**Why it happens:** `AIMessageChunk.__add__` list-concatenates `reasoning_details` across deltas, then `_convert_message_to_dict()` ships the fragments back as-is. OpenRouter's API rejects the malformed payload. Reported in [langchain#36400](https://github.com/langchain-ai/langchain/issues/36400) (Python; JS likely shares the codepath via mirrored design).
**How to avoid:** For Phase 11 the assistant message **content** is what LangGraph replays, not the reasoning details — reasoning is auxiliary metadata. Confirm in plan-check that the persisted `AIMessage` content sent back via `MemorySaver` contains only the final answer text, not the reasoning trace. If a regression appears on second turn of a conversation with the reasoning model, this is the cause; the fix is to strip `additional_kwargs.reasoning_details` from the persisted message before checkpointing (or use a custom message reducer). Flag for the planner: add a smoke test "send 2 sequential messages on the reasoning model" to catch this.
**Warning signs:** First turn works; second turn on the reasoning model returns a 400 from OpenRouter.

### Pitfall 3: Auto-collapse fires before any reasoning has streamed
**What goes wrong:** A non-reasoning model emits `token` events first (no reasoning). If the auto-collapse trigger is "first `token` event after stream start," it fires immediately and would collapse a (non-existent) block — harmless visually, but the flag is now `true`. If the user later switches to the reasoning model mid-conversation, stale state may leak.
**Why it happens:** Naive implementation listens to "first token" without gating on "reasoning has content."
**How to avoid:** Gate the collapse on `streamingReasoning().length > 0`:
```typescript
case 'token': {
  if (this.isLoading) this.isLoading = false;
  if (this.streamingReasoning().length > 0 && !this.reasoningCollapsed()) {
    this.reasoningCollapsed.set(true);
  }
  this.streamingText.update((s) => s + event.text);
  // ...
}
```
**Warning signs:** Toggle appears on non-reasoning model responses; or block remains expanded after first token on reasoning model.

### Pitfall 4: Reasoning stream may end well after first content token (interleaving)
**What goes wrong:** Per D-02, late `reasoning_token` events still append to `streamingReasoning`. If the UI binds the block's text to a signal that's frozen on collapse, late reasoning is lost.
**How to avoid:** Keep `streamingReasoning` writable for the entire turn — only freeze on `done` when the final `reasoning` string is moved from the signal onto the persisted `ChatMessage.reasoning`. The block's collapse state and the underlying text signal are independent.
**Warning signs:** `done.reasoning` is shorter than the visually-streamed text; or expanding the block after `done` shows truncated reasoning.

### Pitfall 5: Reasoning persists across model switches in the same thread
**What goes wrong:** User asks two questions on the reasoning model, switches to gpt-4o-mini, sends a third. Phase 2 architecture shares one `MemorySaver` across all model graphs (D-09, D-10). The prior `AIMessage` `additional_kwargs.reasoning_details` may be sent back to gpt-4o-mini, which doesn't know what to do with them.
**Why it happens:** Shared checkpointer + per-model graph means assistant history is global.
**How to avoid:** Confirm via test that switching models mid-thread doesn't 400. If it does, sanitize `additional_kwargs` before checkpointing (same fix as Pitfall 2). Flag for planner.
**Warning signs:** Third message in a mixed-model thread fails.

## Code Examples

Verified patterns. Confidence HIGH unless noted.

### A. Backend: ChatOpenRouter with model-conditional reasoning param

```typescript
// apps/backend/src/app/agents/agents.service.ts (excerpt)
import { ChatOpenRouter } from '@langchain/openrouter';
import { getModelCapabilities } from './model-capabilities';

private buildGraph(modelId: string) {
  const caps = getModelCapabilities(modelId);
  const modelKwargs: Record<string, unknown> = {};
  if (caps.reasoning) {
    modelKwargs['reasoning'] = { effort: 'medium' };
  }

  const model = new ChatOpenRouter({
    model: modelId,
    apiKey: process.env['OPENROUTER_API_KEY'],
    // baseURL defaults to https://openrouter.ai/api/v1 — no need to set
    modelKwargs,
  });

  const boundModel = model.bindTools([...tools]);
  // ... rest unchanged from Phase 10
}
```
**Source:** Constructor shape from `@langchain/openrouter@0.3.0` `dist/chat_models/types.d.ts` (`ChatOpenRouterParams` interface, lines 60-99 of inspected file); `modelKwargs` passthrough confirmed at `dist/chat_models/index.cjs:246` where it spreads last into the request body. [VERIFIED: source inspection]

### B. Backend: extracting reasoning from streamed chunk

```typescript
// apps/backend/src/app/agents/agents.service.ts (excerpt)

private extractChunkReasoning(chunk: unknown): string {
  if (!chunk || typeof chunk !== 'object') return '';
  const additional = (chunk as { additional_kwargs?: Record<string, unknown> })
    .additional_kwargs;
  if (!additional) return '';
  // Primary: DeepSeek/OpenRouter normalized field
  const flat = additional['reasoning_content'];
  if (typeof flat === 'string') return flat;
  // Fallback: structured reasoning_details (e.g. Anthropic format)
  const details = additional['reasoning_details'];
  if (Array.isArray(details)) {
    return details
      .map((d) =>
        d && typeof d === 'object' && 'text' in d && typeof (d as { text: unknown }).text === 'string'
          ? (d as { text: string }).text
          : '',
      )
      .join('');
  }
  return '';
}

async *streamAgent(/* … */): AsyncGenerator<StreamEvent, void, void> {
  // … existing setup …
  let firstReasoningAt: number | null = null;
  let lastReasoningAt: number | null = null;
  let accumulatedReasoning = '';

  for await (const ev of stream) {
    if (signal.aborted) return;
    if (ev.event === 'on_chat_model_stream') {
      const chunk = (ev.data as { chunk?: unknown }).chunk;

      const reasoning = this.extractChunkReasoning(chunk);
      if (reasoning.length > 0) {
        if (firstReasoningAt === null) firstReasoningAt = Date.now();
        lastReasoningAt = Date.now();
        accumulatedReasoning += reasoning;
        yield { type: 'reasoning_token', text: reasoning };
      }

      const text = this.extractChunkText((chunk as { content?: unknown })?.content);
      if (text.length > 0) yield { type: 'token', text };
    }
    // … on_tool_start / on_tool_end unchanged …
  }

  // … existing done-event assembly …
  const reasoningDurationMs =
    firstReasoningAt !== null && lastReasoningAt !== null
      ? lastReasoningAt - firstReasoningAt
      : undefined;

  yield {
    type: 'done',
    response,
    toolCalls,
    reasoning: accumulatedReasoning.length > 0 ? accumulatedReasoning : undefined,
    reasoningDurationMs,
  };
}
```
**Source:** Field names `additional_kwargs.reasoning_content` and `additional_kwargs.reasoning_details` verified from `@langchain/openrouter@0.3.0` `dist/converters/messages.js:38-39` (non-streaming) and `:69-70` (streaming delta path). [VERIFIED: source inspection]

### C. Shared types extension

```typescript
// libs/shared-types/src/lib/chat.types.ts

export interface ChatMessage {
  text: string;
  role: MessageRole;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  reasoning?: string;              // NEW
  reasoningDurationMs?: number;    // NEW (optional — may live in ConversationSession alternative)
}

export interface StreamReasoningTokenEvent {
  type: 'reasoning_token';
  text: string;
}

export interface StreamDoneEvent {
  type: 'done';
  response: string;
  toolCalls?: ToolCallRecord[];
  reasoning?: string;              // NEW
  reasoningDurationMs?: number;    // NEW
}

export type StreamEvent =
  | StreamTokenEvent
  | StreamReasoningTokenEvent      // NEW
  | StreamToolCallStartEvent
  | StreamToolCallResultEvent
  | StreamDoneEvent
  | StreamErrorEvent;
```

### D. Frontend: chat.ts wiring (deltas + auto-collapse)

```typescript
// apps/frontend/src/app/chat/chat.ts (excerpt)

readonly streamingReasoning = signal('');
readonly reasoningCollapsed = signal(false);
readonly reasoningDurationMs = signal<number | undefined>(undefined);

readonly models = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (free)' },
  { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (free)' },
  { id: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B (free)' },
  { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free, reasoning)' },  // NEW
] as const;

private handleStreamEvent(event: StreamEvent): void {
  switch (event.type) {
    case 'reasoning_token': {
      if (this.isLoading) this.isLoading = false;
      this.streamingReasoning.update((s) => s + event.text);
      this.cdr.markForCheck();
      return;
    }
    case 'token': {
      if (this.isLoading) this.isLoading = false;
      // Auto-collapse first time content arrives after reasoning has streamed
      if (this.streamingReasoning().length > 0 && !this.reasoningCollapsed()) {
        this.reasoningCollapsed.set(true);
      }
      this.streamingText.update((s) => s + event.text);
      this.cdr.markForCheck();
      this.scrollToBottom();
      return;
    }
    // tool_call_start / tool_call_result unchanged
    case 'done': {
      this.commitTurn(
        event.response,
        event.toolCalls ?? [],
        event.reasoning,
        event.reasoningDurationMs,
      );
      return;
    }
    // error unchanged
  }
}

private commitTurn(
  response: string,
  toolCalls: ToolCallRecord[],
  reasoning?: string,
  reasoningDurationMs?: number,
): void {
  for (const call of toolCalls) {
    this.messages.push({ /* tool message — unchanged */ });
  }
  const assistantMsg: ChatMessage = {
    text: response,
    role: 'assistant',
    ...(reasoning ? { reasoning } : {}),
    ...(reasoningDurationMs !== undefined ? { reasoningDurationMs } : {}),
  };
  this.messages.push(assistantMsg);
  this.clearStreaming();
  this.finishRequest();
}

private clearStreaming(): void {
  this.streamingText.set('');
  this.streamingReasoning.set('');
  this.reasoningCollapsed.set(false);
  this.reasoningDurationMs.set(undefined);
  this.streamingError.set(null);
  this.streamingToolCalls.set([]);
  this.streamingToolCallIds = [];
  this.isStreaming.set(false);
}
```

### E. MessageBubble slot

```html
<!-- libs/ui/src/lib/message-bubble/message-bubble.html (assistant branch, excerpt) -->
<div class="group relative markdown-bubble max-w-[75%] rounded-2xl rounded-bl-sm px-5 py-4 pr-9 bg-desert-parchment dark:bg-desert-night-parchment text-desert-brown dark:text-desert-night-text border border-desert-gold/40 dark:border-desert-night-border shadow-md dark:shadow-black/30 break-words text-sm font-body leading-relaxed">
  @if (message.reasoning) {
    <app-reasoning-block
      [reasoning]="message.reasoning"
      [streaming]="false"
      [durationMs]="message.reasoningDurationMs"
      [autoCollapsed]="true"
    />
  }
  <markdown [data]="message.text" (ready)="onMarkdownReady()"></markdown>
  <!-- existing buttons unchanged -->
</div>
```

For the in-progress (streaming) assistant bubble, `chat.html` (the parent of `app-message-bubble`) renders a dedicated streaming bubble where it can pass `[reasoning]="streamingReasoning()"`, `[streaming]="isStreaming()"`, `[autoCollapsed]="reasoningCollapsed()"` directly to a separately-instantiated `<app-reasoning-block>` above the streaming markdown — or, depending on existing structure, the streaming text can be wrapped in a temporary `ChatMessage`-shaped object. Plan-check confirms the existing pattern.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ChatOpenAI` with `configuration.baseURL = 'https://openrouter.ai/api/v1'` | Dedicated `@langchain/openrouter` `ChatOpenRouter` class | 2026-02-19 (package first publish) | Reasoning fields surface cleanly through `additional_kwargs`; OpenRouter-specific features (routing, plugins, attribution headers) first-class. |
| Reasoning as `<think>...</think>` tags inlined in content | Separate `reasoning` field on response + `reasoning_details` array on streaming deltas | OpenRouter standardized late 2025 | Reasoning is independently addressable, doesn't pollute the final answer. |
| `include_reasoning: true` boolean | `reasoning: { effort: 'medium' | 'high' | ... }` object | OpenRouter standardized late 2025 | Granular budget control; `include_reasoning` still works as backward-compat alias. |

**Deprecated/outdated:**
- `include_reasoning: true` — still functional but the modern `reasoning: { effort }` shape is recommended. [CITED: openrouter.ai/docs/guides/best-practices/reasoning-tokens]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@langchain/openrouter` v0.3.0 published 2 days before research has no breaking changes vs prior 0.x | Standard Stack | Low — version pinning to `0.3.0` mitigates; planner can verify against changelog before merge. |
| A2 | The `MODEL_CAPABILITIES` map approach is acceptable to the project; no preference for a feature-flag-on-the-model-record pattern surfaced in past code | Patterns | Low — CONTEXT.md D-04 explicitly defers this to "Claude's Discretion." |
| A3 | The `:free` suffix of `deepseek/deepseek-r1:free` is correct at execution time and the free tier is not exhausted | Standard Stack | Medium — OpenRouter free-tier availability fluctuates. Fallback: also accept the paid `deepseek/deepseek-r1` slug; both are in `MODEL_CAPABILITIES`. |
| A4 | LangGraph's `MemorySaver` does not corrupt subsequent turns when the prior assistant message carries `additional_kwargs.reasoning_details` | Common Pitfalls | Medium — see Pitfall 2 / Pitfall 5. Smoke-test in Wave 0. |
| A5 | The existing desert-palette tokens (`desert-brown-muted`, `desert-night-muted`, `desert-border`, `desert-night-border`) are sufficient for the muted treatment without introducing new tokens | Visual | Low — confirmed by reading existing `message-bubble.html`; planner verifies against `tailwind.config.*` during execution. |

## Open Questions

1. **Does the existing `chat.html` template render the in-progress streaming assistant bubble through `app-message-bubble`, or via a separate inline element?**
   - What we know: `chat.ts` maintains `streamingText` and writes it into the streaming bubble.
   - What's unclear: The exact template structure for the live bubble (not read in research).
   - Recommendation: Planner reads `chat.html` in the first task; if it uses `app-message-bubble` for the streaming bubble too, pass `reasoning`/`streaming`/`autoCollapsed` via a synthesized `ChatMessage`-like object; if it's an inline `<div>`, instantiate `<app-reasoning-block>` directly above.

2. **Does `MemorySaver` need a sanitizer to strip `additional_kwargs.reasoning_details` before checkpointing to avoid Pitfall 2 / 5?**
   - What we know: Python langchain has this bug ([langchain#36400](https://github.com/langchain-ai/langchain/issues/36400)); JS likely shares the codepath.
   - What's unclear: Whether the JS `MemorySaver` codepath has the same issue or has been patched.
   - Recommendation: Add a smoke test "2 sequential turns on `deepseek/deepseek-r1:free`" and "switch model mid-thread" to Wave 0. If either fails, add a small message-reducer in `AgentState` that strips reasoning kwargs from persisted AIMessages.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend + Nx tooling | ✓ | 24.12.0 (per STATE.md) | — |
| `pnpm` | Package manager | ✓ | (project standard) | — |
| `@langchain/openrouter` | Backend reasoning pass-through | ✗ (not yet installed) | needs `^0.3.0` | None — Pitfall 1 documents why `ChatOpenAI` fallback is unsafe. Planner must install. |
| `OPENROUTER_API_KEY` env var | Backend | ✓ (Phase 1) | — | — |
| OpenRouter `deepseek/deepseek-r1:free` endpoint reachable | Runtime model dispatch | Assumed ✓ — listed on openrouter.ai/deepseek/deepseek-r1:free | — | Paid `deepseek/deepseek-r1` (same code path; same model-capabilities map entry). |
| Storybook | `ReasoningBlock` story (Req 5 acceptance) | ✓ (per project profile) | — | — |
| Playwright (E2E) | Regression check (zero-reg on default model) | ✓ (existing `frontend-e2e`) | — | — |

**Missing dependencies with no fallback:**
- `@langchain/openrouter` — must be installed before this phase compiles.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (unit, via Nx defaults for NestJS + Angular) + Playwright (E2E in `frontend-e2e`) + Storybook (visual / component contract for presentational UI) |
| Config file | `apps/backend/jest.config.ts`, `apps/frontend/jest.config.ts` (per Nx defaults — verify exact paths in Wave 0) |
| Quick run command | `pnpm nx test backend --watch=false` / `pnpm nx test frontend --watch=false` |
| Full suite command | `pnpm nx run-many -t test,lint,build` followed by `pnpm nx e2e frontend-e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Req 1 | Default model emits no reasoning_token; reasoning model emits ≥1 reasoning_token | integration (backend) | `pnpm nx test backend -t "streamAgent reasoning gating"` | ❌ Wave 0 |
| Req 2 | `modelKwargs.reasoning` is present in upstream request for reasoning model and absent for default | unit (backend) | `pnpm nx test backend -t "buildGraph attaches reasoning modelKwargs only when capability is set"` | ❌ Wave 0 |
| Req 3 | `StreamEvent` union includes `reasoning_token`; `done.reasoning` equals concatenation of all `reasoning_token.text` | unit (shared-types compile) + integration (backend) | `pnpm nx build shared-types` + `pnpm nx test backend -t "done event includes concatenated reasoning"` | ❌ Wave 0 |
| Req 4 | `ChatMessage.reasoning` persists round-trip through `HistoryService` | unit (frontend) | `pnpm nx test frontend -t "HistoryService preserves reasoning on assistant message"` | ❌ Wave 0 |
| Req 5 | `ReasoningBlock` renders for non-empty reasoning, not rendered for empty | unit (component) + Storybook story | `pnpm nx test ui -t "ReasoningBlock"` + `pnpm nx storybook ui` (manual visual) | ❌ Wave 0 |
| Req 6 | Muted Tailwind classes only from desert palette | manual-only (visual inspection in both themes via Storybook) | n/a — visual | ❌ Wave 0 (story) |
| Req 7 | Block collapsed on first content `token` after streamingReasoning > 0; toggle re-expands | unit (frontend chat.ts handler) + E2E (live stream) | `pnpm nx test frontend -t "handleStreamEvent collapses on first token after reasoning"` + `pnpm nx e2e frontend-e2e --grep "reasoning collapse"` | ❌ Wave 0 |
| Req 8 | `reasoningDurationMs` = lastTs - firstTs; label rounds correctly (`<1s` rule) | unit (backend timing + frontend label) | `pnpm nx test backend -t "reasoning duration"` + `pnpm nx test ui -t "ReasoningBlock durationLabel"` | ❌ Wave 0 |
| Req 9 | Tool-call turn on reasoning model produces exactly one reasoning block + tool-call bubbles in existing position | E2E | `pnpm nx e2e frontend-e2e --grep "reasoning with tool call"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm nx affected -t test,lint --base=HEAD~1`
- **Per wave merge:** `pnpm nx run-many -t test,lint,build`
- **Phase gate:** Full suite green + Playwright E2E pass on default model (zero regression) + manual smoke on `deepseek/deepseek-r1:free`.

### Wave 0 Gaps
- [ ] `apps/backend/src/app/agents/agents.service.spec.ts` — gain new describe blocks for reasoning extraction + duration + done-event enrichment
- [ ] `apps/backend/src/app/agents/model-capabilities.spec.ts` — new file
- [ ] `apps/frontend/src/app/chat/chat.service.spec.ts` — extend with `reasoning_token` parsing case
- [ ] `apps/frontend/src/app/chat/chat.spec.ts` — new (or extend) for `handleStreamEvent` auto-collapse + commitTurn-with-reasoning
- [ ] `apps/frontend/src/app/chat/history.service.spec.ts` — verify `ChatMessage.reasoning` round-trips
- [ ] `libs/ui/src/lib/reasoning-block/reasoning-block.spec.ts` — new unit test
- [ ] `libs/ui/src/lib/reasoning-block/reasoning-block.stories.ts` — new Storybook story (Req 5 acceptance)
- [ ] `apps/frontend-e2e/src/reasoning.spec.ts` — new E2E covering reasoning stream + auto-collapse + tool-call interleaving
- [ ] Install: `pnpm add @langchain/openrouter`

## Security Domain

`security_enforcement` is not explicitly set in `.planning/config.json`; treating as enabled (absent = enabled). Phase 11 surface area is narrow.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth is out of scope per REQUIREMENTS.md |
| V3 Session Management | no | Per-session threadId already established (Phase 1) |
| V4 Access Control | no | No new endpoints |
| V5 Input Validation | yes | Existing NestJS validation on `ChatRequest` continues to apply; `reasoning_token.text` on the wire is server-emitted (trusted source), no new user input boundary |
| V6 Cryptography | no | No new crypto |
| V7 Error Handling | yes | Reasoning errors fold into existing error path in `streamAgent` catch block — confirm reasoning timestamps and partial accumulated reasoning don't leak into the user-visible error string |
| V14 Configuration | yes | `OPENROUTER_API_KEY` already secret; no new secrets |

### Known Threat Patterns for Angular + NestJS + LangGraph + OpenRouter

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via reasoning content rendered as HTML | Tampering | SPEC requires plain text + `whitespace-pre-wrap`; NEVER pass reasoning through `[innerHTML]` or `<markdown>`. Use Angular text interpolation `{{ message.reasoning }}` only. |
| Reasoning trace leaks secrets if the user pasted them | Information Disclosure | Out of scope for Phase 11 (same risk as the final answer). Document in README that reasoning traces may echo back user input verbatim. |
| Excessive reasoning tokens cause cost overrun on paid models | Denial-of-service (cost) | D-01 uses `:free` tier exclusively; if a paid reasoning model is later added, gate via `reasoning.max_tokens` cap on `modelKwargs`. |

## Sources

### Primary (HIGH confidence)
- `@langchain/openrouter@0.3.0` source code (`dist/chat_models/types.d.ts`, `dist/chat_models/index.cjs`, `dist/converters/messages.js`, `dist/api-types.d.ts`) — inspected directly via `npm pack`. The chunk-converter code confirming `additional_kwargs.reasoning_content` and `additional_kwargs.reasoning_details` field names is at `dist/converters/messages.js:38-39, 56-70`.
- npm registry: `@langchain/openrouter` versions, maintainers, dependencies (`npm view`).
- OpenRouter docs: [Reasoning Tokens best practices](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) — confirms `reasoning: { effort: 'medium' }` request shape and `delta.reasoning_details` streaming field.
- Existing project code: `apps/backend/src/app/agents/agents.service.ts`, `apps/backend/src/app/agents/agents.controller.ts`, `apps/frontend/src/app/chat/chat.ts`, `apps/frontend/src/app/chat/chat.service.ts`, `libs/shared-types/src/lib/chat.types.ts`, `libs/ui/src/lib/message-bubble/message-bubble.{ts,html}`, `libs/ui/src/lib/model-selector/model-selector.ts`.
- Phase 10 CONTEXT.md — confirms transport reuse posture and signal-driven render cadence.

### Secondary (MEDIUM confidence)
- GitHub issue [langchain-ai/langchain#35059](https://github.com/langchain-ai/langchain/issues/35059) — "ChatOpenAI silently drops 'reasoning_content' from OpenAI-compatible providers" (Python; JS likely shares the codepath structure).
- GitHub issue [langchain-ai/langchain#32981](https://github.com/langchain-ai/langchain/issues/32981) — "Reasoning tokens not passing through from OpenRouter to ChatOpenAI" (Python; same caveat).
- GitHub issue [langchain-ai/langchain#36400](https://github.com/langchain-ai/langchain/issues/36400) — `reasoning_details` fragmentation in multi-turn (Python).
- OpenRouter [DeepSeek R1 (free)](https://openrouter.ai/deepseek/deepseek-r1:free) — model card confirming free tier, reasoning capability, weekly token allocation.
- [LangChain forum: Getting annotations and reasoning from AIMessageChunk](https://forum.langchain.com/t/getting-annotations-and-reasoning-from-aimessagechunk/982).

### Tertiary (LOW confidence)
- Various Medium articles on OpenRouter + LangChain JS — used only for cross-referencing constructor signatures; none cited as primary evidence.

## Metadata

**Confidence breakdown:**
- Standard stack (`@langchain/openrouter` choice and chunk-field names): **HIGH** — confirmed by inspecting the published 0.3.0 dist source directly.
- Architecture (extending Phase 10 SSE pipeline, signal pattern, presentational ReasoningBlock): **HIGH** — direct reading of existing code.
- Pitfalls (especially Pitfalls 2 and 5 — JS reasoning_details fragmentation across turns): **MEDIUM** — Python issues exist; JS may or may not share the bug. Wave 0 smoke tests cover both scenarios.
- Reasoning effort granularity (`medium` correctly mapping to ~50% of max_tokens): **MEDIUM** — documented by OpenRouter but exact behavior is provider-dependent.

**Research date:** 2026-05-24
**Valid until:** 2026-06-23 (30 days; revisit if `@langchain/openrouter` ships a major release in that window — current 0.3.0 was published 2 days before research)
