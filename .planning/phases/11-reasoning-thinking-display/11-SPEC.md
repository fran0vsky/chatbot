# Phase 11: Reasoning / Thinking Display — Specification

**Created:** 2026-05-23
**Ambiguity score:** 0.12 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

When a reasoning-capable OpenRouter model is selected, the model's reasoning trace streams into the assistant message bubble as a visually muted block above the final answer; the block auto-expands during streaming, collapses when streaming completes, and reappears (collapsed) when the session is revisited from the sidebar.

## Background

Phase 10 shipped an SSE pipeline (`POST /agents/chat` → `StreamEvent` discriminated union of `token | tool_call_start | tool_call_result | done | error`) consumed by [chat.service.ts](apps/frontend/src/app/chat/chat.service.ts) and rendered word-by-word in [message-bubble.ts](libs/ui/src/lib/message-bubble/message-bubble.ts). The backend uses `graph.streamEvents(..., { version: 'v2' })` in [agents.service.ts](apps/backend/src/app/agents/agents.service.ts) and forwards `on_chat_model_stream` chunks as `token` events. OpenRouter's reasoning output (delivered as a separate field on the chat completion delta when `reasoning: { effort }` or `include_reasoning: true` is set on the request) is currently dropped — the LangChain `extractChunkText` helper only reads `content`. `ChatMessage` has no `reasoning` field. No UI surface exists for reasoning. The mentor asked for thinking traces to be visible, muted, distinct from the final answer.

## Requirements

1. **Reasoning-capable model selectable**: User can choose a reasoning model from the existing model selector; default remains `openai/gpt-4o-mini` so existing behavior is unchanged for users who don't opt in.
   - Current: Model selector exposes non-reasoning models; no reasoning model option exists
   - Target: At least one reasoning-capable OpenRouter model is added to the selector (specific model ID chosen at discuss-phase against live OpenRouter availability); default selection stays `openai/gpt-4o-mini`
   - Acceptance: With default model, no `reasoning_token` events are emitted and no reasoning block renders; selecting the reasoning model and sending a message emits ≥1 `reasoning_token` event

2. **Backend requests reasoning output from OpenRouter**: When the active model is reasoning-capable, the chat completion request enables reasoning output.
   - Current: `ChatOpenAI` is instantiated without any reasoning parameter
   - Target: The reasoning parameter (exact shape — `reasoning: { effort: "medium" }` vs `include_reasoning: true` vs `extraBody` passthrough — confirmed at discuss-phase against current OpenRouter docs) is sent on requests routed to reasoning-capable models; non-reasoning models receive the unchanged request
   - Acceptance: Backend log or network capture shows the reasoning parameter present in the upstream OpenRouter request for the reasoning model and absent for `openai/gpt-4o-mini`

3. **New `reasoning_token` SSE event**: Reasoning deltas flow through the existing SSE pipe as a new discriminated event variant.
   - Current: `StreamEvent` union has `token | tool_call_start | tool_call_result | done | error`; no event carries reasoning text
   - Target: `StreamEvent` includes `{ type: 'reasoning_token'; text: string }`; backend emits one `reasoning_token` per reasoning delta from the model; `done` event carries the final concatenated `reasoning` string alongside `response` and `toolCalls`
   - Acceptance: TypeScript build of `@org/shared-types` succeeds with new variant; a streamed turn from the reasoning model yields `reasoning_token` events before the first `token` event; `done.reasoning` equals the concatenation of all emitted `reasoning_token.text` for that turn

4. **Reasoning persisted on the assistant message**: Reasoning text is stored alongside `text` on the assistant `ChatMessage` so it survives sidebar navigation within the session.
   - Current: `ChatMessage` has `text`, `role`, `toolName`, `toolArgs`, `toolResult` — no reasoning field
   - Target: `ChatMessage` gains optional `reasoning?: string`; chat.service writes the accumulated reasoning into the persisted assistant message on `done`; `ConversationSession.messages` round-trips the field through whatever store backs the sidebar
   - Acceptance: After sending a message with the reasoning model, navigating to another session in the sidebar and back, the original assistant bubble still displays its reasoning block (collapsed)

