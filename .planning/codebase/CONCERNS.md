# Codebase Concerns

**Analysis Date:** 2026-05-17

## Critical Issues

1. **Placeholder search tool** — `apps/backend/src/app/agents/agents.service.ts:17` — `searchTool` returns a hardcoded string `"Mocked search results for: ..."`. The LLM is fed fabricated search results on every tool call.

2. **Unsafe type cast** — `agents.service.ts:62` — `as unknown as BaseMessage` double cast bypasses TypeScript to push a plain object where a `BaseMessage` class instance is expected. Should use `ToolMessage` from `@langchain/core/messages`.

3. **Missing input validation** — No `ValidationPipe` on `POST /api/agents/chat`. Raw unvalidated request body is passed directly to the LLM.

4. **Broken Docker build** — `apps/backend/Dockerfile:10-11` copies `apps/backend` and `apps/backend-e2e` but NOT `libs/`. The `@org/shared-types` workspace library is absent during the Docker build, making the image likely broken at runtime.

## Security Considerations

- No authentication or authorization on any API endpoint
- No rate limiting on the chat endpoint (unbounded LLM cost exposure)
- `GOOGLE_API_KEY` silently becomes `undefined` with no startup guard — only fails at first request time, not on boot
- CORS origin hardcoded to `http://localhost:4200` in `main.ts` — needs environment-driven config for production

## Technical Debt

- `MemorySaver` is in-process only — all conversation history is lost on every backend restart; needs a persistent store (Redis, PostgreSQL) for production
- Manual `callTools` node (`agents.service.ts:56–66`) must be updated for every new tool added; should use LangGraph's prebuilt `ToolNode`
- `libs/shared-types/src/lib/shared-types.ts` is a dead scaffold stub with no content
- `AppController` and `AppService` are unused scaffolding left over from Nx generation
- No `.env.example` or environment variable documentation anywhere in the repo

## Missing Pieces

- **Entire frontend is the Nx welcome page** — no chat UI, no `ChatService`, no HTTP calls, no routes defined
- **Zero backend unit tests** — `AgentsService` and `AgentsController` have no `*.spec.ts` files; `@nestjs/testing` installed but unused
- **E2E tests not wired to CI** — `.github/workflows/ci.yml` has no `e2e` step; E2E tests never run in CI
- **No frontend Docker setup** — no Dockerfile for the Angular app, no frontend service in `docker-compose.yml`
- **No health check endpoint** — backend has no `/health` or `/readiness` endpoint for Docker/orchestrator use

## Infrastructure / DevOps Gaps

- `docker-compose.yml` only runs backend; no database, no frontend, no reverse proxy
- No production build stage in `apps/backend/Dockerfile` (likely using dev build)
- No environment-specific configuration management (no config module, no `.env` loading beyond raw `process.env`)
- GitHub Actions CI only runs lint and build — no tests executed in pipeline

## Recommendations

1. Replace the placeholder `searchTool` with a real implementation (Tavily, SerpAPI, or similar) before any demo/production use
2. Add `ValidationPipe` globally in `main.ts` and DTOs for all controllers
3. Fix the Dockerfile to copy `libs/` alongside `apps/`
4. Add a `ConfigModule` (NestJS) to validate required env vars on startup
5. Add backend unit tests for `AgentsService` — especially the LangGraph routing logic
6. Wire E2E tests into CI or add backend unit test step as a minimum gate
7. Replace `MemorySaver` with a Redis-backed checkpointer before any multi-user or persistent-session use
