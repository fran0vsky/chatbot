# Project Research Summary

**Project:** Chatbot
**Domain:** Text chatbot -- Angular SPA + NestJS API + LangGraph agent
**Researched:** 2026-05-17
**Confidence:** HIGH

## Executive Summary

This is a two-task project to ship a working bubble chat UI backed by OpenRouter (GPT-4o mini) and then add model switching. The existing codebase has a fully wired NestJS + LangGraph backend (currently pointed at Gemini) and an Angular SPA with no chat UI yet. The recommended approach is a minimal, surgical migration: swap @langchain/google-genai for @langchain/openai with configuration.baseURL pointed at OpenRouter, collapse the LangGraph graph from its current tools-loop to a straight START -> agent -> END, and build the Angular chat UI as four standalone components driven by Angular signals.

The main risk cluster is pre-existing bugs that must be fixed first: the Dockerfile is missing a COPY libs ./libs step (Docker builds fail silently), the callTools node uses an unsafe type cast on ToolMessage (graph serialization breaks), and @langchain/openai is only a transitive dependency (must be declared in package.json before any build). These three fixes must precede the OpenRouter wiring.

Model switching (Task 2 / MODEL-01) is deliberately deferred. The correct architecture for it is LangGraph RunnableConfig.configurable -- passing modelName at graph.invoke() time rather than rebuilding the graph per request. Task 1 instantiates ChatOpenAI once in the constructor; Task 2 introduces the configurable pattern without touching the graph structure.

## Key Findings

### Recommended Stack

Use @langchain/openai (already in node_modules at v1.4.5 but not declared in package.json). Create ChatOpenAI with configuration.baseURL: https://openrouter.ai/api/v1 and apiKey: process.env[OPENROUTER_API_KEY]. This is a drop-in replacement for ChatGoogleGenerativeAI -- identical interface at the LangGraph level, no graph refactor needed. Add HTTP-Referer and X-Title via configuration.defaultHeaders. Remove @langchain/google-genai after confirming nothing else imports it.

**Core technologies:**
- @langchain/openai ChatOpenAI: LLM client -- only LangChain-native OpenAI-compatible client; BaseChatModel interface is identical to current Gemini client
- openai/gpt-4o-mini: default model ID -- namespaced OpenRouter format required; bare gpt-4o-mini causes silent 404
- OPENROUTER_API_KEY: env var -- replaces GOOGLE_API_KEY; validate at startup before first request

**Version note:** Verify @langchain/openai peer dep compatibility with @langchain/core ^1.1.46 during npm install -- npm will error if incompatible.

### Expected Features

**Must have (table stakes) -- CHAT-01 through CHAT-04:**
- Message bubble list (user right, assistant left) -- core chat metaphor
- Text input with send button -- Enter key and click both submit
- Auto-scroll to latest message -- afterRender + scroll anchor div
- Typing / loading indicator -- animated bouncing dots in a ghost bubble
- Disabled input while loading -- prevents double-submit
- Error state in UI -- inline error message on HTTP failure
- Per-session thread ID -- crypto.randomUUID() generated once in ChatService

**Should have (competitive) -- defer to after Task 2:**
- Streaming responses (token-by-token) -- requires SSE/WebSocket; out of scope Task 1
- Markdown rendering in assistant bubbles -- ngx-markdown + DOMPurify when needed
- Timestamps per message -- cheap to store now, defer rendering

**Defer (v2+):**
- Copy-to-clipboard, auto-resize textarea, welcome/empty state screen

### Architecture Approach

Backend change is minimal: remove searchTool, callTools node, shouldContinue function, and all conditional edges. Wire START -> agent -> END directly. Keep MemorySaver and the compiled singleton graph. For Task 2, introduce RunnableConfig.configurable.modelName resolution inside callModel -- keeps a single compiled graph.

**Major components:**
1. ChatService -- signals for messages, isLoading, threadId; send() method with HttpClient; finalize() clears loading on success and error paths
2. chat-page -- routed page; injects ChatService; assembles child components
3. message-list -- @for loop over messages; owns scrollAnchor + afterRender scroll; shows typing indicator when isLoading() is true
4. message-bubble -- purely presentational; input() for Message; Tailwind conditional classes for role-based alignment
5. chat-input -- local input signal; emits (send) output; disabled binding wired to isLoading()

Shared types (ChatRequest, ChatResponse) already exist in libs/shared-types/ -- use as-is. Make threadId required for compile-time enforcement.

### Critical Pitfalls

1. **Dockerfile missing COPY libs ./libs (P1)** -- Docker builds fail with Cannot find module @org/shared-types. Fix: add COPY libs ./libs before the Nx build step; remove unnecessary apps/backend-e2e copy.
2. **@langchain/openai not in package.json (P15)** -- transitive-only dep silently vanishes in production Docker builds. Fix: add @langchain/openai ^1.4.5 to root package.json dependencies as the first step.
3. **Unsafe ToolMessage type cast (P11)** -- as unknown as BaseMessage on a plain object causes LangGraph checkpointing to fail. Fix: delete callTools node entirely for Task 1; use ToolNode from @langchain/langgraph/prebuilt when real tools are added.
4. **Frontend never sends threadId (P5)** -- all users share the default thread, corrupting conversation memory. Fix: generate once with crypto.randomUUID() in ChatService at init; pass on every request.
5. **OnPush array mutation (P7)** -- calling .push() on the messages array does not trigger change detection. Fix: always use signal.update(msgs => [...msgs, newMessage]).

