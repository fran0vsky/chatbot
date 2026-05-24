# Plan 11-04 Summary — Frontend Chat Reasoning Wiring

## Status: Complete

## What was built

Wired the frontend chat layer to the `reasoning_token` SSE event variant:

1. **SSE parser confirmed pass-through** — `chat.service.ts` parses raw JSON and casts to `StreamEvent`; no filtering by type, so `reasoning_token` frames are forwarded automatically. No source change needed.

2. **Three new signals added to `ChatComponent`** — `streamingReasoning`, `reasoningCollapsed`, `streamingReasoningDurationMs`.

3. **`handleStreamEvent` extended** — new `case 'reasoning_token'` accumulates text into `streamingReasoning` signal and calls `cdr.markForCheck()`. Existing `case 'token'` now auto-collapses reasoning (`reasoningCollapsed.set(true)`) on the first content token after reasoning has streamed (gating on `streamingReasoning().length > 0 && !reasoningCollapsed()` — RESEARCH Pitfall 3 guard). `case 'done'` passes `event.reasoning` and `event.reasoningDurationMs` to `commitTurn`.

4. **`commitTurn` updated** — accepts optional `reasoning?` and `reasoningDurationMs?` parameters; conditionally spreads them onto the pushed `ChatMessage` using object spread to avoid `undefined` keys.

5. **`clearStreaming` updated** — resets all three new signals alongside existing ones.

6. **`onStop` updated** — preserves any `streamingReasoning()` content on the partial-assistant message pushed on cancel.

7. **`ReasoningBlock` imported** — added to component `imports` array for 11-05 template integration.

## Spec files added

- `chat.service.spec.ts` — two new SSE streaming describe blocks: `reasoning_token` pass-through, `done` with reasoning fields
- `chat.spec.ts` — 6 cases covering: accumulation, auto-collapse, no-collapse guard, done persistence, no spurious keys, clearStreaming post-done
- `history.service.spec.ts` — 2 cases: reasoning round-trip, absence of reasoning keys for plain messages

## Key files modified

- `apps/frontend/src/app/chat/chat.ts` — signals, event handler, commitTurn, clearStreaming, onStop
- `apps/frontend/src/app/chat/chat.service.spec.ts` — SSE specs added

## Deviations

- **Nx build unavailable**: same `ERR_UNSUPPORTED_ESM_URL_SCHEME` environment constraint as 11-02. Used `tsc --noEmit` — passes clean.
- **Stale dist/out-tsc declarations updated locally** — `dist/out-tsc/src/index.d.ts` and new `dist/out-tsc/src/lib/reasoning-block/reasoning-block.d.ts` created locally so the frontend tsconfig composite build can resolve `ReasoningBlock`. These files are gitignored and only affect local type-checking.
- **Frontend test runner** (`vitest`) cannot be invoked via `nx` in this environment; spec files are correctly typed per `tsconfig.spec.json` (`vitest/globals` types) and ready to run.
- `history.service.ts` requires no source change — `JSON.stringify`/`JSON.parse` round-trip preserves optional fields natively.

## Self-Check: PASSED (with environment caveats)

TypeScript clean. Signals, event handler branches, and commitTurn signature all type-correct. Auto-collapse gate matches RESEARCH Pitfall 3 requirement.
