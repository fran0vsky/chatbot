# Phase 11: Reasoning / Thinking Display — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

When a reasoning-capable OpenRouter model is selected, the model's reasoning trace streams into the assistant message bubble as a visually muted block above the final answer. The block auto-expands while reasoning streams, auto-collapses when the model starts producing the final answer, and reappears (collapsed) when the session is revisited from the sidebar. One merged reasoning block per assistant turn, regardless of tool-call interleaving. Reuses the Phase 10 SSE pipeline as the single transport — no new channel, no database.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See [11-SPEC.md](11-SPEC.md) for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `11-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- New `reasoning_token` variant on `StreamEvent`; `done` event carries `reasoning` and `reasoningDurationMs`
- `ChatMessage.reasoning?: string` field; session persistence round-trip
- Backend: send reasoning request parameter for reasoning-capable models; capture reasoning deltas from the LangChain stream and emit them as `reasoning_token` events; measure duration
- One reasoning-capable model added to the model selector
- `ReasoningBlock` standalone OnPush component with muted Tailwind styling, day + night theme support, "Thought for Xs · Show/Hide reasoning" toggle, auto-expand-during-stream → auto-collapse behavior
- Integration into assistant `MessageBubble` above the content slot
- Single merged reasoning block per assistant turn, regardless of tool-call interleaving

**Out of scope (from SPEC.md):**
- Per-message reasoning-effort selector in UI (locked to "medium")
- Reasoning tied specifically to tool-call decisions
- Editing/copying reasoning text
- Reasoning summarization, post-processing, markdown rendering
- Database persistence across sessions
- GCS / Cloud Run deploy (Phase 12)
- Token-count display

</spec_lock>

<decisions>
## Implementation Decisions

### Reasoning Model

- **D-01:** Add **`deepseek/deepseek-r1`** to the model selector as the reasoning-capable option.
  - Free tier on OpenRouter — no cost risk during dev/demo.
  - Emits visible chain-of-thought as separate reasoning deltas (well-known property of R1-family models), which is what this phase needs to stream.
  - Default selection remains `openai/gpt-4o-mini` — non-opt-in users see zero behavior change (Req 1).

### Collapse Trigger

- **D-02:** Reasoning block **auto-collapses on the first content `token` event**, not on `done`.
  - As soon as the model starts producing the final answer, focus shifts to the answer; reasoning is "past".
  - Matches the UX of ChatGPT / Claude reasoning surfaces.
  - The block keeps streaming reasoning into its (now collapsed) state — `reasoning_token` events arriving after the first `token` (rare, but possible if the model interleaves) still append to the reasoning string; the toggle re-expands to show the full trace.

### Visual Treatment

- **D-03:** **Left border + smaller muted text.** Quote-like demarcation, no background fill.
  - Concrete Tailwind shape (planner refines exact tokens against the desert palette config):
    - Container: `border-l-2 border-stone-300 dark:border-stone-700 pl-3 py-1`
    - Text: `text-sm text-stone-500 dark:text-stone-400`
    - Preformatted whitespace: `whitespace-pre-wrap` (reasoning is plain text per SPEC, not markdown)
    - No italic, no monospace, no background tint.
  - Toggle button styled with the same muted palette — small, inline, no accent color.
  - Constraint: only existing desert palette tokens; if `stone-*` is not the canonical muted shade in this project's Tailwind config, planner substitutes the matching palette-muted token without changing the visual intent.

### Duration Measurement

- **D-04:** **Server-side.** Backend stamps `Date.now()` on first and last `reasoning_token` for the turn and ships `reasoningDurationMs?: number` on the `done` event.
  - Measures actual model reasoning time, not network jitter.
  - Single source of truth — frontend just reads the field; no duplicate timing logic.
  - SPEC explicitly permits this on the `done` payload (Req 8 target).
  - Display formatting (rounding to whole seconds, `<1s` rule) is frontend-only.

### Claude's Discretion

