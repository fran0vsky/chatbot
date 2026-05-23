---
phase: 11-reasoning-thinking-display
plan: 01
subsystem: shared-types
tags: [types, sse, reasoning]
dependency-graph:
  requires: []
  provides:
    - StreamReasoningTokenEvent
    - ChatMessage.reasoning
    - ChatMessage.reasoningDurationMs
    - StreamDoneEvent.reasoning
    - StreamDoneEvent.reasoningDurationMs
  affects:
    - backend chat streaming
    - frontend chat UI
    - session persistence
tech-stack:
  added: []
  patterns: [discriminated-union, optional-fields-additive-evolution]
key-files:
  created: []
  modified:
    - libs/shared-types/src/lib/chat.types.ts
decisions:
  - Added reasoning fields as optional to preserve backward compatibility with existing messages and SSE consumers
  - Placed StreamReasoningTokenEvent after StreamTokenEvent in the union to group token-stream variants
metrics:
  duration: ~3m
  completed: 2026-05-24
requirements: [REQ-3, REQ-4]
---

# Phase 11 Plan 01: Shared types for reasoning Summary

Extended `@org/shared-types` chat contract with reasoning-trace fields so backend emission, frontend rendering, and history persistence can share a single source of truth.

## What changed

- `ChatMessage` gained two optional fields: `reasoning?: string` and `reasoningDurationMs?: number`. Existing producers/consumers are unaffected (additive optional fields).
- New SSE variant `StreamReasoningTokenEvent { type: 'reasoning_token'; text: string }` added to the `StreamEvent` discriminated union, placed immediately after `StreamTokenEvent`.
- `StreamDoneEvent` gained `reasoning?: string` and `reasoningDurationMs?: number` so the terminal event can carry the full trace and elapsed time for persistence.
- All existing exports (ChatRequest, ChatResponse, MessageRole, ToolCallRecord, ConversationSession, StreamTokenEvent, StreamToolCallStartEvent, StreamToolCallResultEvent, StreamErrorEvent) are unchanged in shape and order.
- `libs/shared-types/src/index.ts` untouched — it re-exports everything from `chat.types`, so new symbols are automatically available as `@org/shared-types` exports.

## Verification

- TypeScript type-check on `libs/shared-types/src/lib/chat.types.ts` ran clean (no diagnostics).
- `pnpm nx build shared-types` could NOT be executed in this worktree environment: the Windows Node ESM loader rejects the local `nx` shim with `ERR_UNSUPPORTED_ESM_URL_SCHEME` (`Received protocol 'c:'`). This is a pre-existing infrastructure issue affecting every `nx` invocation from this shell, not a defect introduced by this plan. The shared-types package is source-only (`main: ./src/index.ts`, no build step in `package.json`), so consumers compile the TS directly via their own project graphs.

## Deviations from Plan

None — file was edited exactly as specified; build verification was substituted with `tsc --noEmit` due to the environmental `nx` ESM-loader issue noted above.

## Self-Check: PASSED

- libs/shared-types/src/lib/chat.types.ts FOUND
- commit 68ee2f3 FOUND in git log
