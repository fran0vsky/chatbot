# Technology Stack

**Analysis Date:** 2026-05-17

## Languages

**Primary:**
- TypeScript ~5.9.2 — All source code across backend, frontend, and libs
- SCSS — Frontend component styling and global styles (`apps/frontend/src/styles.scss`)

**Secondary:**
- JavaScript — Webpack config (`apps/backend/webpack.config.js`), ESLint config (`eslint.config.mjs`)

## Runtime

**Environment:**
- Node.js 24 (pinned in CI via `actions/setup-node@v4` and Docker `FROM node:24-alpine`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present, committed)

## Frameworks

**Backend:**
- NestJS ^11.0.0 — HTTP server, dependency injection, module system (`apps/backend/src/app/`)
  - `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`
  - Express as underlying HTTP adapter via `@nestjs/platform-express`

**Frontend:**
- Angular ~21.2.0 — SPA framework (`apps/frontend/src/`)
  - Standalone components (no NgModules in app layer)
  - `@angular/router` for routing
  - `@angular/common/http` (`HttpClient`) for API calls
  - `@angular/forms` available

**AI / Agent:**
- LangChain ^1.4.0 — Agent orchestration framework
- `@langchain/langgraph` ^1.3.0 — Stateful agent graph with `StateGraph`, `MemorySaver`
- `@langchain/google-genai` ^2.1.30 — Google Gemini model integration (`ChatGoogleGenerativeAI`)
- `@langchain/core` ^1.1.46 — Messages, tools, base abstractions
- `@langchain/anthropic` ^1.3.29 — Anthropic Claude integration (available, not yet wired)
- `@langchain/community` ^1.1.28 — Community integrations

**Styling:**
- Tailwind CSS ^3.0.2 — Utility-first CSS
- PostCSS ^8.4.5, Autoprefixer ^10.4.0 — CSS build pipeline

## Build & Tooling

**Monorepo:**
- Nx 22.7.0 / 22.7.2 — Task orchestration, project graph, affected commands
  - Nx Cloud enabled (`nxCloudId` set in `nx.json`)
  - Plugins: `@nx/js`, `@nx/webpack`, `@nx/playwright`, `@nx/eslint`, `@nx/angular`, `@nx/nest`, `@nx/node`

**Backend Build:**
- Webpack via `@nx/webpack` + `NxAppWebpackPlugin` — bundles NestJS for Node.js target (`apps/backend/webpack.config.js`)
- Compiler: `tsc` (via webpack plugin)
- Output: `apps/backend/dist/`

**Frontend Build:**
- `@angular/build:application` (Angular CLI v21 Vite-based builder)
- Output: `dist/apps/frontend/browser/`

**Transpilation (tests/dev):**
- SWC (`@swc/core` 1.15.8, `@swc-node/register`) — fast TypeScript compilation for Jest
- OXC runtime (`@oxc-project/runtime` ^0.115.0) — experimental fast JS tooling

**Testing:**
- Vitest ^4.0.8 — unit tests for frontend (`@angular/build:unit-test` executor, `vitest-angular` runner)
- Jest + `@swc/jest` — backend e2e (`apps/backend-e2e/jest.config.cts`)
- Playwright ^1.36.0 / `@nx/playwright` — frontend e2e (`apps/frontend-e2e/playwright.config.ts`)
  - Configured for Chromium, Firefox, WebKit

**Linting:**
- ESLint ^9.8.0 (flat config, `eslint.config.mjs`)
- `@nx/eslint-plugin` — module boundary enforcement
- `angular-eslint` ^21.2.0 — Angular-specific rules
- `typescript-eslint` ^8.40.0
- `eslint-config-prettier` ^10.0.0 — disables format-conflicting rules
- `eslint-plugin-playwright` — Playwright test rules

**Formatting:**
- Prettier ^3.8.1

**TypeScript Config:**
- Root: `tsconfig.base.json` — `strict: true`, `target: es2022`, `module: nodenext`, `noImplicitReturns`, `noUnusedLocals`
- Per-project `tsconfig.json` files in each app and lib

## Infrastructure

**Containerization:**
- Docker — backend only; multi-stage build (`apps/backend/Dockerfile`)
  - Builder: `node:24-alpine`, runner: `node:24-alpine`
  - Exposes port 3000
- Docker Compose (`docker-compose.yml`) — single `backend` service, port 3000

**CI/CD:**
- GitHub Actions (`.github/workflows/ci.yml`)
  - Triggers: push/PR to `main` and `develop`
  - Jobs: lint-test-build (affected), docker-build (main branch only)
  - Registry: GitHub Container Registry (ghcr.io)
  - Docker image tags: `latest` + git SHA

## Configuration

**Environment:**
- `.env.example` documents required vars:
  - `GOOGLE_API_KEY` — Google AI Studio key (required for LLM)
  - `PORT` — server port (default 3000)
  - `NODE_ENV` — runtime environment
  - `CORS_ORIGIN` — allowed CORS origin (default `http://localhost:4200`)
- Backend reads env vars via `process.env['VAR_NAME']` (bracket notation, per convention)

**Module Path Aliases:**
- `@org/shared-types` — resolves to `libs/shared-types/src/index.ts` via workspace package `exports`
- Custom condition `@org/source` in `tsconfig.base.json`

---

*Stack analysis: 2026-05-17*
