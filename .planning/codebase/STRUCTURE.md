# Project Structure

This is an Nx monorepo named `@org/source`. It contains an Angular frontend, a NestJS backend, shared TypeScript libraries, and end-to-end test projects.

## Root Layout

```
Chatbot/
├── apps/
│   ├── backend/          # NestJS API server
│   ├── backend-e2e/      # Backend end-to-end tests (Jest)
│   ├── frontend/         # Angular SPA
│   └── frontend-e2e/     # Frontend end-to-end tests (Playwright)
├── libs/
│   └── shared-types/     # Shared TypeScript interfaces used by both apps
├── packages/             # Reserved for future workspace packages (empty)
├── tasks/                # Informal task/spec documents
├── docker-compose.yml    # Runs the backend in Docker
├── nx.json               # Nx workspace configuration
├── package.json          # Root package manifest (npm workspaces)
├── tsconfig.base.json    # Base TypeScript config
└── eslint.config.mjs     # Root ESLint config
```

---

## `apps/backend` — NestJS API

Entry point: `src/main.ts`
- Bootstraps NestJS, sets global prefix `api`, enables CORS (default origin `http://localhost:4200`), listens on `PORT` (default `3000`).

```
src/
├── main.ts
└── app/
    ├── app.module.ts          # Root module — imports AgentsModule
    ├── app.controller.ts      # Root controller
    ├── app.service.ts         # Root service
    └── agents/
        ├── agents.module.ts   # Feature module for AI agents
        ├── agents.controller.ts  # POST /api/agents/chat
        └── agents.service.ts     # LangGraph agent with Gemini + search tool
```

Key runtime dependencies:
- `@nestjs/*` v11 — framework
- `@langchain/langgraph` — agent state-graph execution
- `@langchain/google-genai` — Gemini 2.0 Flash Lite model
- `@langchain/core` — messages, tools, base primitives
- `langchain` — top-level LangChain package

Environment variables required:
- `GOOGLE_API_KEY` — Gemini API key
- `PORT` — HTTP port (default `3000`)
- `CORS_ORIGIN` — allowed CORS origin (default `http://localhost:4200`)

The `AgentsService` builds a LangGraph `StateGraph` with:
1. An `agent` node that calls Gemini with bound tools
2. A `tools` node that executes tool calls (currently a placeholder `search` tool)
3. Conditional routing: if the model returns tool calls → `tools`, otherwise → `END`
4. `MemorySaver` checkpointer for per-thread conversation memory

---

## `apps/frontend` — Angular SPA

Entry point: `src/main.ts` → bootstraps `App` component with `appConfig`.

```
src/
├── index.html
├── main.ts
├── styles.scss
└── app/
    ├── app.config.ts    # Providers: router, HttpClient, error listeners
    ├── app.routes.ts    # Route definitions (currently empty)
    ├── app.ts           # Root component (standalone, imports NxWelcome + RouterModule)
    ├── app.html
    ├── app.scss
    ├── app.spec.ts
    └── nx-welcome.ts    # Default Nx welcome component (placeholder)
```

Key runtime dependencies:
- `@angular/*` v21 — framework
- `rxjs` v7
- `tailwindcss` v3 — utility-first CSS (configured in `tailwind.config.js`)

Rules enforced by `apps/frontend/CLAUDE.md`:
- Standalone components only (no NgModules)
- `OnPush` change detection on all components
- All HTTP calls via dedicated Angular services, never directly from components
- Tailwind for all styling; no inline styles

---

## `libs/shared-types` — Shared TypeScript Library

Import path: `@org/shared-types`

```
src/
├── index.ts                  # Public API barrel
└── lib/
    ├── chat.types.ts         # ChatRequest, ChatResponse interfaces
    └── shared-types.ts       # (placeholder)
```

Interfaces:
```ts
interface ChatRequest  { message: string; threadId?: string; }
interface ChatResponse { response: string; }
```

Both `apps/backend` (controller) and future frontend services must import from here — types must never be redefined in individual apps.

---

## `apps/backend-e2e` — Backend E2E Tests

Framework: Jest + SWC
Location of specs: `src/backend/backend.spec.ts`
Support files: global setup/teardown and test-setup in `src/support/`.

## `apps/frontend-e2e` — Frontend E2E Tests

Framework: Playwright
Config: `playwright.config.ts`
Spec: `src/example.spec.ts`

---

## Nx Workspace Configuration (`nx.json`)

Active plugins:
| Plugin | Key target names |
|---|---|
| `@nx/js/typescript` | `build`, `typecheck` |
| `@nx/webpack/plugin` | `build`, `serve`, `preview` |
| `@nx/playwright/plugin` | `e2e` |
| `@nx/eslint/plugin` | `lint` |

Default generators use Playwright for e2e, ESLint for linting, SCSS for styles, and `vitest-angular` for unit tests when generating Angular applications.

---

## Docker

`docker-compose.yml` runs only the backend:
- Builds from `apps/backend/Dockerfile`
- Exposes port `3000`
- Passes `GOOGLE_API_KEY` from host environment

The frontend is served separately (e.g. `pnpm nx serve frontend` in dev, or a separate static host in production).

---

## Common Nx Commands

```bash
# Serve backend in dev
pnpm nx serve backend

# Serve frontend in dev
pnpm nx serve frontend

# Run all unit tests
pnpm nx run-many -t test

# Run affected tests only
pnpm nx affected -t test

# Lint everything
pnpm nx run-many -t lint

# Build backend
pnpm nx build backend

# Run frontend e2e
pnpm nx e2e frontend-e2e
```
