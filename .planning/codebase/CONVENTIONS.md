# Code Conventions

**Analysis Date:** 2026-05-17

## Style & Formatting

**Formatter:** Prettier ^3.8.1

**Key settings** (`/.prettierrc`):
- `singleQuote: true` — all strings use single quotes

**Ignored paths** (`/.prettierignore`):
- `/dist`, `/coverage`, `/.nx/cache`, `/.nx/workspace-data`, `.angular`

Run formatting via Nx: `npx nx run-many --target=lint --fix`

## Naming Conventions

**Files:**
- Angular components: `kebab-case.ts` (e.g., `app.ts`, `nx-welcome.ts`)
- Angular templates: same base name as component, `.html` extension (`app.html`)
- Angular styles: same base name, `.scss` extension (`app.scss`)
- NestJS: `<feature>.<role>.ts` — e.g., `agents.controller.ts`, `agents.service.ts`, `agents.module.ts`
- Test files: co-located `<name>.spec.ts` alongside source file

**Classes:**
- PascalCase: `AppController`, `AgentsService`, `App`, `NxWelcome`

**Functions/Methods:**
- camelCase: `getData`, `runAgent`, `buildGraph`, `callModel`

**Variables:**
- camelCase: `threadId`, `lastMessage`, `modelWithTools`
- Private class fields: `private readonly logger`, `private readonly model`

**Interfaces (shared types):**
- PascalCase with descriptive names: `ChatRequest`, `ChatResponse` (in `libs/shared-types/src/lib/chat.types.ts`)

**Angular selectors:**
- Components: `element` type, `app-` prefix, `kebab-case` (enforced by ESLint: `app-root`, `app-*`)
- Directives: `attribute` type, `app` prefix, `camelCase` (enforced by ESLint: `appMyDirective`)

## TypeScript Config

**Base** (`/tsconfig.base.json`) — applies to all projects:
- `strict: true` — full strict mode enabled
- `noImplicitOverride: true`
- `noImplicitReturns: true`
- `noUnusedLocals: true`
- `noFallthroughCasesInSwitch: true`
- `noEmitOnError: true`
- `isolatedModules: true`
- `target: es2022`, `lib: ["es2022"]`
- `module: nodenext`, `moduleResolution: nodenext`

**Frontend overrides** (`apps/frontend/tsconfig.json`):
- `noPropertyAccessFromIndexSignature: true`
- `experimentalDecorators: true`
- `moduleResolution: bundler`, `module: preserve`
- Angular compiler: `strictTemplates: true`, `strictInjectionParameters: true`, `strictInputAccessModifiers: true`

**Backend overrides** (`apps/backend/tsconfig.app.json`):
- `experimentalDecorators: true`, `emitDecoratorMetadata: true` (required by NestJS)
- `target: es2021`
- `types: ["node"]`

## Linting Rules

**Root config** (`/eslint.config.mjs`):
- Extends `@nx/eslint-plugin` flat configs: `flat/base`, `flat/typescript`, `flat/javascript`
- `@nx/enforce-module-boundaries: error` — cross-project imports must respect dependency graph; `enforceBuildableLibDependency: true`
- Ignored paths: `**/dist`, `**/out-tsc`, `**/test-output`

**Backend** (`apps/backend/eslint.config.mjs`):
- Extends root config + `@nx/eslint-plugin` base + typescript configs
- `@typescript-eslint/no-explicit-any: error` — `any` is banned; use proper types or `unknown`
- `@typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_' }]` — unused vars are errors; prefix intentionally-unused args with `_`
- `no-console: warn` — use `NestJS Logger` instead of `console`

**Frontend** (`apps/frontend/eslint.config.mjs`):
- Extends root config + `@nx/eslint-plugin` angular and angular-template configs
- `@angular-eslint/prefer-standalone: error` — NgModules are banned; all components must be standalone
- `@angular-eslint/component-selector: error` — enforces `app-` prefix + kebab-case element selectors
- `@angular-eslint/directive-selector: error` — enforces `app` prefix + camelCase attribute selectors
- Same `no-explicit-any`, `no-unused-vars`, `no-console` rules as backend

**Frontend E2E** (`apps/frontend-e2e/eslint.config.mjs`):
- `eslint-plugin-playwright` recommended rules + root base config

Run lint via Nx: `npx nx run-many --target=lint`

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

---

*Convention analysis: 2026-05-17*
