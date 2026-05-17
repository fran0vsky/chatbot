<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Chatbot**

A general-purpose text chatbot built as an Nx monorepo with an Angular frontend and NestJS backend. Users can ask the model anything and continue the conversation across multiple turns in the same session. The backend uses LangGraph to orchestrate LLM calls via OpenRouter.

**Core Value:** A user can open the app, type a message, get a real answer, and keep the conversation going — everything else is secondary.

### Constraints

- **Tech stack:** Angular + NestJS + LangGraph — locked, no framework changes
- **LLM provider:** OpenRouter (replaces Gemini) — user specified
- **Conversation scope:** Per-session only — MemorySaver stays, no database needed for Task 1
- **Styling:** Tailwind CSS only — no inline styles, per project conventions
- **Components:** Angular standalone components with OnPush change detection — per project conventions
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.9.2 — All source code across backend, frontend, and libs
- SCSS — Frontend component styling and global styles (`apps/frontend/src/styles.scss`)
- JavaScript — Webpack config (`apps/backend/webpack.config.js`), ESLint config (`eslint.config.mjs`)
## Runtime
- Node.js 24 (pinned in CI via `actions/setup-node@v4` and Docker `FROM node:24-alpine`)
- npm
- Lockfile: `package-lock.json` (present, committed)
## Frameworks
- NestJS ^11.0.0 — HTTP server, dependency injection, module system (`apps/backend/src/app/`)
- Angular ~21.2.0 — SPA framework (`apps/frontend/src/`)
- LangChain ^1.4.0 — Agent orchestration framework
- `@langchain/langgraph` ^1.3.0 — Stateful agent graph with `StateGraph`, `MemorySaver`
- `@langchain/google-genai` ^2.1.30 — Google Gemini model integration (`ChatGoogleGenerativeAI`)
- `@langchain/core` ^1.1.46 — Messages, tools, base abstractions
- `@langchain/anthropic` ^1.3.29 — Anthropic Claude integration (available, not yet wired)
- `@langchain/community` ^1.1.28 — Community integrations
- Tailwind CSS ^3.0.2 — Utility-first CSS
- PostCSS ^8.4.5, Autoprefixer ^10.4.0 — CSS build pipeline
## Build & Tooling
- Nx 22.7.0 / 22.7.2 — Task orchestration, project graph, affected commands
- Webpack via `@nx/webpack` + `NxAppWebpackPlugin` — bundles NestJS for Node.js target (`apps/backend/webpack.config.js`)
- Compiler: `tsc` (via webpack plugin)
- Output: `apps/backend/dist/`
- `@angular/build:application` (Angular CLI v21 Vite-based builder)
- Output: `dist/apps/frontend/browser/`
- SWC (`@swc/core` 1.15.8, `@swc-node/register`) — fast TypeScript compilation for Jest
- OXC runtime (`@oxc-project/runtime` ^0.115.0) — experimental fast JS tooling
- Vitest ^4.0.8 — unit tests for frontend (`@angular/build:unit-test` executor, `vitest-angular` runner)
- Jest + `@swc/jest` — backend e2e (`apps/backend-e2e/jest.config.cts`)
- Playwright ^1.36.0 / `@nx/playwright` — frontend e2e (`apps/frontend-e2e/playwright.config.ts`)
- ESLint ^9.8.0 (flat config, `eslint.config.mjs`)
- `@nx/eslint-plugin` — module boundary enforcement
- `angular-eslint` ^21.2.0 — Angular-specific rules
- `typescript-eslint` ^8.40.0
- `eslint-config-prettier` ^10.0.0 — disables format-conflicting rules
- `eslint-plugin-playwright` — Playwright test rules
- Prettier ^3.8.1
- Root: `tsconfig.base.json` — `strict: true`, `target: es2022`, `module: nodenext`, `noImplicitReturns`, `noUnusedLocals`
- Per-project `tsconfig.json` files in each app and lib
## Infrastructure
- Docker — backend only; multi-stage build (`apps/backend/Dockerfile`)
- Docker Compose (`docker-compose.yml`) — single `backend` service, port 3000
- GitHub Actions (`.github/workflows/ci.yml`)
## Configuration
- `.env.example` documents required vars:
- Backend reads env vars via `process.env['VAR_NAME']` (bracket notation, per convention)
- `@org/shared-types` — resolves to `libs/shared-types/src/index.ts` via workspace package `exports`
- Custom condition `@org/source` in `tsconfig.base.json`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Style & Formatting
- `singleQuote: true` — all strings use single quotes
- `/dist`, `/coverage`, `/.nx/cache`, `/.nx/workspace-data`, `.angular`
## Naming Conventions
- Angular components: `kebab-case.ts` (e.g., `app.ts`, `nx-welcome.ts`)
- Angular templates: same base name as component, `.html` extension (`app.html`)
- Angular styles: same base name, `.scss` extension (`app.scss`)
- NestJS: `<feature>.<role>.ts` — e.g., `agents.controller.ts`, `agents.service.ts`, `agents.module.ts`
- Test files: co-located `<name>.spec.ts` alongside source file
- PascalCase: `AppController`, `AgentsService`, `App`, `NxWelcome`
- camelCase: `getData`, `runAgent`, `buildGraph`, `callModel`
- camelCase: `threadId`, `lastMessage`, `modelWithTools`
- Private class fields: `private readonly logger`, `private readonly model`
- PascalCase with descriptive names: `ChatRequest`, `ChatResponse` (in `libs/shared-types/src/lib/chat.types.ts`)
- Components: `element` type, `app-` prefix, `kebab-case` (enforced by ESLint: `app-root`, `app-*`)
- Directives: `attribute` type, `app` prefix, `camelCase` (enforced by ESLint: `appMyDirective`)
## TypeScript Config
- `strict: true` — full strict mode enabled
- `noImplicitOverride: true`
- `noImplicitReturns: true`
- `noUnusedLocals: true`
- `noFallthroughCasesInSwitch: true`
- `noEmitOnError: true`
- `isolatedModules: true`
- `target: es2022`, `lib: ["es2022"]`
- `module: nodenext`, `moduleResolution: nodenext`
- `noPropertyAccessFromIndexSignature: true`
- `experimentalDecorators: true`
- `moduleResolution: bundler`, `module: preserve`
- Angular compiler: `strictTemplates: true`, `strictInjectionParameters: true`, `strictInputAccessModifiers: true`
- `experimentalDecorators: true`, `emitDecoratorMetadata: true` (required by NestJS)
- `target: es2021`
- `types: ["node"]`
## Linting Rules
- Extends `@nx/eslint-plugin` flat configs: `flat/base`, `flat/typescript`, `flat/javascript`
- `@nx/enforce-module-boundaries: error` — cross-project imports must respect dependency graph; `enforceBuildableLibDependency: true`
- Ignored paths: `**/dist`, `**/out-tsc`, `**/test-output`
- Extends root config + `@nx/eslint-plugin` base + typescript configs
- `@typescript-eslint/no-explicit-any: error` — `any` is banned; use proper types or `unknown`
- `@typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_' }]` — unused vars are errors; prefix intentionally-unused args with `_`
- `no-console: warn` — use `NestJS Logger` instead of `console`
- Extends root config + `@nx/eslint-plugin` angular and angular-template configs
- `@angular-eslint/prefer-standalone: error` — NgModules are banned; all components must be standalone
- `@angular-eslint/component-selector: error` — enforces `app-` prefix + kebab-case element selectors
- `@angular-eslint/directive-selector: error` — enforces `app` prefix + camelCase attribute selectors
- Same `no-explicit-any`, `no-unused-vars`, `no-console` rules as backend
- `eslint-plugin-playwright` recommended rules + root base config
## Angular Conventions
- **Standalone-only** — `@angular-eslint/prefer-standalone: error` bans NgModules. All components use the `imports: [...]` array directly.
- **Selector prefix** — all components/directives use `app-` prefix (configured in `apps/frontend/project.json` as `"prefix": "app"`)
- **Inline styles language** — SCSS (`inlineStyleLanguage: "scss"` in build config)
- **Template files** — external `.html` files, not inline templates (see `app.html` / `templateUrl`)
- **Style files** — external `.scss` files (see `app.scss` / `styleUrl`)
- **HTTP** — `HttpClient` provided via `provideHttpClient()` in `app.config.ts`
## NestJS Conventions
- **Module structure** — one module per feature (`agents.module.ts`), imported into root `app.module.ts`
- **Logging** — use `NestJS Logger` (`private readonly logger = new Logger(AgentsService.name)`), never `console.*`
- **Dependency injection** — `private readonly` constructor parameters; avoid field injection
- **Return types** — controllers and services use explicit TypeScript return types (e.g., `Promise<ChatResponse>`, `{ message: string }`)
- **Decorator imports** — import from `@nestjs/common`: `Controller`, `Get`, `Post`, `Body`, `Injectable`, `Logger`
- **Shared types** — cross-app interfaces live in `libs/shared-types`; import as `@org/shared-types`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- NestJS uses standard module/controller/service layering; `AgentsModule` is the only domain module.
- LangGraph `StateGraph` is compiled once in `AgentsService` constructor and reused across requests.
- Thread-scoped conversation memory is held in-process via `MemorySaver` (not persistent across restarts).
- Shared types cross the wire boundary via the `@org/shared-types` lib imported by both backend and (prospectively) frontend.
- Angular is standalone-component-based (no NgModules); routing via `provideRouter`, HTTP via `provideHttpClient`.
## Layers
- Purpose: Browser UI; sends chat messages to backend, displays responses.
- Location: `apps/frontend/src/`
- Contains: One root `App` component, `app.config.ts` (providers), `app.routes.ts` (router config), global SCSS.
- Depends on: `@angular/router`, `@angular/common/http`, `@org/shared-types` (type contracts).
- Used by: End user via browser.
- Purpose: HTTP server exposing REST endpoints; orchestrates AI agents.
- Location: `apps/backend/src/`
- Contains: `AppModule` → `AgentsModule` (controller + service), `AppController`, `AppService`.
- Depends on: `@nestjs/*`, `@langchain/langgraph`, `@langchain/google-genai`, `@org/shared-types`.
- Used by: Angular frontend (HTTP).
- Purpose: Multi-step LLM reasoning with tool invocation.
- Location: `apps/backend/src/app/agents/agents.service.ts`
- Contains: `AgentState` annotation, `searchTool`, `callModel`, `shouldContinue`, `callTools` node functions, compiled `StateGraph`.
- Depends on: `@langchain/langgraph`, `@langchain/core`, `@langchain/google-genai`, `zod`.
- Used by: `AgentsController`.
- Purpose: Single source of truth for API contract types.
- Location: `libs/shared-types/src/`
- Contains: `ChatRequest`, `ChatResponse` interfaces.
- Depends on: Nothing.
- Used by: `AgentsController` (backend), future frontend services.
## Data Flow
### Chat Request Path
### Health Check Path
- Agent conversation state is persisted per `thread_id` in `MemorySaver` (in-memory, singleton within the NestJS process).
- No database or external state store. Memory is lost on process restart.
- Angular frontend has no client-side state management library (no NgRx/Signals store configured yet).
## Key Abstractions
- Purpose: Typed state container for the graph; `messages` array with append reducer.
- Examples: `apps/backend/src/app/agents/agents.service.ts:9`
- Pattern: `Annotation.Root` with `reducer: (x, y) => x.concat(y)` — messages accumulate across turns.
- Purpose: Typed API contract shared between front and back.
- Examples: `libs/shared-types/src/lib/chat.types.ts`
- Pattern: Plain interfaces exported from `@org/shared-types`; imported in controller via workspace path alias.
- Purpose: Placeholder web-search capability registered with the LLM via `model.bindTools([searchTool])`.
- Examples: `apps/backend/src/app/agents/agents.service.ts:15`
- Pattern: `tool(fn, { name, description, schema })` from `@langchain/core/tools` + Zod schema.
## Entry Points
- Location: `apps/backend/src/main.ts`
- Triggers: `node dist/main.js` / `pnpm nx serve backend`
- Responsibilities: Creates NestJS app, enables CORS for `http://localhost:4200`, sets global prefix `api`, listens on `PORT` (default 3000).
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
### Placeholder search tool
## Error Handling
- `AgentsService.runAgent()` does not catch LangGraph or LLM errors — unhandled rejections bubble to NestJS default handler.
- No request validation (e.g., `class-validator` / `ValidationPipe`) on `AgentsController` body.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| link-workspace-packages | 'Link workspace packages in monorepos (npm, yarn, pnpm, bun). USE WHEN: (1) you just created or generated new packages and need to wire up their dependencies, (2) user imports from a sibling package and needs to add it as a dependency, (3) you get resolution errors for workspace packages (@org/*) like "cannot find module", "failed to resolve import", "TS2307", or "cannot resolve". DO NOT patch around with tsconfig paths or manual package.json edits - use the package manager''s workspace commands to fix actual linking.' | `.agents/skills/link-workspace-packages/SKILL.md` |
| monitor-ci | Monitor Nx Cloud CI pipeline and handle self-healing fixes. USE WHEN user says "monitor ci", "watch ci", "ci monitor", "watch ci for this branch", "track ci", "check ci status", wants to track CI status, or needs help with self-healing CI fixes. Prefer this skill over native CI provider tools (gh, glab, etc.) for CI monitoring — it integrates with Nx Cloud self-healing which those tools cannot access. | `.agents/skills/monitor-ci/SKILL.md` |
| nx-generate | Generate code using nx generators. INVOKE IMMEDIATELY when user mentions scaffolding, setup, structure, creating apps/libs, or setting up project structure. Trigger words - scaffold, setup, create a ... app, create a ... lib, project structure, generate, add a new project. ALWAYS use this BEFORE calling nx_docs or exploring - this skill handles discovery internally. | `.agents/skills/nx-generate/SKILL.md` |
| nx-import | Import, merge, or combine repositories into an Nx workspace using nx import. USE WHEN the user asks to adopt Nx across repos, move projects into a monorepo, or bring code/history from another repository. | `.agents/skills/nx-import/SKILL.md` |
| nx-plugins | Find and add Nx plugins. USE WHEN user wants to discover available plugins, install a new plugin, or add support for a specific framework or technology to the workspace. | `.agents/skills/nx-plugins/SKILL.md` |
| nx-run-tasks | Helps with running tasks in an Nx workspace. USE WHEN the user wants to execute build, test, lint, serve, or run any other tasks defined in the workspace. | `.agents/skills/nx-run-tasks/SKILL.md` |
| nx-workspace | "Explore and understand Nx workspaces. USE WHEN answering questions about the workspace, projects, or tasks. ALSO USE WHEN an nx command fails or you need to check available targets/configuration before running a task. EXAMPLES: 'What projects are in this workspace?', 'How is project X configured?', 'What depends on library Y?', 'What targets can I run?', 'Cannot find configuration for task', 'debug nx task failure'." | `.agents/skills/nx-workspace/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