5. **`ReasoningBlock` component**: New standalone OnPush Angular component renders the reasoning text inside the assistant `MessageBubble`, above the markdown content.
   - Current: No reasoning UI exists; `MessageBubble` renders only `text` (via markdown) and tool metadata
   - Target: A `ReasoningBlock` standalone component (OnPush) takes `reasoning: string` + `streaming: boolean` + `durationMs?: number` inputs and renders above the content slot in assistant `MessageBubble`; not rendered when reasoning is empty/absent
   - Acceptance: Storybook story renders `ReasoningBlock` with sample reasoning text; assistant message with reasoning shows the block above content; assistant message without reasoning shows no block (no empty container, no extra spacing)

6. **Muted, secondary visual treatment**: Reasoning is visually clearly subordinate to the final answer in both day and night themes.
   - Current: N/A
   - Target: Tailwind classes only, drawing from the existing desert palette — smaller font (`text-sm`), muted text color (`text-stone-500 dark:text-stone-400` or palette-matching desert-muted token), subtle left border or background tint to demarcate the region; no bright accent colors; italic optional
   - Acceptance: Side-by-side with the final answer in both day and night modes, the reasoning block reads as secondary on first glance (lower contrast, smaller); manual inspection confirms no Tailwind class outside the existing desert palette is introduced

7. **Live streaming + auto-collapse on completion**: During streaming the block auto-expands so the user watches reasoning unfold; on the `done` event (or when the first `token` for content arrives, whichever the implementation chooses) it auto-collapses; the user can toggle it back open.
   - Current: N/A
   - Target: Block is expanded while `streaming === true`; on stream completion the block transitions to collapsed; a toggle button labeled "Show reasoning" / "Hide reasoning" (with the duration meta — see Req 8) re-expands/collapses; reasoning text continues to stream token-by-token through the same incremental render mechanism used for content tokens in Phase 10
   - Acceptance: During a live reasoning stream the block is visible and updates token-by-token; within 1 frame of `done`, the block collapses; clicking the toggle re-expands it; re-collapses on second click

