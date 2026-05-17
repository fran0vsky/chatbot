<!-- refreshed: 2026-05-17 -->
# Architecture

**Analysis Date:** 2026-05-17

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              Browser (Angular 21 SPA)                        │
│              `apps/frontend/src/`                            │
│  provideHttpClient → HTTP calls to backend API               │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP POST /api/agents/chat
                             ▼
┌─────────────────────────────────────────────────────────────┐
│            NestJS API Server (port 3000)                     │
│            `apps/backend/src/`                               │
│                                                              │
│  AppModule                                                   │
│    └── AgentsModule                                          │
│         ├── AgentsController  POST /api/agents/chat          │
│         └── AgentsService     LangGraph orchestration        │
└────────────────────────────┬────────────────────────────────┘
                             │ LangGraph StateGraph
                             ▼
┌─────────────────────────────────────────────────────────────┐
│           LangGraph Agent Loop                               │
│   START → agent (Gemini 2.0 Flash Lite) → tools? → END      │
│   MemorySaver checkpointer (in-process, by thread_id)        │
└────────────────────────────┬────────────────────────────────┘
                             │ @langchain/google-genai
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         Google Generative AI (Gemini)                        │
│         External API — requires GOOGLE_API_KEY env var       │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `AppModule` | Root NestJS module; wires AppController + AgentsModule | `apps/backend/src/app/app.module.ts` |
| `AppController` | Health/hello endpoint `GET /api` | `apps/backend/src/app/app.controller.ts` |
| `AppService` | Returns static `{ message: 'Hello API' }` | `apps/backend/src/app/app.service.ts` |
| `AgentsModule` | Self-contained NestJS module for all agent concerns | `apps/backend/src/app/agents/agents.module.ts` |
| `AgentsController` | HTTP adapter — `POST /api/agents/chat` → `AgentsService` | `apps/backend/src/app/agents/agents.controller.ts` |
| `AgentsService` | Builds and runs LangGraph `StateGraph`; holds MemorySaver | `apps/backend/src/app/agents/agents.service.ts` |
| `App` (Angular root) | Bootstraps Angular SPA; hosts router outlet | `apps/frontend/src/app/app.ts` |
| `shared-types` | Shared TypeScript interfaces `ChatRequest` / `ChatResponse` | `libs/shared-types/src/lib/chat.types.ts` |

## Pattern Overview

**Overall:** Standalone Angular SPA (frontend) + NestJS REST API (backend) + LangGraph ReAct-style agent loop.

**Key Characteristics:**
- NestJS uses standard module/controller/service layering; `AgentsModule` is the only domain module.
- LangGraph `StateGraph` is compiled once in `AgentsService` constructor and reused across requests.
- Thread-scoped conversation memory is held in-process via `MemorySaver` (not persistent across restarts).
- Shared types cross the wire boundary via the `@org/shared-types` lib imported by both backend and (prospectively) frontend.
- Angular is standalone-component-based (no NgModules); routing via `provideRouter`, HTTP via `provideHttpClient`.

## Layers

**Frontend (Angular SPA):**
- Purpose: Browser UI; sends chat messages to backend, displays responses.
- Location: `apps/frontend/src/`
- Contains: One root `App` component, `app.config.ts` (providers), `app.routes.ts` (router config), global SCSS.
- Depends on: `@angular/router`, `@angular/common/http`, `@org/shared-types` (type contracts).
- Used by: End user via browser.

**Backend API (NestJS):**
- Purpose: HTTP server exposing REST endpoints; orchestrates AI agents.
- Location: `apps/backend/src/`
- Contains: `AppModule` → `AgentsModule` (controller + service), `AppController`, `AppService`.
- Depends on: `@nestjs/*`, `@langchain/langgraph`, `@langchain/google-genai`, `@org/shared-types`.
- Used by: Angular frontend (HTTP).

**Agent Layer (LangGraph within AgentsService):**
- Purpose: Multi-step LLM reasoning with tool invocation.
- Location: `apps/backend/src/app/agents/agents.service.ts`
- Contains: `AgentState` annotation, `searchTool`, `callModel`, `shouldContinue`, `callTools` node functions, compiled `StateGraph`.
- Depends on: `@langchain/langgraph`, `@langchain/core`, `@langchain/google-genai`, `zod`.
- Used by: `AgentsController`.

**Shared Types Library:**
- Purpose: Single source of truth for API contract types.
- Location: `libs/shared-types/src/`
- Contains: `ChatRequest`, `ChatResponse` interfaces.
- Depends on: Nothing.
- Used by: `AgentsController` (backend), future frontend services.

## Data Flow

### Chat Request Path

