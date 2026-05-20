# Phase 2: Choose Your Model - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 adds a model selector to the existing chat UI so the user can switch between two LLMs mid-session. Subsequent messages use the selected model; conversation history is preserved across model switches.

**Scope:** UI selector + API contract extension + backend per-request model selection.
**Not in scope:** Fetching models dynamically from OpenRouter, multiple conversations, or persistent model preference across page refreshes.

</domain>

<decisions>
## Implementation Decisions

### Model List
- **D-01:** Model list is hardcoded in the frontend — no API call to OpenRouter's /models endpoint. Two models only: `openai/gpt-4o-mini` and `anthropic/claude-3-haiku`.
- **D-02:** Display names are friendly: "GPT-4o mini" and "Claude 3 Haiku" — not raw model IDs.
- **D-03:** Default selected model is `openai/gpt-4o-mini` (matches the existing backend default).

### Selector UI
- **D-04:** Model selector uses a native `<select>` element styled with Tailwind — no custom dropdown component.
- **D-05:** Selector is placed on the right side of the header (app name "Chatbot" stays on the left). Phase 1 D-14 reserved this slot — no header restructuring needed.
- **D-06:** No visible label next to the selector — the selected model name displayed in the dropdown is sufficient context.
- **D-07:** Selector is disabled while `isLoading` is true — consistent with the existing input textarea and send button behavior.

### API Contract & Model Routing
- **D-08:** `model?: string` is added to the `ChatRequest` interface in `libs/shared-types/src/lib/chat.types.ts`. The frontend sends the selected model ID with every request.
- **D-09:** Switching model mid-conversation does NOT reset the thread — the same `threadId` continues. The new model sees all prior messages and carries on.
- **D-10:** `AgentsService.runAgent()` accepts a `model` parameter and selects the appropriate `ChatOpenAI` instance for that call. The service must be refactored from a single constructor-time model instance to per-request or cached model resolution.
- **D-11:** If `model` is omitted from the request (e.g., during Phase 1 E2E tests), the backend falls back to `openai/gpt-4o-mini`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Goals
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria (3 success criteria define "done" for MODEL-01)
- `.planning/REQUIREMENTS.md` — MODEL-01 requirement definition
- `.planning/PROJECT.md` — project constraints (Tailwind-only, OnPush, standalone components, OpenRouter)

### API Contract (to be modified)
- `libs/shared-types/src/lib/chat.types.ts` — `ChatRequest` / `ChatResponse` — `model?: string` must be added to `ChatRequest`

### Backend (to be modified)
- `apps/backend/src/app/agents/agents.service.ts` — current single-model implementation (constructor creates one `ChatOpenAI`); needs refactor to support per-request model selection
- `apps/backend/src/app/agents/agents.controller.ts` — `POST /api/agents/chat`; passes `body.model` to service after contract extension

### Frontend (to be modified)
- `apps/frontend/src/app/chat/chat.ts` — `ChatComponent`; holds `isLoading`, drives selector disabled state; model selection state lives here or in `ChatService`
- `apps/frontend/src/app/chat/chat.service.ts` — `ChatService.sendMessage()`; must accept and forward `model` to `ChatRequest`

### Prior Phase Decisions
- `.planning/phases/01-working-chat/01-CONTEXT.md` — D-14 (header reserved for model selector), D-10 (input/button disabled during loading — selector follows same pattern)

### Conventions
- `apps/backend/CLAUDE.md` — NestJS rules (constructor injection, no `new` inside classes, Logger, no `any`)
- `apps/frontend/CLAUDE.md` — Angular rules (standalone, OnPush, Tailwind-only, no `any`, services for HTTP)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatComponent.isLoading` — already drives textarea/button disabled state; bind `[disabled]="isLoading"` to the new `<select>` with the same pattern
- `ChatService.sendMessage()` — already constructs `ChatRequest`; extend the signature to accept `model?: string` and include it in the body
- `ChatRequest` interface — already imported everywhere via `@org/shared-types`; adding `model?` is backwards-compatible (optional field)

### Established Patterns
- Angular standalone + OnPush — all new or modified components follow this; `markForCheck()` / `detectChanges()` already used in `ChatComponent`
- Tailwind-only styling — `<select>` must be styled with Tailwind utility classes (e.g. `appearance-none bg-white border rounded px-2 py-1 text-sm`)
- `process.env['VAR_NAME']` bracket notation — keep using for any new env vars in backend
- `@Injectable()` with constructor injection — `AgentsService` must inject dependencies, not use `new` for model instances (cache with a `Map<string, ChatOpenAI>` or create inline in `runAgent`)

### Integration Points
- Header template (in `app.html` or `chat.html`) — Phase 1 left a `<header>` element with room for a right-side element; model selector slots in with `flex justify-between items-center`
- `AgentsService.runAgent(message, threadId)` → becomes `runAgent(message, threadId, model?)` — controller passes `body.model`, service uses it to pick the right `ChatOpenAI`
- `ChatService.threadId` stays unchanged — same UUID for the session regardless of model switches

</code_context>

<specifics>
## Specific Ideas

- **OpenRouter model IDs:** `openai/gpt-4o-mini` and `anthropic/claude-3-haiku` — the namespaced format is required (bare IDs like `gpt-4o-mini` won't work on OpenRouter).
- **Backend model caching:** A `Map<string, ChatOpenAI>` in `AgentsService` avoids recreating instances on every call — create once per model ID, reuse. Both models share the same `apiKey` and `baseURL`.
- **Selector default:** `<select>` should have `openai/gpt-4o-mini` pre-selected on page load (value binding in Angular template or a `selectedModel` signal initialized to the default).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Choose Your Model*
*Context gathered: 2026-05-20*