- Exact OpenRouter reasoning API shape (`reasoning: { effort: "medium" }` body field vs `include_reasoning: true` vs LangChain `extraBody` passthrough) — **researcher resolves against live OpenRouter docs**. Constraint: "medium" effort, applied only when the active model is reasoning-capable; non-reasoning models receive the unchanged request (Req 2).
- Where in the backend `reasoning-capable model? → send reasoning param` lives (a model-config map, a per-model strategy, a feature flag on the model record in the selector). Planner picks the cleanest fit with the existing model-selector code.
- Whether `extractChunkText` is extended to also extract reasoning, or a parallel `extractChunkReasoning` is added. Implementation detail.
- Exact in-progress reasoning storage shape on the streaming message item (signal-backed `reasoning` field on the in-progress assistant message, mirroring Phase 10's text-streaming pattern). Follow the Phase 10 pattern; planner picks the exact field shape.
- Where the "first content `token` after reasoning started" detection lives (chat.service vs message-bubble vs ReasoningBlock host). Pick the spot that keeps `ReasoningBlock` dumb/presentational.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Spec (locked requirements)
- [.planning/phases/11-reasoning-thinking-display/11-SPEC.md](11-SPEC.md) — 9 locked requirements, in/out of scope, acceptance criteria. MUST read.

### Prior phase context (carries forward)
- [.planning/phases/10-token-streaming-sse-word-by-word-render/10-CONTEXT.md](../10-token-streaming-sse-word-by-word-render/10-CONTEXT.md) — SSE transport (fetch + ReadableStream + AbortController), signal-driven render cadence, mid-stream error UX. Phase 11 reuses all of it.
- [.planning/phases/09-tool-calling-function-calling/09-CONTEXT.md](../09-tool-calling-function-calling/09-CONTEXT.md) — `ToolCallRecord` shape and tool-call bubble splice logic (untouched by Phase 11 per Req 9).

### Backend touchpoints
- [apps/backend/src/app/agents/agents.service.ts](../../../apps/backend/src/app/agents/agents.service.ts) — `graph.streamEvents(..., { version: 'v2' })`, `on_chat_model_stream` handler, `extractChunkText` helper. Where reasoning-delta extraction is added and where the per-turn first/last reasoning timestamps are captured.
- [apps/backend/src/app/agents/agents.controller.ts](../../../apps/backend/src/app/agents/agents.controller.ts) — SSE endpoint. Where `reasoning_token` events are written to the stream and where `done` is enriched with `reasoning` + `reasoningDurationMs`.

### Shared types
- [libs/shared-types](../../../libs/shared-types) — `StreamEvent` discriminated union gains `{ type: 'reasoning_token'; text: string }`; `done` payload gains optional `reasoning` and `reasoningDurationMs`. `ChatMessage` gains optional `reasoning?: string`.

### Frontend touchpoints
- [apps/frontend/src/app/chat/chat.service.ts](../../../apps/frontend/src/app/chat/chat.service.ts) — SSE consumer. Handles new `reasoning_token` event variant, accumulates reasoning into the in-progress assistant message, writes the final `reasoning` string on `done`.
- [libs/ui/src/lib/message-bubble/message-bubble.ts](../../../libs/ui/src/lib/message-bubble/message-bubble.ts) — assistant bubble. New `ReasoningBlock` slots in above the content/markdown slot when `reasoning` is non-empty.
- [libs/ui/src/lib/model-selector/](../../../libs/ui/src/lib/model-selector/) — where `deepseek/deepseek-r1` is added as a selectable option.

### Frontend conventions
- [apps/frontend/CLAUDE.md](../../../apps/frontend/CLAUDE.md) — standalone components + OnPush + Tailwind-only rules apply.
- Storybook is the test surface for presentational components (per project profile — `ReasoningBlock` needs a story per Req 5 acceptance).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 10 SSE pipeline** (chat.service + agents.controller + agents.service): The transport is already streaming. Phase 11 just adds a new `StreamEvent` variant and wires it through; no new HTTP channel, no new abort path.
- **Signal-driven render pattern** from Phase 10: the in-progress assistant message's `text` is signal-backed and triggers OnPush CD on every token append. Apply the same pattern to a parallel `reasoning` signal on the same in-progress message item — no new infrastructure.
- **`HistoryService.upsertSession()`**: already persists the assistant message on `done`. Once `ChatMessage.reasoning` exists, the reasoning round-trips for free through the existing sidebar store — Req 4 falls out of the type addition.
- **`MessageBubble` (libs/ui/src/lib/message-bubble)**: the host where `ReasoningBlock` is composed in above the content slot. No fork — extend.
- **Phase 9 tool-call bubble splice logic** in `chat.ts`: untouched. Tool-call bubbles still render in their existing timeline position (Req 9).

### Established Patterns
- **Presentational vs smart split** ([feedback_angular_component_architecture]): `ReasoningBlock` is **presentational** — no domain word in the name (it's "reasoning" the visual element, not "reasoning" a service concept tied to chat state); no injected services; needs a Storybook story. Inputs only: `reasoning: string`, `streaming: boolean`, `durationMs?: number`. Toggle open/closed state is local component state (signal).
- **Standalone + OnPush + Tailwind-only** across all UI components.
- **Desert palette** (Tailwind config) — `stone-*` muted tokens are the established muted-secondary shade; planner verifies exact tokens against the existing palette config and substitutes if a project-specific token name is used instead.

### Integration Points
- `StreamEvent` union (shared-types) — add the new variant. All consumers (chat.service switch, agents.controller writer) get a TS error if they don't handle it — the compiler enforces full integration.
- `ChatMessage` (shared-types) — add `reasoning?: string`. Optional → no breaking changes for existing messages without reasoning.
- LangChain `on_chat_model_stream` handler — the new extraction point for reasoning deltas. Researcher must confirm the exact field on the OpenRouter delta (likely `reasoning` or `reasoning_content` depending on the API shape chosen).
- Model selector → backend model-config — wherever the active model ID flows into the `ChatOpenAI` constructor is where the reasoning-param toggle attaches.

</code_context>

<specifics>
## Specific Ideas

- Toggle label format: `Thought for 4s · Show reasoning` / `Thought for 4s · Hide reasoning` (SPEC Req 8 wording). `<1s` for sub-second durations.
- "On first content `token`" collapse trigger should fire within 1 frame of that token (SPEC Req 7 acceptance: "within 1 frame of `done`" — same latency budget applies to the new trigger).
- Reasoning text is plain text — `whitespace-pre-wrap`, no markdown rendering (out of scope per SPEC).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-reasoning-thinking-display*
*Context gathered: 2026-05-23*