1. User submits message — browser sends `POST /api/agents/chat` with `{ message, threadId }` (`apps/frontend/src/app/` via `HttpClient`)
2. `AgentsController.chat()` receives `ChatRequest`, delegates to `AgentsService.runAgent()` (`apps/backend/src/app/agents/agents.controller.ts:9`)
3. `AgentsService.runAgent()` wraps message in `HumanMessage`, invokes the compiled `StateGraph` with `thread_id` configurable (`apps/backend/src/app/agents/agents.service.ts:78`)
4. Graph node `agent` — calls Gemini 2.0 Flash Lite with bound tools (`agents.service.ts:45`)
5. `shouldContinue` conditional edge — if the model returned tool calls, routes to `tools` node; otherwise routes to `END` (`agents.service.ts:50`)
6. `tools` node — executes `searchTool` for each tool call, appends `ToolMessage` results, loops back to `agent` (`agents.service.ts:56`)
7. Final `AIMessage` extracted from state; `response` string returned as `ChatResponse` (`agents.service.ts:86`)

### Health Check Path

1. `GET /api` → `AppController.getData()` → `AppService.getData()` → `{ message: 'Hello API' }`

**State Management:**
- Agent conversation state is persisted per `thread_id` in `MemorySaver` (in-memory, singleton within the NestJS process).
- No database or external state store. Memory is lost on process restart.
- Angular frontend has no client-side state management library (no NgRx/Signals store configured yet).

## Key Abstractions

**`AgentState` (LangGraph Annotation):**
- Purpose: Typed state container for the graph; `messages` array with append reducer.
- Examples: `apps/backend/src/app/agents/agents.service.ts:9`
- Pattern: `Annotation.Root` with `reducer: (x, y) => x.concat(y)` — messages accumulate across turns.

**`ChatRequest` / `ChatResponse`:**
- Purpose: Typed API contract shared between front and back.
- Examples: `libs/shared-types/src/lib/chat.types.ts`
- Pattern: Plain interfaces exported from `@org/shared-types`; imported in controller via workspace path alias.

**`searchTool`:**
- Purpose: Placeholder web-search capability registered with the LLM via `model.bindTools([searchTool])`.
- Examples: `apps/backend/src/app/agents/agents.service.ts:15`
- Pattern: `tool(fn, { name, description, schema })` from `@langchain/core/tools` + Zod schema.

## Entry Points

**Backend bootstrap:**
- Location: `apps/backend/src/main.ts`
- Triggers: `node dist/main.js` / `pnpm nx serve backend`
- Responsibilities: Creates NestJS app, enables CORS for `http://localhost:4200`, sets global prefix `api`, listens on `PORT` (default 3000).

**Frontend bootstrap:**
- Location: `apps/frontend/src/main.ts`
- Triggers: `pnpm nx serve frontend`
- Responsibilities: `bootstrapApplication(App, appConfig)` — Angular standalone bootstrap.

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop. LangGraph invocations are async/await; no worker threads used.
- **Global state:** `AgentsService` holds a singleton `MemorySaver` and compiled `graph` at module level — shared across all HTTP requests. Concurrent requests to the same `thread_id` are not guarded.
- **Circular imports:** None detected.
- **CORS:** Hardcoded allowed origin `http://localhost:4200` (overridable via `CORS_ORIGIN` env var). Production deployments need this set explicitly.
- **Tool stub:** `searchTool` returns a static placeholder string — not wired to a real search API.

## Anti-Patterns

### In-process MemorySaver for conversation state

**What happens:** `MemorySaver` is instantiated inside `AgentsService`; all thread histories live in the Node.js heap.
**Why it's wrong:** State is lost on every restart/redeploy; cannot scale horizontally (different instances have different memories).
**Do this instead:** Replace with a persistent checkpointer (e.g., `@langchain/langgraph-checkpoint-postgres` or Redis-backed) and inject connection via NestJS providers.

### Placeholder search tool

**What happens:** `searchTool` always returns a static string regardless of query.
**Why it's wrong:** The agent believes it has web-search capability but results are always fabricated.
**Do this instead:** Wire `searchTool` to a real search API (Tavily, SerpAPI, etc.) with proper API key injection via `process.env`.

## Error Handling

**Strategy:** No explicit global exception filter configured. NestJS default exception layer returns HTTP 500 for unhandled errors.

**Patterns:**
- `AgentsService.runAgent()` does not catch LangGraph or LLM errors — unhandled rejections bubble to NestJS default handler.
- No request validation (e.g., `class-validator` / `ValidationPipe`) on `AgentsController` body.

## Cross-Cutting Concerns

**Logging:** NestJS `Logger` used in `AgentsService` (`Logger.log(...)` on each `runAgent` call). No structured logging library.
**Validation:** None enforced at the HTTP layer. `ChatRequest` is typed but not runtime-validated.
**Authentication:** None. All endpoints are publicly accessible.

---

*Architecture analysis: 2026-05-17*
