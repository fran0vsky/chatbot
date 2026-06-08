---
phase: 32-working-memory-context-ring
plan: "01"
subsystem: chat-context
tags: [working-memory, multimodal, tool-replay, history, context]
dependency_graph:
  requires: []
  provides:
    - "ChatHistoryItem with image+tool-call replay fields"
    - "buildHistory() forwarding capped images + tool messages"
    - "historyMessages reconstruction with multimodal HumanMessages + AIMessage/ToolMessage"
  affects:
    - "libs/shared-types"
    - "apps/frontend/chat"
    - "apps/backend/agents"
tech_stack:
  added: []
  patterns:
    - "flatMap for ChatHistoryItem → LangChain message expansion"
    - "vi.hoisted + function-constructor mock for ChatOpenAI in Vitest"
key_files:
  created: []
  modified:
    - libs/shared-types/src/lib/chat.types.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/backend/src/app/agents/agents.service.ts
    - apps/backend/src/app/agents/agents.service.spec.ts
decisions:
  - "Image cap N=2: retain imageDataUrl on only the 2 most-recent image-bearing user turns in buildHistory()"
  - "flatMap used for historyMessages to allow one ChatHistoryItem to yield 2 messages (AIMessage + ToolMessage)"
  - "Synthetic tool replay id pattern: replay-{toolName}-{index} for stable matching"
  - "HISTORY_CAP=20 applied to user/assistant turns; tool items ride along within the window"
metrics:
  duration: "~40 minutes"
  completed: "2026-06-08"
  tasks_completed: 4
  tasks_total: 5
  files_changed: 4
---

# Phase 32 Plan 01: Working Memory — Context Replay Summary

**One-liner:** Thread retained images (capped last 2) and prior tool results through the history channel as multimodal HumanMessages + AIMessage/ToolMessage pairs so the stateless agent loop replays what the model already fetched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend ChatHistoryItem with image + tool-call replay fields | 729375c | libs/shared-types/src/lib/chat.types.ts |
| 2 | buildHistory() forwards capped prior images + tool messages | 3e0b4e0 | apps/frontend/src/app/chat/chat.ts |
| 3 | Reconstruct multimodal HumanMessages + AIMessage/ToolMessage in agent loop | 991d581 | apps/backend/src/app/agents/agents.service.ts |
| 4 | Unit tests — image replay, tool replay, no-regression | 7feded3 | apps/backend/src/app/agents/agents.service.spec.ts |
| 5 | Live UAT (image + fetched-page reuse) | — | Manual — awaiting human verification |

## What Was Built

### Task 1: ChatHistoryItem Extension

`ChatHistoryItem` in `libs/shared-types/src/lib/chat.types.ts` now carries:
- `role: 'user' | 'assistant' | 'tool'` (widened from `'user' | 'assistant'`)
- `imageDataUrl?: string` — prior user image for vision replay
- `toolName?: string`, `toolArgs?: Record<string, unknown>`, `toolResult?: string` — tool-call replay fields

All new fields are optional; existing `{ role, text }` items remain valid.

### Task 2: buildHistory() Rework

`buildHistory()` in `apps/frontend/src/app/chat/chat.ts` now:
- Includes `role: 'tool'` messages (previously dropped for having empty text) when they have a `toolResult`/`toolName`
- Forwards `imageDataUrl` on user turns (previously stripped)
- Applies a **last-2-images cap** (newest→oldest; older images go as text-only)
- Keeps `HISTORY_CAP=20` on conversational turns; tool messages within the kept window ride along

### Task 3: Backend History Reconstruction

`historyMessages` in `agents.service.ts` replaced the one-line `.map()` with a `.flatMap()` covering four cases:
- `user` + `imageDataUrl` → multimodal `HumanMessage` (`{ type:'image_url', image_url:{ url } }` — same shape as currentTurn)
- `user` (text only) → `new HumanMessage(text)`
- `assistant` → `new AIMessage(text)`
- `tool` → two messages: `AIMessage({ content:'', tool_calls:[{ id, name, args }] })` + `ToolMessage({ content: toolResult, tool_call_id: id })` with synthetic id `replay-{toolName}-{index}`

### Task 4: Unit Tests

Three new tests in `agents.service.spec.ts` under `streamAgent — history reconstruction`:
1. **Image replay** — asserts multimodal `image_url` entry in HumanMessage content
2. **Tool replay** — asserts AIMessage `tool_calls[0].name === 'fetch_page'` + ToolMessage with matching `tool_call_id` and correct `content`
3. **Single-turn parity** — asserts zero ToolMessages and plain string `content` for user/assistant history

All 22 backend tests pass (6 pre-existing + 12 group-agents + 4 new).

### Task 5: Live UAT (Pending)

Manual UAT required to verify CTX-01 (image reuse) + CTX-02 (tool-result reuse) + no-regression live.
Steps documented in Task 5 of the plan.

## Deviations from Plan

**1. [Rule 1 - Bug] ESLint no-unused-vars on destructured `_dropped`**
- **Found during:** Task 2 lint check
- **Issue:** `const { imageDataUrl: _dropped, ...rest } = capped[i]` triggered `@typescript-eslint/no-unused-vars`
- **Fix:** Renamed to `_` with inline `// eslint-disable-next-line` comment (standard convention)
- **Files modified:** apps/frontend/src/app/chat/chat.ts

**2. [Rule 3 - Blocking] `pnpm nx build @org/shared-types` target not found**
- **Found during:** Task 1 verify step
- **Issue:** `@org/shared-types` has a `typecheck` target, not `build`; PLAN.md verify command was for `build`
- **Fix:** Used `npm exec nx -- typecheck @org/shared-types` instead; build verification done via downstream `@org/backend` and `frontend` builds
- No code change required

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary schema changes introduced.
- Replayed image/tool data travels the existing authenticated `ChatRequest.history` channel (T-32-01-01: accepted)
- Image cap (N=2) + HISTORY_CAP=20 mitigate T-32-01-02 (DoS via unbounded growth)
- Replayed tool items are injected as prior-context only; not executed (T-32-01-03: accepted)

## Known Stubs

None — all four modified files wire real data (no placeholders or hardcoded empties affecting the plan's goal).

## Verification

- `npm exec nx -- run-many -t lint,build --projects=@org/shared-types,@org/backend,frontend` — green
- `node apps/backend/vitest.run.mjs agents.service` — 22 tests passed (image replay, tool replay, parity)
- Manual UAT (Task 5): pending human verification (CTX-01 + CTX-02 + single-turn no-regression)

## Self-Check: PASSED

Files verified:
- libs/shared-types/src/lib/chat.types.ts — exists, extended ChatHistoryItem
- apps/frontend/src/app/chat/chat.ts — exists, reworked buildHistory()
- apps/backend/src/app/agents/agents.service.ts — exists, flatMap historyMessages
- apps/backend/src/app/agents/agents.service.spec.ts — exists, 3 new tests

Commits verified:
- 729375c feat(32-01): extend ChatHistoryItem with image + tool-call replay fields
- 3e0b4e0 feat(32-01): buildHistory() forwards capped prior images + tool messages
- 991d581 feat(32-01): reconstruct multimodal HumanMessages + tool replay in agent loop
- 7feded3 test(32-01): add image replay, tool replay, and no-regression tests for streamAgent
