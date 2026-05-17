# External Integrations

**Analysis Date:** 2026-05-17

## APIs & External Services

**Google AI (Gemini):**
- Service: Google Generative AI — powers the LangChain agent's LLM
- SDK: `@langchain/google-genai` ^2.1.30
- Client class: `ChatGoogleGenerativeAI` from `@langchain/google-genai`
- Model in use: `gemini-2.0-flash-lite`
- Auth env var: `GOOGLE_API_KEY` (Google AI Studio key)
- Usage file: `apps/backend/src/app/agents/agents.service.ts`

**Anthropic Claude (available, not yet wired):**
- SDK: `@langchain/anthropic` ^1.3.29 — installed in root `package.json`
- No usage detected in current source; available for future model switching
- Would require `ANTHROPIC_API_KEY` env var

**Web Search (placeholder):**
- A `searchTool` is defined in `apps/backend/src/app/agents/agents.service.ts`
- Currently returns a static placeholder string — no real search API is wired
- Schema: `{ query: string }` via Zod
- Intended integration point for a real search provider (e.g., Tavily, SerpAPI, Brave)

## AI / Agent Orchestration

**LangChain + LangGraph:**
- `langchain` ^1.4.0 — base chain and tool abstractions
- `@langchain/core` ^1.1.46 — messages (`HumanMessage`, `AIMessage`, `BaseMessage`), tool primitives
- `@langchain/langgraph` ^1.3.0 — stateful agent graph
  - `StateGraph` with `Annotation.Root` for message state
  - `MemorySaver` checkpointer for per-thread conversation history (in-memory, not persisted)
  - Conditional edges (`shouldContinue`) for tool-calling loop
- `@langchain/community` ^1.1.28 — community integrations (available but not currently used)
- Usage file: `apps/backend/src/app/agents/agents.service.ts`

## Data Storage

**Databases:**
- None — no database is configured or used
- Conversation memory is in-process only via LangGraph `MemorySaver` (lost on restart)

**File Storage:**
- Local filesystem only — no object storage (S3, GCS, etc.) configured

**Caching:**
- None — no Redis or other cache layer

## Authentication & Identity

**Auth Provider:**
- None — no authentication or authorization is implemented
- API endpoints are publicly accessible (no guards detected)
- `CORS_ORIGIN` env var restricts browser-based cross-origin access to `http://localhost:4200` by default

## Frontend ↔ Backend Communication

**HTTP API:**
- Angular `HttpClient` (via `provideHttpClient()` in `apps/frontend/src/app/app.config.ts`)
- Backend endpoint: `POST /agents/chat`
  - Request type: `ChatRequest { message: string; threadId?: string }` from `@org/shared-types`
  - Response type: `ChatResponse { response: string }` from `@org/shared-types`
  - Types shared via internal lib: `libs/shared-types/src/lib/chat.types.ts`
- No WebSocket or SSE streaming — single request/response pattern

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or equivalent

**Logs:**
- NestJS `Logger` class used in backend (convention enforced via `apps/backend/CLAUDE.md`)
- No structured logging pipeline or log aggregation service

## CI/CD & Deployment

**Container Registry:**
- GitHub Container Registry (ghcr.io)
- Image path: `ghcr.io/{github.repository}/backend:latest` and `ghcr.io/{github.repository}/backend:{sha}`
- Auth: `secrets.GITHUB_TOKEN` (automatic in GitHub Actions)

**CI Platform:**
- GitHub Actions (`.github/workflows/ci.yml`)
  - Nx affected commands for efficient lint/test/build
  - Docker build+push on merges to `main`

**Hosting:**
- Not deployed — Docker Compose (`docker-compose.yml`) provides a local/self-hosted production configuration
- No cloud provider (Vercel, Railway, Fly.io, etc.) detected

## Environment Configuration

**Required env vars (from `.env.example`):**
- `GOOGLE_API_KEY` — Google AI Studio key, required for LLM to function
- `PORT` — backend HTTP port (default `3000`)
- `NODE_ENV` — `development` or `production`
- `CORS_ORIGIN` — allowed frontend origin (default `http://localhost:4200`)

**Secrets location:**
- Local: `.env` file (not committed — `.env.example` is the reference)
- CI: GitHub Actions secrets (`secrets.GITHUB_TOKEN` already available; `GOOGLE_API_KEY` must be added manually)
- Docker: inline environment block in `docker-compose.yml` reads from host environment (`${GOOGLE_API_KEY}`)

## Webhooks & Callbacks

**Incoming:** None detected

**Outgoing:** None detected

---

*Integration audit: 2026-05-17*
