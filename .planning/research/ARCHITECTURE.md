# Architecture Research

**Project:** Chatbot — OpenRouter migration
**Researched:** 2026-05-17
**Overall confidence:** HIGH (verified against installed node_modules type declarations)

---

## Recommended Refactor Approach

Replace `@langchain/google-genai` with `@langchain/openai` (already in `node_modules` at
v1.4.5, wrapping `openai` SDK v6.34). Point the client at OpenRouter by supplying
`configuration.baseURL`. Remove the placeholder `searchTool` entirely and collapse the graph
to a straight `agent → END` path. Keep `MemorySaver` and the compiled singleton graph exactly
as-is. The `AgentsModule` and `AppModule` require zero structural changes.

This is the minimum diff that makes Task 1 work. Model switching (Task 2 / MODEL-01) is
deferred but the instantiation pattern described below leaves the door open without over-engineering now.

---

## Component Changes

### AgentsService changes

**1. Swap the import and constructor.**

Replace:

```typescript
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
// ...
this.model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash-lite',
  apiKey: process.env['GOOGLE_API_KEY'],
});
```

With:

```typescript
import { ChatOpenAI } from '@langchain/openai';
// ...
this.model = new ChatOpenAI({
  model: 'openai/gpt-4o-mini',           // OpenRouter model identifier
  apiKey: process.env['OPENROUTER_API_KEY'],
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
  },
});
```

Confidence: HIGH — verified from installed `@langchain/openai` v1.4.5 type declarations.
`BaseChatOpenAIFields` has `configuration?: ClientOptions` (from the `openai` SDK), and
`ClientOptions.baseURL` is the standard override point for any OpenAI-compatible proxy.
`apiKey` maps to `ClientOptions.apiKey` internally.

**Note on `@langchain/openai` package registration.**
`@langchain/openai` exists in `node_modules` (a transitive install) but is NOT listed in the
root `package.json` dependencies or `apps/backend/package.json`. It must be added explicitly
before the build step, otherwise Nx/webpack may not include it in the production bundle and
it will silently vanish in Docker.

Add to root `package.json` dependencies:
```json
"@langchain/openai": "^1.4.5"
```

---

### Graph simplification (no real tools)

**Remove `searchTool` and the `tools` node entirely.**

The current graph is:

```
START → agent → shouldContinue → tools (if tool_calls) → agent
                               → END   (if no tool_calls)
```

With `searchTool` gone there are no tools to bind and the LLM will never emit tool_calls.
The `shouldContinue` edge and `callTools` node become dead code. Collapse to:

```
START → agent → END
```

**What to delete:**
- The `searchTool` constant and its `tool()` / `z.object()` import usage
- The `tools` array and `model.bindTools(tools)` call — replace with plain `model` invocation
- The `shouldContinue` function
- The `callTools` node function
- `.addNode('tools', callTools)`
- `.addConditionalEdges('agent', shouldContinue)`
- `.addEdge('tools', 'agent')`

**What stays:**
- `callModel` node (unchanged logic, invoke plain model instead of modelWithTools)
- `.addEdge(START, 'agent')`
- `.compile({ checkpointer: this.checkpointer })`

**On `ToolNode` prebuilt (question 3):** Yes, `ToolNode` should replace the custom `callTools`
_if and when_ real tools are added later. The installed `@langchain/langgraph` v1.3.0 ships
`ToolNode` at `@langchain/langgraph/prebuilt`. It runs all tool calls in parallel, returns
proper `ToolMessage[]`, and handles errors via `handleToolErrors` option. The custom
`callTools` has two bugs: the `as unknown as BaseMessage` cast is unsafe and it only handles
the hardcoded `'search'` tool name. `ToolNode` is strictly better. But right now, with no
tools at all, there is nothing for `ToolNode` to wrap — so the correct answer for this task is
to remove the tools node entirely and add `ToolNode` only when a real tool is wired.

**On `toolsCondition` prebuilt:** Also exported from `@langchain/langgraph/prebuilt`.
It replaces `shouldContinue` when tools are added. Defer its adoption until then.

---

### Model instantiation pattern

**Instantiate once in the constructor (keep current pattern for Task 1).**