## Implications for Roadmap

Two phases map directly to the two tasks. No additional phases are justified.

### Phase 1: OpenRouter Backend + Chat UI (Task 1)

**Rationale:** Backend wiring and frontend build are interdependent, but the backend must work first so the frontend can be tested end-to-end. Pre-existing bugs must be fixed before wiring to avoid confusing failures.
**Delivers:** CHAT-01, CHAT-02, CHAT-03, CHAT-04 -- fully working chat app with bubble UI, per-session memory, GPT-4o mini via OpenRouter.
**Build order within this phase:**
1. Fix pre-existing bugs: COPY libs ./libs in Dockerfile, @langchain/openai to package.json, delete callTools/searchTool/shouldContinue
2. Swap ChatGoogleGenerativeAI for ChatOpenAI with OpenRouter config; simplify graph to START -> agent -> END
3. Add startup env var guard for OPENROUTER_API_KEY; add try/catch in runAgent
4. Build ChatService with signals, threadId, send() method with catchError
5. Build message-bubble, message-list, chat-input, chat-page in that order
6. Wire chat-page as root route; smoke-test full message roundtrip
**Avoids:** P1 (Dockerfile), P2/P3 (OpenRouter URL/model ID), P4/P5 (thread ID), P6 (env guard), P7 (OnPush mutation), P8 (scroll timing), P10 (unhandled rejections), P11 (ToolMessage cast), P13 (HttpClient error), P14 (Tailwind dynamic classes), P15 (missing dep)

### Phase 2: Model Switching (Task 2)

**Rationale:** Requires working Phase 1 as foundation. Model switching is additive -- it does not touch the graph structure, only the model resolution path inside callModel.
**Delivers:** MODEL-01 -- user can select the active model from the UI; backend accepts modelName in ChatRequest and resolves ChatOpenAI via RunnableConfig.configurable.
**Uses:** OpenRouter model IDs established in Phase 1; configurable pattern from LangGraph; a model selector component in Angular
**Implements:** configurable.modelName inside callModel; updated ChatRequest to include modelName?; model picker UI component

### Phase Ordering Rationale

- Phase 1 before Phase 2: the chat UI is the dependency surface for model switching -- no UI means nowhere to put the model selector.
- Bug fixes before wiring: Dockerfile and type-cast bugs produce cryptic errors during OpenRouter integration if left unfixed.
- Backend before frontend within Phase 1: POST /api/agents/chat must return real responses before the Angular service can be tested end-to-end.
- ChatService before components: all child components read from ChatService signals; building components first means building against an undefined interface.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1:** All patterns verified against installed node_modules. The ChatOpenAI + OpenRouter swap is a 3-line change with high-confidence precedent. Angular signal + OnPush patterns are stable.
- **Phase 2:** RunnableConfig.configurable is documented in LangGraph; model selector is straightforward Angular component work. No deep research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | @langchain/openai v1.4.5 type declarations verified in node_modules; OpenRouter API officially documented |
| Features | HIGH | Angular 21 patterns from official docs; Tailwind patterns from stable community conventions |
| Architecture | HIGH | Verified against installed node_modules; graph simplification confirmed by direct code analysis |
| Pitfalls | HIGH (critical), MEDIUM (moderate) | Critical pitfalls confirmed by direct Dockerfile/code inspection; moderate pitfalls based on framework knowledge |

**Overall confidence:** HIGH

### Gaps to Address

- @langchain/openai peer dep compatibility with @langchain/core ^1.1.46: verify during npm install -- npm will error if there is a conflict; pin version if needed.
- OPENROUTER_API_KEY must be obtained and added to .env before Phase 1 can run end-to-end. Purely operational -- no code gap.
- threadId field on ChatRequest is currently optional. Making it required is a breaking change to the shared-types contract; confirm no other consumers rely on the optional form before changing.

## Sources

### Primary (HIGH confidence)
- apps/backend/Dockerfile (direct inspection) -- confirmed missing libs/ copy step
- apps/backend/src/agents/agents.service.ts (direct inspection) -- confirmed unsafe ToolMessage cast, missing try/catch, threadId default
- node_modules/@langchain/openai v1.4.5 type declarations (direct inspection) -- confirmed configuration.baseURL and apiKey constructor options
- package.json audit (direct inspection) -- confirmed @langchain/openai absent from declared deps
- OpenRouter API docs (https://openrouter.ai/docs) -- baseURL, auth headers, model ID format
- Angular official docs (https://angular.dev) -- afterRender, viewChild, signals, OnPush

### Secondary (MEDIUM confidence)
- OpenRouter base URL and model ID format: training data corroboration across multiple community integrations
- Angular role=log ARIA live region: MDN Web Docs

### Tertiary (LOW confidence)
- Angular 21 async pipe re-subscription edge cases (P16): common pattern issue; not verified against Angular 21 specifically

---
*Research completed: 2026-05-17*
*Ready for roadmap: yes*