8. **"Thought for Xs" duration meta**: The toggle label includes the reasoning duration in seconds.
   - Current: N/A
   - Target: Backend measures elapsed wall time from the first `reasoning_token` to the last `reasoning_token` for the turn and includes `reasoningDurationMs?: number` on the `done` event (or frontend computes the same locally); toggle label reads e.g. "Thought for 4s · Show reasoning" / "Thought for 4s · Hide reasoning"; rounded to whole seconds (`<1s` shown as "<1s")
   - Acceptance: After a streamed turn, the toggle label displays the elapsed reasoning duration; a turn with no reasoning has no toggle (block isn't rendered); the displayed seconds are within ±1s of the observed stream duration

9. **Single merged reasoning block per turn (tool-call interleaving)**: Even when the model reasons → calls a tool → reasons again → answers, the UI shows one consolidated reasoning block above the final answer; tool-call bubbles still render in their existing position in the timeline.
   - Current: N/A (no reasoning); tool-call bubbles render as separate `tool` role messages between user and assistant via splice logic in chat.ts
   - Target: All `reasoning_token` events for a single user→assistant turn concatenate into one `reasoning` string on the assistant message; tool-call rendering from Phase 9 is untouched; visual order: user message → tool-call bubble(s) → assistant bubble (reasoning block on top, final answer below)
   - Acceptance: A turn that exercises the reasoning model with a tool call shows exactly one reasoning block on the assistant bubble containing the merged trace, plus the tool-call bubble(s) rendered in their existing style; tool-call bubbles are unchanged from Phase 9 behavior

## Boundaries

**In scope:**
- New `reasoning_token` variant on `StreamEvent`; `done` event carries `reasoning` and `reasoningDurationMs`
- `ChatMessage.reasoning?: string` field; session persistence round-trip
- Backend: send the reasoning request parameter for reasoning-capable models; capture reasoning deltas from the LangChain stream and emit them as `reasoning_token` events; measure duration
- One reasoning-capable model added to the model selector (specific ID chosen at discuss-phase)
- `ReasoningBlock` standalone OnPush component with muted Tailwind styling, day + night theme support, "Thought for Xs · Show/Hide reasoning" toggle, auto-expand-during-stream → auto-collapse-on-done behavior
- Integration into assistant `MessageBubble` above the content slot
- Single merged reasoning block per assistant turn, regardless of tool-call interleaving

**Out of scope:**
- Per-message reasoning-effort selector in UI — locked to "medium" for now per scope brief
- Reasoning specifically tied to tool-call decisions — only whatever reasoning the model emits naturally
- Editing or copying reasoning text — only the final answer keeps its copy button from earlier phases
- Reasoning summarization, post-processing, or markdown rendering — reasoning displayed as plain text/preformatted
- Database persistence of reasoning across sessions — current per-session MemorySaver / sidebar store stays
- GCS / Cloud Run deploy of this feature — Phase 12
- Token-count display next to the toggle — duration only

**Constraints:**
- Tech stack locked: Angular + NestJS + LangGraph + OpenRouter — no framework changes
- Tailwind-only styling — no inline styles, no new CSS files outside existing component patterns
- Angular standalone components with OnPush change detection
- Reuses Phase 10's SSE pipeline as the single transport — must not introduce a parallel WebSocket or second HTTP channel
- Per-session `MemorySaver` stays; no database
- Desert palette must accommodate the muted color in both day and night modes — palette tokens from existing Tailwind config
- Non-reasoning models must keep behaving exactly as Phase 10 — zero regressions in streaming, tool calls, history, model selector

## Acceptance Criteria

- [ ] `StreamEvent` union in `@org/shared-types` includes `{ type: 'reasoning_token'; text: string }` and `done` carries optional `reasoning` and `reasoningDurationMs`; project builds clean
- [ ] `ChatMessage` includes optional `reasoning?: string`; type compiles across backend and frontend
- [ ] With the default model (`openai/gpt-4o-mini`), no `reasoning_token` events are emitted and no reasoning block renders — chat behaves exactly as Phase 10
- [ ] With the reasoning model selected, sending a message emits ≥1 `reasoning_token` event before the first `token` event
- [ ] Reasoning block streams visibly token-by-token while auto-expanded; the final answer appears below it and also streams
- [ ] On stream `done`, the reasoning block auto-collapses; clicking the toggle re-expands it; second click re-collapses
- [ ] Toggle label displays "Thought for Xs · Show/Hide reasoning" with X within ±1s of observed stream duration
- [ ] Navigating away in the sidebar and back to the original session shows the reasoning block (collapsed) on prior assistant messages that had reasoning
- [ ] A turn with a tool call (e.g. `get_current_time`) on the reasoning model shows: user → tool-call bubble (Phase 9 styling unchanged) → assistant bubble with one merged reasoning block on top and final answer below
- [ ] Both day and night themes render the reasoning block at visibly muted contrast (manual inspection passes); only existing desert palette tokens used
- [ ] No regressions: lint, typecheck, and existing Playwright E2E still pass against default-model behavior

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                |
|--------------------|-------|------|--------|------------------------------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      | Specific outcome, measurable                         |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | Explicit in/out scope with reasons                   |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Reuses Phase 10 transport; palette + OnPush locked   |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 11 pass/fail checks                                  |
| **Ambiguity**      | 0.12  | ≤0.20| ✓      | Gate passed after 1 question round                   |

## Interview Log

| Round | Perspective    | Question summary                                      | Decision locked                                                  |
|-------|----------------|-------------------------------------------------------|------------------------------------------------------------------|
| 1     | Seed Closer    | Stream UX — auto-expand live vs collapsed spinner?    | Auto-expand live, auto-collapse on done                          |
| 1     | Seed Closer    | Show duration / token count on toggle?                | Duration only — "Thought for Xs"                                 |
| 1     | Seed Closer    | Tool-call interleaving — one block or many?           | Single merged reasoning block per turn                           |
| 1     | Seed Closer    | Default model — switch to reasoning or keep gpt-4o?   | Keep gpt-4o-mini default; add reasoning model as selectable      |

**Deferred to discuss-phase (implementation, not scope):**
- Exact OpenRouter reasoning API shape (`reasoning: { effort }` vs `include_reasoning: true` vs `extraBody`) — confirm against live docs
- Exact reasoning-model ID to add to the selector — depends on OpenRouter free-tier availability at exec time (candidates: `deepseek/deepseek-r1`, `openai/o1-mini`)
- Whether `reasoningDurationMs` is measured server-side and shipped on `done`, or computed client-side from first/last `reasoning_token` timestamps

---

*Phase: 11-reasoning-thinking-display*
*Spec created: 2026-05-23*
*Next step: /gsd-discuss-phase 11 — implementation decisions (OpenRouter API shape, model ID, duration measurement location, splice logic for reasoning into MessageBubble)*