Rationale:
- The LangChain `ChatOpenAI` constructor is cheap (no network call, just client config).
- The compiled `StateGraph` holds a closure over `callModel`, which calls
  `this.model.invoke(...)` at runtime. The model reference is captured once at graph
  compile-time. To swap the model per-request you would need to rebuild the graph or
  pass the model in via state/config — adding meaningful complexity.
- Task 2 (MODEL-01) will require per-request model selection. The correct approach there
  is NOT to rebuild the graph per-request, but to use LangGraph's `RunnableConfig.configurable`
  to pass a model name at invoke-time and resolve it inside `callModel`. That pattern keeps a
  single compiled graph and a single `AgentsService` instance.
- Therefore: keep constructor instantiation now. Flag Task 2 to introduce a
  `configurable.modelName` pattern rather than a per-request constructor call.

---

## Environment Config

**Use `process.env` directly — do NOT add `@nestjs/config` for Task 1.**

Rationale:
- `@nestjs/config` is not installed (confirmed: absent from both `package.json` and
  `node_modules`). Adding it means a new dependency, module import in `AppModule`, and
  injecting `ConfigService` into `AgentsService` — three files changed for zero functional
  gain at this stage.
- The existing codebase already uses `process.env['GOOGLE_API_KEY']` in the service
  constructor. Follow the same pattern for consistency.
- NestJS reads environment variables at startup; since the model is instantiated in the
  constructor (which runs after the module is loaded), `process.env['OPENROUTER_API_KEY']`
  is always available by the time the constructor runs.
- `@nestjs/config` becomes worthwhile in Task 2 when `ConfigService` enables typed,
  validated config and supports runtime model name lookup from env.

**Required environment variable change:**

| Old | New |
|-----|-----|
| `GOOGLE_API_KEY` | `OPENROUTER_API_KEY` |

Update:
- `.env` / `.env.local` in the repo root (add `OPENROUTER_API_KEY`)
- `docker-compose.yml` — replace `GOOGLE_API_KEY` passthrough with `OPENROUTER_API_KEY`
- Any CI secrets

**No `.env` file should be committed.** Add `.env` to `.gitignore` if not already there.

---

## Build Order

Steps in dependency order for a clean migration:

1. **Add `@langchain/openai` to root `package.json` dependencies** (it is currently only a
   transitive dep; making it explicit prevents silent omission in Docker builds).
   Run `npm install` after editing `package.json`.

2. **Edit `agents.service.ts`:**
   - Remove `@langchain/google-genai` import and `searchTool` declaration.
   - Remove unused imports: `tool` from `@langchain/core/tools`, `z` from `zod` (if no
     longer used elsewhere).
   - Replace `ChatGoogleGenerativeAI` with `ChatOpenAI` from `@langchain/openai`.
   - Update constructor model instantiation (see above).
   - Simplify `buildGraph()` — remove tools array, `shouldContinue`, `callTools`,
     conditional edges, and tools node. Wire `START → agent → END` directly.
   - The `runAgent` method is unchanged.

3. **Update `docker-compose.yml`** — swap environment variable key.

4. **Verify `.env` / local dev config** — ensure `OPENROUTER_API_KEY` is set.

5. **Run `pnpm nx serve backend`** — confirm startup with no `GOOGLE_API_KEY` errors
   and a successful chat request through `POST /api/agents/chat`.

6. **Remove `@langchain/google-genai` from root `package.json`** only after confirming
   nothing else in the workspace imports it (the `@langchain/anthropic` package is also
   present and unused — can be cleaned up in the same pass if desired).

---

## Confidence Assessment

| Question | Answer | Confidence | Source |
|----------|--------|------------|--------|
| `ChatOpenAI` + `configuration.baseURL` for OpenRouter | Correct pattern | HIGH | `@langchain/openai` v1.4.5 type declarations in `node_modules` |
| Constructor vs per-request instantiation | Constructor for now, configurable for Task 2 | HIGH | LangGraph graph compilation semantics |
| Remove custom `callTools`, use `ToolNode` when tools return | Yes — but not now | HIGH | `tool_node.d.ts` in installed `@langchain/langgraph` v1.3.0 |
| No tools node without real tools | Correct — simplify to agent→END | HIGH | Direct code analysis |
| `process.env` over `@nestjs/config` | `process.env` for Task 1 | HIGH | Package inventory — `@nestjs/config` not installed |
| `@langchain/openai` needs explicit dependency | Yes | HIGH | `package.json` audit — absent from declared deps |
