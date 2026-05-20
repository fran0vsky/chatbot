# Plan 02-01 Summary — Backend Model Routing

**Status:** Complete
**Date:** 2026-05-20

## What was done

### Task 1 — ChatRequest.model?: string added to shared types
`libs/shared-types/src/lib/chat.types.ts` now exports:
```ts
export interface ChatRequest { message: string; threadId?: string; model?: string; }
```
Backwards-compatible optional field — all existing callers that omit `model` continue to work.

### Task 2 — AgentsService refactored to per-request graph selection
`apps/backend/src/app/agents/agents.service.ts` was rewritten from a single `ChatOpenAI` instance to:
- `private readonly SUPPORTED_MODELS = ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'] as const`
- `private readonly graphs = new Map<string, ...>()` — one compiled graph per model, built at startup
- ONE shared `MemorySaver` passed to every compiled graph (preserves thread history across model switches per D-09)
- `runAgent(message, threadId, model)` looks up the graph via `this.graphs.get(model) ?? this.graphs.get('openai/gpt-4o-mini')!` (D-11 fallback)

### Task 3 — AgentsController passes body.model to runAgent
`apps/backend/src/app/agents/agents.controller.ts` call updated from:
```ts
this.agentsService.runAgent(body.message, body.threadId)
```
to:
```ts
this.agentsService.runAgent(body.message, body.threadId, body.model)
```

## Verification

**TypeScript (tsc --noEmit):** clean on both `libs/shared-types` and `apps/backend`

**Grep gates (all pass):**
- `grep -c 'model?: string' libs/shared-types/src/lib/chat.types.ts` → 1
- `grep -c 'body\.model' apps/backend/src/app/agents/agents.controller.ts` → 1
- `grep -c 'private readonly graphs' apps/backend/src/app/agents/agents.service.ts` → 1

**Note:** `npx nx build` fails on this dev machine due to a pre-existing Nx 22 + Node 24 ESM Windows path issue (ERR_UNSUPPORTED_ESM_URL_SCHEME). This was present before Phase 2; Phase 1 commits were also CI-verified only. Full build verification will occur on CI.

## Smoke test
Deferred to CI / local test session with OPENROUTER_API_KEY set. Curl commands from plan verification section are ready to run.

## Decision confirmations
- D-08: `ChatRequest.model?: string` ✓
- D-09: Shared `MemorySaver` across all model graphs ✓
- D-10: Per-request graph selection from Map keyed by model ID ✓
- D-11: Unknown/missing model IDs fall back to `openai/gpt-4o-mini` ✓
- MODEL-01 (backend half): complete ✓
