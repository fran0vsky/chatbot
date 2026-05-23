# Phase 9: Tool Calling (Function Calling) — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Source:** Direct authoring (skipped /gsd:discuss-phase per user preference)

<domain>
## Phase Boundary

Add tool-calling capability to the LangGraph agent so the LLM can invoke backend functions during a conversation turn. Ship two starter tools (`get_current_time`, `web_search`) and render tool calls + results in the chat UI as muted, visually distinct message blocks between the user prompt and the assistant reply. Multi-turn references to tool results must work via the existing `MemorySaver` checkpointer.

</domain>

<decisions>
## Implementation Decisions

### Backend
- Tool definitions live in `apps/backend/src/app/agents/tools/` (one file per tool: `get-current-time.tool.ts`, `web-search.tool.ts`, plus a barrel `index.ts`).
- Use `@langchain/core/tools` `tool()` helper with a `zod` schema for arguments.
- Use `ToolNode` from `@langchain/langgraph/prebuilt` to execute tool calls.
- Wire tools into the graph: `agent → (conditional) → tools → agent → END`. The conditional checks `lastMessage.tool_calls?.length > 0`.
- Bind tools onto the `ChatOpenAI` model via `model.bindTools([...])` before invocation. OpenRouter forwards the OpenAI `tools` parameter unchanged.
- All tool calls in a turn are collected from the graph's message log and returned to the client alongside the final assistant text.

### `web_search` provider
- DuckDuckGo Instant Answer JSON API: `https://api.duckduckgo.com/?q={q}&format=json&no_html=1&no_redirect=1`.
- No API key, no signup. Acceptable starter quality — `AbstractText` for instant answers, top 3 `RelatedTopics[].Text` for fallback.
- Tool returns a compact text summary (≤ ~600 chars) the LLM can incorporate verbatim. Empty results return `"No results found for: {q}"`.

### `get_current_time`
- Zero-argument tool. Returns ISO 8601 string in UTC plus a human-friendly `YYYY-MM-DD HH:mm UTC` formatting.

### Shared types
- Extend `MessageRole` with `'tool'`.
- Extend `ChatMessage` with optional `toolName`, `toolArgs`, `toolResult` fields.
- Extend `ChatResponse` with optional `toolCalls: ToolCallRecord[]` so the frontend can splice tool messages into history.

### Frontend
- New standalone component `ToolCallBubble` in `libs/ui/src/lib/tool-call-bubble/`. Muted parchment-tinted card showing: tool name (small uppercase), collapsible JSON args, result text.
- `ChatComponent.dispatchRequest` splices any returned `toolCalls` into `this.messages` as `role: 'tool'` entries inserted **before** the final assistant message, in order.
- `chat.html` template renders `app-tool-call-bubble` for `message.role === 'tool'` and falls through to `app-message-bubble` otherwise.
- Persisted via `HistoryService.upsertSession` automatically — tool messages are just `ChatMessage` entries.

### Persistence + multi-turn
- LangGraph already persists `ToolMessage` and `AIMessage(tool_calls=...)` via `MemorySaver`. No change needed for backend conversation memory.
- Frontend re-loads tool bubbles from `localStorage` for free because they're regular `ChatMessage` objects.

### Out of scope (per ROADMAP scope note)
Streaming, reasoning traces, user-configurable tools, MCP, auth-gated tools, tool marketplaces, GCS deploy.

</decisions>

<canonical_refs>
## Canonical References

### Existing patterns to follow
- `apps/backend/src/app/agents/agents.service.ts` — current single-node graph; new graph builder must keep `getOrBuildGraph(modelId)` + per-model `MemorySaver` reuse pattern.
- `apps/backend/CLAUDE.md` — NestJS rules (Logger, no console.log, types from `@org/shared-types`, no `any`).
- `apps/frontend/CLAUDE.md` — standalone + OnPush + Tailwind-only rules.
- `libs/shared-types/src/lib/chat.types.ts` — types to extend (do not break existing fields).
- `libs/ui/src/lib/message-bubble/message-bubble.ts` — pattern for muted styled bubble + OnPush component.
- `apps/frontend/src/app/chat/chat.ts` — `dispatchRequest` is the splice-point; `messages` array is the single source of truth for the rendered conversation.

### External docs
- LangGraph JS tool-calling tutorial: `https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/`
- OpenRouter tool-calling parameter (OpenAI-compatible `tools` array): `https://openrouter.ai/docs/features/tool-calling`
- DuckDuckGo Instant Answer API: `https://duckduckgo.com/api`

</canonical_refs>

<specifics>
## Specific Ideas

- Use `zod` for tool arg schemas (LangChain already depends on it transitively; add explicit dep if missing).
- `ToolCallRecord`: `{ name: string; args: Record<string, unknown>; result: string }`.
- Tool calls are extracted from the LangGraph result by walking `result.messages` for `AIMessage` entries with `tool_calls` and pairing them with the next `ToolMessage` by `tool_call_id`. Only return calls that happened in **this turn** (i.e. messages whose index >= the input message index).
- `web_search` must wrap network errors and return `"Search failed: {error}"` instead of throwing — keeps the agent loop alive.
- Default model `openai/gpt-4o-mini` already supports tools. Free models like `meta-llama/llama-3.1-8b-instruct:free` may not — `bindTools` is safe to call regardless; if the model ignores tools, the agent just answers directly. Acceptable for v1.

</specifics>

<deferred>
## Deferred Ideas

- Real paid search API (Tavily / Brave) — DuckDuckGo is the starter.
- Streaming tool call deltas to the UI.
- User-toggleable tool enable/disable list.
- Per-model tool-capability gating (warn user when selected model doesn't support tools).
- Multi-tool parallel execution UI.

</deferred>

---

*Phase: 09-tool-calling-function-calling*
*Context gathered: 2026-05-23 (direct authoring)*
