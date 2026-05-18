# Walking Skeleton — Chatbot

**Phase:** 1
**Generated:** 2026-05-18

## Capability Proven End-to-End

A user opens the Angular SPA in a browser, types a message into the chat textarea, presses Enter, and within seconds sees a real text answer from `openai/gpt-4o-mini` (via OpenRouter) rendered as an assistant bubble. A follow-up message in the same browser tab demonstrates conversation memory (the assistant references the earlier turn). Refreshing the page starts a brand-new conversation.

This exercises the full stack end-to-end: Angular standalone component → `ChatService` (`HttpClient`) → NestJS `AgentsController` → `AgentsService` → LangGraph `StateGraph` (`START → callModel → END`) → `ChatOpenAI` (OpenRouter) → real LLM response → JSON back to browser → rendered as bubble.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | Angular 21 (standalone components, OnPush) | Locked by stack; enforced by `@angular-eslint/prefer-standalone` |
| Backend framework | NestJS 11 | Locked by stack; existing `AgentsModule` reused |
| LLM orchestration | LangGraph `StateGraph` with `MemorySaver` | Locked by stack; minimal graph `START → callModel → END` per BACK-03 |
| LLM provider | OpenRouter via `@langchain/openai` `ChatOpenAI` with `configuration.baseURL` | Per CONTEXT.md and BACK-01; LangChain-native, no SDK swap |
| Default model | `openai/gpt-4o-mini` (namespaced model ID required by OpenRouter) | Per BACK-02; fast + cheap default |
| Conversation memory | In-process `MemorySaver` keyed by `threadId` (UUID) | Per-session scope (CONV-01 / CONV-02); no DB in Phase 1 |
| Frontend component tree | `App` → `app-chat` → `app-message-bubble` (three levels) | Per D-01 |
| HTTP boundary | Dedicated `ChatService` (Angular `@Injectable({ providedIn: 'root' })`) — components never call `HttpClient` directly | Per D-02 and `apps/frontend/CLAUDE.md` |
| Thread ID lifecycle | `crypto.randomUUID()` generated once in `ChatService` constructor; sent in every `ChatRequest.threadId` | Per CONV-01 + CONV-02 (refresh = new service instance = new UUID) |
| Styling | Tailwind CSS utility classes only | Per `apps/frontend/CLAUDE.md` (no inline styles, no SCSS modules) |
| Layout | Full-viewport: header (top), scrollable messages area, fixed input bar with border divider | Per D-13, D-14, D-15, D-16 |
| Input UX | Auto-expanding `<textarea>` (1–5 lines), Enter to send, Shift+Enter newline, disabled while loading | Per D-08, D-09, D-10 |
| Error UX | Inline red error bubble in message list, generic copy, no retry button, input re-enabled | Per D-03 through D-07 |
| Deployment target | Local dev (`pnpm nx serve backend` + `pnpm nx serve frontend`); Docker build for backend (fixed `Dockerfile`) | Existing infra; production deployment is out of scope for Phase 1 |
| Env var convention | Backend reads via `process.env['VAR_NAME']` bracket notation | Per `apps/backend/CLAUDE.md` |
| Directory layout | Existing Nx monorepo: `apps/backend/src/app/agents/`, `apps/frontend/src/app/`, `libs/shared-types/` (no new top-level dirs) | Existing structure already correct |

## Stack Touched in Phase 1

- [x] Project scaffold — Nx workspace already in place (apps/backend, apps/frontend, libs/shared-types)
- [x] Routing — Angular routes config exists; root `App` hosts `<app-chat>` directly (no new route needed for Phase 1)
- [x] LLM provider integration — real `ChatOpenAI` call against `https://openrouter.ai/api/v1` using `OPENROUTER_API_KEY`
- [x] State — per-thread conversation memory via `MemorySaver` keyed by `threadId`
- [x] UI — interactive `app-chat` component with textarea, send button, message bubbles, typing indicator, auto-scroll
- [x] HTTP — `ChatService` POSTs `ChatRequest` to `http://localhost:3000/api/agents/chat`, receives `ChatResponse`
- [x] Deployment — local full-stack run: backend on `:3000`, frontend on `:4200`, CORS already configured; Docker build verified after `Dockerfile` fix (BACK-05)

## Out of Scope (Deferred to Later Slices)

These items are intentionally excluded from Phase 1. Later phases must not re-litigate their absence.

- Model switching UI / `MODEL-01` — Phase 2 owns this; `app-header` is structured to accept a model selector in Phase 2 without refactoring
- Persistent conversation history across sessions / restarts (ENH-01) — `MemorySaver` is sufficient per the locked decision
- Markdown rendering in assistant messages (ENH-02) — plain text only in Phase 1
- Message timestamps (ENH-03)
- Copy-to-clipboard on messages (ENH-04)
- Real web search tool (ENH-05) — `searchTool` is removed entirely from the graph in Phase 1
- Rate limiting on the chat endpoint (ENH-06)
- Input validation with `ValidationPipe` / DTOs (ENH-07)
- Authentication / user accounts
- Dark mode
- Mobile-specific layouts (web-first; functional on common desktop viewports)
- Retry button on failed messages (explicitly rejected per D-06; user retypes instead)
- Tool calls / multi-step agent reasoning — graph is simplified to `START → callModel → END` per BACK-03
- HTTP status codes / technical error details surfaced to the user (D-05 — generic copy only)
- Tests for the new UI components — Phase 1 ships functional UI; test coverage is a known gap to address in a later phase if needed

## Subsequent Slice Plan

Each later phase adds one vertical user-visible slice on top of this skeleton without altering its architectural decisions.

- **Phase 2 — Choose Your Model:** Add a model selector control in the existing header. `ChatService` carries the selected model in each request; backend `AgentsService` constructs the `ChatOpenAI` instance per-request (or maintains a small cache) and uses the chosen model. No changes to component tree, HTTP boundary, or memory strategy.
- **Future (post-v1) — Persistent History:** Swap `MemorySaver` for a database-backed checkpointer (e.g. `@langchain/langgraph-checkpoint-postgres`); `threadId` lifecycle moves from in-memory `ChatService` instance to a persistent store keyed by user/session.
- **Future (post-v1) — Markdown rendering, timestamps, copy-to-clipboard:** UI enhancements layered on top of `app-message-bubble` without touching the chat state model or backend.
