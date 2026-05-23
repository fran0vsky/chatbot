---
phase: 10-token-streaming-sse-word-by-word-render
plan: 03
status: complete
completed: 2026-05-23
requirements: [STREAM-06, STREAM-07, STREAM-08, STREAM-09-frontend]
---

# Plan 10-03 Summary — Frontend SSE consumer + signal-driven render

## What was built

**`chat.service.ts`** — `HttpClient`/`Observable` removed. New `async *streamMessage(message, model, signal)` uses `fetch` + `ReadableStream.getReader()`, decodes with `TextDecoder`, splits on `\n\n`, strips `data: ` prefix, JSON-parses each frame as a `StreamEvent`. Honors `signal.aborted` (returns silently); maps network/!ok failures to a single `error` event.

**`chat.ts`** — `Subscription` import dropped; added `signal` from `@angular/core` and `ToolCallRecord`/`StreamEvent` from `@org/shared-types`. Replaced `currentRequest: Subscription | null` with `currentAbort: AbortController | null`. New signals: `streamingText`, `streamingError`, `streamingToolCalls`, `isStreaming`. Plus `streamingToolCallIds: string[]` (plain field) for id→index correlation.

- `dispatchRequest` is now async — aborts any prior controller, iterates `streamMessage(...)`, dispatches each event through `handleStreamEvent`.
- `handleStreamEvent` switches on `event.type`:
  - `token` → clears `isLoading` on first arrival, appends to `streamingText`, marks for check, scrolls
  - `tool_call_start` → pushes a placeholder `ToolCallRecord` into `streamingToolCalls` and tracks its id
  - `tool_call_result` → finds by id, immutably updates the result
  - `done` → commits authoritative `response` + `toolCalls[]` (from the event) to `messages[]`, calls `finishRequest`
  - `error` → if `streamingText()` non-empty: commit partial assistant bubble + inline footer; else push existing-UX error bubble
- `onStop()` calls `currentAbort.abort()`, commits accumulated tool calls + partial text to `messages[]`, persists via `historyService.upsertSession`.
- `onSend`/`onRegenerate`/`onEditAndResend` guards extended to `if (this.isLoading || this.isStreaming()) return;`.
- `ngOnDestroy` calls `currentAbort?.abort()` instead of `unsubscribe`.

**`chat.html`** — Landing-state condition now also requires `!isStreaming()`. After the typing-dots `@if (isLoading)` block, added `@if (isStreaming())` block that:
- Renders an `app-tool-call-bubble` for each in-progress `ToolCallRecord`
- Renders an `app-message-bubble` with the assistant role + `streamingText()` as it grows; `[animate]="false"` to avoid re-running the fade-in on every token
- Renders the subdued inline error footer when `streamingError()` is non-null

## Verification

- `npx nx run-many -t lint,build --projects=frontend` — green (prismjs CommonJS warnings are preexisting, unrelated)
- Manual browser UAT (Task 4) is human-run; deferred to user.

## Files changed

- `apps/frontend/src/app/chat/chat.service.ts` — full rewrite (HttpClient → fetch + ReadableStream)
- `apps/frontend/src/app/chat/chat.ts` — signal-driven streaming state, async `dispatchRequest`, `handleStreamEvent`, `commitTurn`, `commitErrorTurn`, `clearStreaming`, `AbortController`-based `onStop`
- `apps/frontend/src/app/chat/chat.html` — landing-state guard updated, new `@if (isStreaming())` block

## Manual UAT outstanding

End-to-end browser test deferred to user (per memory note about not auto-running dev servers):
- Token-by-token render visible across paints
- Typing dots hide on first token
- Tool bubble appears before assistant text on `get_current_time` / `web_search`
- Stop mid-stream preserves partial text (and backend logs "Agent stream aborted by client")
- History persistence after stop
- Mid-stream error footer
- Zero-token error bubble
- Regressions: theme, rename, pin, delete, new chat, multi-turn memory
