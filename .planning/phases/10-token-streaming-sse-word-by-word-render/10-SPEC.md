# Phase 10: Token Streaming (SSE, word-by-word render) — Specification

**Created:** 2026-05-23
**Ambiguity score:** 0.10 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

Assistant responses appear token-by-token in the UI as the model generates them, instead of arriving as one complete block after a delay. The user sees text "typing itself out" the moment the backend starts receiving tokens from OpenRouter.

## Background

Today the chat pipeline is fully request/response:

- Backend ([apps/backend/src/app/agents/agents.controller.ts](apps/backend/src/app/agents/agents.controller.ts)) exposes `POST /agents/chat` that returns a single `ChatResponse` JSON `{ response, toolCalls }`.
- [apps/backend/src/app/agents/agents.service.ts:139](apps/backend/src/app/agents/agents.service.ts#L139) uses `graph.invoke()` — blocks until the whole LangGraph run finishes, then collects tool calls via `extractTurnToolCalls()`.
- Frontend ([apps/frontend/src/app/chat/chat.service.ts:24-27](apps/frontend/src/app/chat/chat.service.ts#L24-L27)) calls `HttpClient.post(...).subscribe()` — `ChatComponent` shows a typing indicator until the full response arrives, then pushes the assistant message and any tool bubbles in one go.
- Stop response button ([apps/frontend/src/app/chat/chat.ts:86](apps/frontend/src/app/chat/chat.ts#L86)) unsubscribes the HTTP request — but since the backend has already done the work, "stopping" only hides the result.
- Phase 9 (tool calling, complete 2026-05-23) added `ToolCallRecord` and `ToolCallBubble` rendering. These must keep working over the new transport.

This phase converts the pipe to Server-Sent Events so tokens (and tool-call events) reach the UI as they happen, and unlocks Phase 11 (reasoning display) which will ride the same channel.

## Requirements

1. **SSE chat endpoint**: Backend exposes a streaming chat endpoint that emits typed events as the LangGraph run progresses.
   - Current: `POST /agents/chat` returns one `ChatResponse` JSON after `graph.invoke()` completes
   - Target: Endpoint responds with `Content-Type: text/event-stream` and emits a sequence of events conforming to the shared `StreamEvent` union; connection closes after `done` (or `error`)
   - Acceptance: `curl -N` against the endpoint with a valid request body returns an `event-stream` response containing ≥1 `token` event, exactly one terminal `done` (or `error`) event, and zero further bytes after the terminal event

2. **LangGraph token streaming**: Backend uses LangGraph's streaming API (e.g. `.stream()` / `.streamEvents()`) to emit content deltas as OpenRouter returns them.
   - Current: `graph.invoke()` awaits the entire run before returning
   - Target: Token deltas are forwarded to the SSE stream within one event-loop tick of arrival from OpenRouter
   - Acceptance: For a prompt that yields ≥50 tokens on `openai/gpt-4o-mini`, the elapsed time between the first `token` event and connection open is strictly less than the elapsed time between connection open and `done`

3. **StreamEvent discriminated union**: Shared types library defines the SSE event payload contract.
   - Current: `libs/shared-types` defines `ChatRequest`, `ChatResponse`, `ToolCallRecord`, `ChatMessage`, `ConversationSession` only
   - Target: New exported `StreamEvent` discriminated union with variants `token`, `tool_call_start`, `tool_call_result`, `done`, `error` — each variant types its own payload
   - Acceptance: TypeScript compiles cleanly with `StreamEvent` imported from `@org/shared-types` and used as the discriminant type in both backend emit and frontend consumption code

4. **Tool-call events flow through the stream**: Phase 9 tool calls are surfaced as `tool_call_start` and `tool_call_result` events, not bundled into the final payload.
   - Current: `runAgent()` returns `toolCalls: ToolCallRecord[]` only after the run finishes
   - Target: Each tool invocation emits one `tool_call_start` (name + args) when the tool node begins, and one `tool_call_result` (id + result) when it completes
   - Acceptance: A prompt that triggers `get_current_time` produces exactly one `tool_call_start` followed by one matching `tool_call_result` followed by ≥1 `token` event of the assistant's subsequent reply, in that order

5. **MemorySaver preserves full message on done**: Session state on the server stores the fully assembled assistant message after streaming finishes.
   - Current: MemorySaver checkpoints the full `AIMessage` because `graph.invoke()` only returns at the end
   - Target: After the `done` event is emitted, the LangGraph checkpoint for that `thread_id` contains the complete concatenated assistant text (and tool messages) as one logical turn
   - Acceptance: Sending a follow-up message in the same `threadId` causes the model to reference content from the previous streamed answer (verifiable in the OpenRouter request payload showing the prior assistant message in full)

6. **Frontend streams tokens into the in-progress bubble**: Angular consumes the SSE stream and renders tokens incrementally with OnPush-compatible reactivity.
   - Current: `ChatService.sendMessage()` returns `Observable<ChatResponse>` (single emit); `ChatComponent.dispatchRequest()` pushes the assistant message only on `next`
   - Target: An in-progress assistant message is appended on first `token` and its text grows as further `token` events arrive; rendering uses signals or async-pipe / manual `markForCheck()` so OnPush components re-render correctly
   - Acceptance: Visually observing a response with ≥50 tokens shows text growing across multiple animation frames, not appearing in one paint

7. **Typing indicator hides on first token**: The existing typing-dots indicator turns off as soon as the first token arrives.
   - Current: `isLoading` stays true until the HTTP `next` callback fires with the full response
   - Target: `isLoading` (or equivalent typing-indicator flag) is cleared on the first `token` event for the current turn
   - Acceptance: In E2E or manual test, the typing indicator disappears before the assistant message is complete

8. **Tool-call bubbles render on event arrival**: `ToolCallBubble` shows the call the moment its `tool_call_start` arrives and updates with the result on `tool_call_result`.
   - Current: All tool bubbles are pushed in one batch when the full response arrives
   - Target: A tool bubble enters the message list on `tool_call_start` (showing name + args, result empty/placeholder) and is mutated to include the result on the matching `tool_call_result` event; order in the DOM matches event arrival order
   - Acceptance: For a prompt that calls `web_search`, the bubble for that call is visible in the DOM before any subsequent assistant `token` events render

9. **Stop button cancels the SSE stream and preserves partial text**: Clicking "Stop response" closes the SSE connection immediately and keeps the partial assistant message in session history.
   - Current: `onStop()` unsubscribes the HTTP observable; backend has already completed the work
   - Target: Stop closes the EventSource/ReadableStream, the backend detects client disconnect and cancels the LangGraph run, the partial assistant message remains in the on-screen message list and is persisted to the sidebar history via `HistoryService.upsertSession()`
   - Acceptance: Stopping mid-stream after ≥3 tokens received leaves a bubble with exactly the tokens already received (no growth, no loss), and reloading the same session from the sidebar shows that same partial text

## Boundaries

**In scope:**
- Backend: SSE streaming endpoint replacing or shadowing `POST /agents/chat`
- Backend: LangGraph `.stream()` / `.streamEvents()` integration
- Backend: Event-typed emission of `token`, `tool_call_start`, `tool_call_result`, `done`, `error`
- Backend: MemorySaver checkpoint preserves the full assembled message on `done`
- Shared types: `StreamEvent` discriminated union exported from `@org/shared-types`
- Frontend: `ChatService` reworked to consume the stream (EventSource or `fetch` + `ReadableStream` — to be decided in discuss-phase)
- Frontend: Incremental rendering of token deltas with OnPush-correct change detection
- Frontend: Existing tool bubbles render on event arrival, update on result
- Frontend: Typing indicator hides on first token
- Frontend: Stop button actually cancels in-flight stream and persists partial state

**Out of scope:**
- Reasoning / thinking traces — Phase 11 will reuse this transport
- Retry-on-disconnect logic — not asked for; partial loss is acceptable
- Resumable streams after page reload — per-session MemorySaver does not retain in-flight runs
- Switching transport to WebSockets — SSE is the chosen mechanism
- GCS deploy or deploy pipeline changes — separate Phase 12
- Database-backed persistence — per-session MemorySaver stays
- User-configurable streaming on/off toggle — streaming is the new default

## Constraints

- Tech stack locked: Angular + NestJS + LangGraph + OpenRouter
- Tailwind-only styling (no inline styles, no other CSS frameworks)
- Standalone Angular components with OnPush — token append must trigger CD correctly (signals or async-pipe; if mutating fields, `ChangeDetectorRef.markForCheck()` is required)
- Per-session MemorySaver remains the only conversation store — no database
- Backend follows project NestJS conventions (DI, `Logger`, NestJS exceptions, types from `@org/shared-types`)

## Acceptance Criteria

- [ ] User sends a message and the response text appears progressively (multiple paints), not as one block
- [ ] Time-to-first-token is visibly shorter than current full-response wait on the same prompt and model
- [ ] A prompt that triggers `get_current_time` produces a tool-call bubble that renders before any subsequent assistant tokens, and is updated with the tool's result
- [ ] A prompt that triggers `web_search` produces the same correct ordering (user message → tool bubble → streaming assistant reply)
- [ ] Clicking "Stop response" mid-stream halts token arrival immediately and the partial message is retained on screen and in sidebar history
- [ ] Re-opening the session from the sidebar after a completed stream shows the full assembled assistant message
- [ ] Multi-turn conversation memory still works (follow-up references prior streamed answer)
- [ ] Sidebar history (Phase 8) still works — sessions list updates, switching sessions works, rename/pin/delete unaffected
- [ ] No visual regressions: bubble styling, layout, theming, scroll-to-bottom all unchanged
- [ ] Backend lint + frontend lint pass; existing unit tests still pass

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                |
|--------------------|-------|------|--------|------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Outcome and trigger condition both explicit          |
| Boundary Clarity   | 0.95  | 0.70 | ✓      | Explicit in/out scope from user-supplied context     |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Stack, styling, OnPush CD constraints all locked     |
| Acceptance Criteria| 0.90  | 0.70 | ✓      | 10 pass/fail criteria; all observable                |
| **Ambiguity**      | 0.10  | ≤0.20| ✓      |                                                      |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 0 | User-supplied context | Goal, scope, out-of-scope, constraints, UAT supplied inline with `/gsd-spec-phase` invocation | All four dimensions cleared minimums on first assessment — interview skipped |

**Deferred to discuss-phase (HOW questions, not WHAT):**
- EventSource (GET-only) vs `fetch` + `ReadableStream` (supports POST body) — transport choice that fits existing `ChatService` shape
- Token render cadence — render every token vs throttle/batch to avoid OnPush flicker on fast models
- Mid-stream error rendering — inline in the partial bubble vs replacing it with a dedicated error message

---

*Phase: 10-token-streaming-sse-word-by-word-render*
*Spec created: 2026-05-23*
*Next step: /gsd:discuss-phase 10 — transport choice, render cadence, mid-stream error handling*
