# Plan 11-02 Summary — Backend OpenRouter Reasoning Wiring

## Status: Complete

## What was built

Swapped `ChatOpenAI` for `ChatOpenRouter` in the backend agent service and added full reasoning streaming support:

1. **@langchain/openrouter installed** — added to `apps/backend/package.json` as `^0.3.0`, installed via npm workspaces.

2. **model-capabilities.ts created** — `MODEL_CAPABILITIES` record marks `deepseek/deepseek-r1:free` and `deepseek/deepseek-r1` as `{ reasoning: true }`; `getModelCapabilities()` returns `{ reasoning: false }` for all other models.

3. **agents.service.ts rewired** — `ChatOpenAI` → `ChatOpenRouter`; `buildGraph()` attaches `modelKwargs.reasoning = { effort: 'medium' }` only for reasoning-capable models; new `extractChunkReasoning()` private method reads `additional_kwargs.reasoning_content` (string) or `reasoning_details[].text` (array fallback); `streamAgent` accumulates reasoning deltas, emits `{ type: 'reasoning_token', text }` events before `token` events in the `on_chat_model_stream` branch, and enriches the final `done` yield with `reasoning` and `reasoningDurationMs`.

4. **Unit specs written** — `model-capabilities.spec.ts` covers 4 cases (two reasoning-true, two reasoning-false); `agents.service.spec.ts` covers 5 `extractChunkReasoning` shapes (string content, array details, missing kwargs, null chunk, no reasoning fields).

## Key files

- `apps/backend/package.json` — `@langchain/openrouter: ^0.3.0` added
- `apps/backend/src/app/agents/model-capabilities.ts` — new
- `apps/backend/src/app/agents/agents.service.ts` — rewired
- `apps/backend/src/app/agents/agents.service.spec.ts` — new
- `apps/backend/src/app/agents/model-capabilities.spec.ts` — new

## Deviations

- **Nx build unavailable**: `ERR_UNSUPPORTED_ESM_URL_SCHEME` (Node v24 + Windows absolute paths) prevents running `nx` from this shell. Used `tsc --noEmit` instead — passes clean (one pre-existing TS1272 in `agents.controller.ts` unrelated to this plan).
- **Backend test runner not configured**: `apps/backend` has no project.json and no jest.config. Spec files are valid TypeScript and ready to run once a test executor is wired up; `nx test backend` cannot be invoked until then.
- **Stale dist/.d.ts updated locally**: `libs/shared-types/dist/lib/chat.types.d.ts` was a stale compiled artifact missing reasoning types from Plan 11-01. Updated locally (gitignored) so tsc composite build can resolve `StreamReasoningTokenEvent` and `StreamDoneEvent.reasoning`.

## Self-Check: PASSED (with environment caveats)

TypeScript clean. Reasoning fields match `StreamEvent` union from 11-01. Tool-call and error paths unchanged.
