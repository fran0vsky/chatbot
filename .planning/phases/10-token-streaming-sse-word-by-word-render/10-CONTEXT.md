# Phase 10: Token Streaming (SSE, word-by-word render) — Context

**Created:** 2026-05-23
**Spec:** [10-SPEC.md](10-SPEC.md) — 9 requirements locked
**Mode:** discuss (3 gray areas captured)

## Domain

Convert the chat pipeline from request/response to Server-Sent Events so assistant tokens (and tool-call events) reach the UI as the LangGraph run produces them. Goal: visible token-by-token rendering, working stop-mid-stream, and a transport that Phase 11 (reasoning display) can reuse.

## Spec Lock

Requirements 1–9 in [10-SPEC.md](10-SPEC.md) are locked. Downstream agents MUST read SPEC.md before planning. This CONTEXT.md captures only the HOW choices the SPEC deferred to this step.

## Canonical Refs

- [.planning/phases/10-token-streaming-sse-word-by-word-render/10-SPEC.md](10-SPEC.md) — Locked requirements — MUST read before planning
- [.planning/phases/09-tool-calling-function-calling/09-CONTEXT.md](../09-tool-calling-function-calling/09-CONTEXT.md) — Tool call event shape (`ToolCallRecord`) that must flow through the stream
- [apps/backend/src/app/agents/agents.service.ts](../../../apps/backend/src/app/agents/agents.service.ts) — current `graph.invoke()` site, `extractTurnToolCalls()` helper
- [apps/backend/src/app/agents/agents.controller.ts](../../../apps/backend/src/app/agents/agents.controller.ts) — current `POST /agents/chat` endpoint
- [apps/frontend/src/app/chat/chat.service.ts](../../../apps/frontend/src/app/chat/chat.service.ts) — current `HttpClient.post` consumer
- [apps/frontend/src/app/chat/chat.ts](../../../apps/frontend/src/app/chat/chat.ts) — `ChatComponent`, owns `isLoading` and stop-button
- [libs/shared-types](../../../libs/shared-types) — home of new `StreamEvent` discriminated union
- [apps/frontend/CLAUDE.md](../../../apps/frontend/CLAUDE.md) — Angular standalone + OnPush + Tailwind rules apply

## Decisions

### 1. Transport: `fetch` + `ReadableStream` (no library)

Frontend consumes the SSE stream by calling `fetch(POST, body)` and reading `response.body.getReader()` chunk by chunk. SSE frames parsed manually (`split('\n\n')`, strip `data: ` prefix, `JSON.parse` each frame as a `StreamEvent`). Cancellation via `AbortController` wired to the Stop button.

**Why not EventSource:** EventSource is GET-only. Current `ChatRequest` (`{ message, threadId, model }`) is sent as a POST body; switching to GET would require URL-encoding the message, which breaks for long prompts and is awkward to type. Also, the server completes once per request — auto-reconnect (EventSource's main perk) is actively unwanted.

**Why not a library:** ~30 lines of parsing isn't worth a dependency; the framework is locked (Angular + RxJS / signals).

**Implications for planner:**
- `ChatService.sendMessage()` return shape changes from `Observable<ChatResponse>` to a stream-like API. Options: `Observable<StreamEvent>` via custom RxJS Subject, or an async iterator. Planner picks the shape that fits `ChatComponent` cleanest, but it MUST give the component a way to subscribe to each event and a way to abort.
- Backend response: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. NestJS supports this via `@Sse()` decorator OR raw `Response.write()` on the underlying Express response — planner chooses; both are acceptable.
- Backend MUST detect client disconnect (Express `req.on('close')`) to cancel the LangGraph run (Requirement 9).

### 2. Render cadence: every token, signal-driven

The in-progress assistant message's text is held in an Angular `signal<string>` (or an object property on a signal-backed message model). Each `token` event appends to it; the signal write triggers CD on the OnPush bubble component. No manual batching, no `requestAnimationFrame` queue, no throttle timer.

**Why:** The browser already coalesces signal-driven CD to paint frames (~60fps). Token arrival rate from OpenRouter (a few hundred tokens/sec at most) is well below paint rate. Adding batching is premature optimization and adds perceived latency, which directly contradicts the "TTFT visibly shorter" acceptance criterion.

**Implications for planner:**
- The message model in `ChatComponent` must be revised so the streaming bubble's text is signal-backed (not a plain `string` property mutated in place). One pattern: change the assistant message item from `{ role: 'assistant', text: string }` to `{ role: 'assistant', text: WritableSignal<string> }` for in-progress messages, freezing to a plain string on `done`. Planner picks the exact shape but the contract is "OnPush sees each token".
- If planner instead chooses to mutate a field and call `markForCheck()`, that's acceptable per SPEC constraint — but signals are the preferred path given the rest of the codebase.

### 3. Mid-stream error: append inline notice to the partial bubble

When the SSE stream emits an `error` event (or the network drops) after ≥1 `token` was already received, the partial assistant text is preserved as-is and an inline error footer is appended to the same bubble (e.g. a small red italic line: "Response interrupted").

**Why:** Matches stop-mid-stream behavior from Requirement 9 (partial text retained). No new bubble variant needed for a rare case. Keeps the user's reading context.

**Implications for planner:**
- A second signal/flag on the in-progress assistant message item: `error?: string`. Template renders the footer only when set.
- Style with existing Tailwind utilities (no new theme tokens). Tone: subdued, not alarming — this is not a system-crash banner.
- If the stream errors *before* any token arrives (zero-token failure), fall back to the existing error UX (toast or error bubble — planner picks based on what's already there).

## Code Context

**Reusable assets the planner should target, not rebuild:**
- `ToolCallBubble` component (Phase 9) — already renders `ToolCallRecord`s. For streaming, it just needs to consume incrementally-arriving records instead of a finalized array. Bubble component itself should not need changes.
- `HistoryService.upsertSession()` — already persists session state; just call it on `done` (and on stop / error with partial text) instead of once on HTTP `next`.
- LangGraph `MemorySaver` — unchanged. After `done`, the checkpoint already contains the full `AIMessage` because LangGraph assembles streamed deltas internally.
- Existing typing-dots indicator — toggle the same `isLoading` flag off on first `token` (Requirement 7); no new component.

**Things that change shape:**
- `ChatService.sendMessage()` — return type and subscription model.
- `ChatComponent.dispatchRequest()` — replaces the `subscribe({ next, error, complete })` block with stream-event handling.
- `agents.service.ts:runAgent()` — replaces `graph.invoke()` with `graph.stream()` / `graph.streamEvents()` and yields events instead of returning a single object.
- `agents.controller.ts` — endpoint becomes streaming (still `POST /agents/chat` or a new `POST /agents/chat/stream` — planner decides; SPEC allows either).

## Deferred Ideas

(None — user did not raise scope-creep items during discussion.)

## Open Questions for Research

These are for `gsd-phase-researcher` to resolve before planning, not for the user:

1. Exact LangGraph JS API for streaming with tool nodes — `.stream()` vs `.streamEvents()` vs callbacks. Which one surfaces tool-node start/end events cleanly so we can emit `tool_call_start` / `tool_call_result`?
2. NestJS SSE: `@Sse()` decorator (Observable-based, easier) vs raw `res.write()` (full control, needed for `req.on('close')` cancellation hook). Verify which one cleanly supports server-side abort.
3. Confirm `crypto.randomUUID()` and `AbortController` are available in the target browser baseline (already used in the codebase — should be fine).

---

*Phase: 10-token-streaming-sse-word-by-word-render*
*Context captured: 2026-05-23*
*Next step: /gsd:plan-phase 10*
