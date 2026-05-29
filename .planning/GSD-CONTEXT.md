<!-- Loaded by GSD workflows to provide detailed technical context -->

## Technology Stack

**Languages:** TypeScript ~5.9.2, SCSS, JavaScript | **Runtime:** Node.js 24 (CI/Docker), npm
**Core:** NestJS ^11, Angular ~21, LangChain (manual agent loop — LangGraph dropped), Drizzle ORM + Postgres, Tailwind CSS
**Build:** Nx 22.7, Webpack (backend), Angular CLI (frontend), SWC compilation
**Testing:** Vitest (frontend + backend), Playwright (e2e)
**Lint:** ESLint 9.8 (flat config), Prettier 3.8, `@typescript-eslint`
**Deploy:** Docker, Docker Compose, GitHub Actions CI
**Config:** `tsconfig.base.json` — `strict: true`, `target: es2022`, `noImplicitReturns`, `noUnusedLocals`
**Env:** Backend reads `process.env['VAR_NAME']`; `.env.example` documents required vars

## Conventions

**Formatting:** `singleQuote: true`; ignored: `/dist`, `/coverage`, `/.nx/cache`, `.angular`

**Naming:** Files use `kebab-case.ts` (Angular components) or `<feature>.<role>.ts` (NestJS: `agents.controller.ts`). Classes/interfaces use PascalCase (`AppController`, `ChatRequest`). Variables/properties use camelCase (`threadId`, `getData`). Private fields: `private readonly`. Component selectors: `app-` prefix + kebab-case (e.g., `app-root`). Directives: `app` prefix + camelCase (e.g., `appMyDirective`). Tests: `<name>.spec.ts` co-located.

**TypeScript:** `strict: true`, `noImplicitReturns`, `noUnusedLocals`, `noFallthroughCasesInSwitch`, `noEmitOnError`, `isolatedModules`, `target: es2022`, `module: nodenext`, `experimentalDecorators`, `emitDecoratorMetadata` (NestJS). Angular: `strictTemplates`, `strictInjectionParameters`.

**Linting:** `@nx/enforce-module-boundaries: error`; `@typescript-eslint/no-explicit-any: error`; `no-unused-vars` (prefix intentional args with `_`); `no-console: warn` (use NestJS Logger); `@angular-eslint/prefer-standalone: error` (no NgModules); Angular/NestJS specific rules via `angular-eslint` and `typescript-eslint`.

**Angular:** Standalone components only; external `.html`/`.scss` files; `HttpClient` via `provideHttpClient()`.

**NestJS:** One module per feature; use NestJS Logger; `private readonly` DI; explicit return types; shared types in `libs/shared-types` as `@org/shared-types`.

## Architecture

| Component | Responsibility |
|-----------|-----------------|
| `AppModule` / `AppController` | Root NestJS module; health endpoint `GET /api` |
| `AgentsModule` / `AgentsController` / `DinosController` | Feature module; HTTP adapters `POST /api/agents/chat` and `GET /api/dinos` |
| `AgentsService` | Manual agent loop (no LangGraph): streams via `ChatOpenAI`, dispatches tools, and — when a `dinoId` is present — injects the dino's system prompt and gates tools to the dino's allowed set |
| Dino registry (`agents/dinos/`) | Single source of truth for the dino roster (>=4 dinos = fixed model + system prompt + tool subset); `getDino` / `toDinoSummary` resolve and project them |
| `App` (Angular) | Standalone SPA root; routing via `provideRouter`, HTTP via `provideHttpClient` |
| `DatabaseModule` | Drizzle ORM over a Postgres pool (`DATABASE_URL`); disabled gracefully when unset |
| `shared-types` | Shared `ChatRequest` / `ChatResponse` and `Dino` / `DinoSummary` contracts |

**Pattern:** NestJS standard module/controller/service layering. The agent loop is a manual, stateless-per-request loop over `ChatOpenAI` (LangGraph and its `MemorySaver` were dropped for full control of tool dispatch and streaming). No conversation history is sent today (addressed in a later phase). Persistence uses Drizzle ORM + Postgres. Shared types via `@org/shared-types`.

**Key constraints:**
- `AgentsService` is stateless per request — it builds the conversation fresh each call; no in-process conversation memory is retained.
- CORS: Hardcoded `http://localhost:4200` (override via `CORS_ORIGIN`). Production must set explicitly.
- Tools (`get_current_time`, `web_search`, `fetch_page`) are real and wired; a dino's `toolNames` is the server-side ceiling and a client `enabledTools` may only narrow further.
- Error handling: `AgentsService` catches stream errors and maps capability/quota errors to a user-facing message + OpenRouter link.
- No request validation on `AgentsController` body.

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| link-workspace-packages | Link workspace packages in monorepos. USE: (1) new packages need wiring, (2) imports from sibling package, (3) resolution errors for `@org/*`. Do NOT patch tsconfig/package.json — use workspace commands. | `.agents/skills/link-workspace-packages/SKILL.md` |
| monitor-ci | Monitor Nx Cloud CI pipeline and self-healing fixes. USE: "monitor ci", "watch ci", "track ci" — integrates with Nx Cloud self-healing. | `.agents/skills/monitor-ci/SKILL.md` |
| nx-generate | Generate code via nx generators. INVOKE when scaffolding, setup, creating apps/libs. Use BEFORE nx_docs — handles discovery internally. | `.agents/skills/nx-generate/SKILL.md` |
| nx-import | Import/merge repos into Nx workspace. USE: adopt Nx across repos, move projects to monorepo. | `.agents/skills/nx-import/SKILL.md` |
| nx-plugins | Find and add Nx plugins. USE: discover plugins, install new plugin, add framework support. | `.agents/skills/nx-plugins/SKILL.md` |
| nx-run-tasks | Run tasks in Nx workspace. USE: build, test, lint, serve, or any task. | `.agents/skills/nx-run-tasks/SKILL.md` |
| nx-workspace | Explore Nx workspaces. USE: answer workspace questions, debug nx failures, check targets before running. | `.agents/skills/nx-workspace/SKILL.md` |
