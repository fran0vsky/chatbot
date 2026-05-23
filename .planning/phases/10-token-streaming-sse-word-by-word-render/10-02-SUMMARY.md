---
phase: 10-token-streaming-sse-word-by-word-render
plan: 02
status: complete
completed: 2026-05-23
requirements: [STREAM-01, STREAM-02, STREAM-04, STREAM-05, STREAM-09-backend]
---

# Plan 10-02 Summary — Backend SSE endpoint

## What was built

- `AgentsService.runAgent` removed; replaced with `async *streamAgent(message, threadId, model, signal)` that drives `graph.streamEvents(..., { version: 'v2', signal })` and yields typed `StreamEvent`s.
- `on_chat_model_stream` → `token`, `on_tool_start` → `tool_call_start`, `on_tool_end` → `tool_call_result`.
- Final `done` event emitted from `graph.getState(...)` checkpoint (assembled assistant text + `extractTurnToolCalls`).
- Capability errors mapped to a user-safe `error` event with `link`; generic failures emit a fixed-message `error` event.
- `AgentsController.chat` rewritten to use raw `@Req()/@Res()`: sets `text/event-stream` headers, registers `req.on('close')` → `AbortController.abort()`, writes each event as `data: {json}\n\n`, ends response in `finally`.
- MemorySaver checkpoint unchanged — `streamEvents` writes to the same checkpointer.

## Verification

- `npx nx run-many -t lint,build --projects=backend` — green (1 preexisting non-null-assertion warning at `agents.service.ts:68`, not touched by this plan)
- Manual SSE curl smoke test (Task 3) is human-run; deferred to UAT after frontend lands.

## Files changed

- `apps/backend/src/app/agents/agents.service.ts` — `runAgent` deleted, `streamAgent` + `extractChunkText` + `stringifyToolOutput` helpers added, removed unused `HttpException`/`HttpStatus`/`InternalServerErrorException` imports.
- `apps/backend/src/app/agents/agents.controller.ts` — full rewrite to SSE handler.

## Downstream

- Plan 10-03 frontend can now consume `POST /api/agents/chat` as an SSE stream via `fetch` + `ReadableStream`.

## Notes / deviations

- Spec said `const stream = await graph.streamEvents(...)` — implemented without `await`. `streamEvents` returns an `IterableReadableStream`/async iterable directly; awaiting it is unnecessary and the build confirms.
- Service-level capability errors now flow as in-stream `error` events instead of HTTP exceptions (headers are already written by then).
