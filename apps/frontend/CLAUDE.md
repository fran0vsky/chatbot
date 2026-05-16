# Angular Frontend Rules

## Components
- Always use standalone components — never NgModules
- One component per file
- Keep components thin — logic goes in services, not templates or components
- Use `OnPush` change detection for all components

## Naming
- Components: `kebab-case` selector with `app-` prefix (e.g. `app-chat-window`)
- Files: `feature-name.component.ts`, `feature-name.service.ts`
- Interfaces and types: PascalCase (e.g. `ChatMessage`)

## HTTP & Services
- All HTTP calls go through a dedicated Angular service — never call `HttpClient` directly from a component
- Import types from `@org/shared-types` — never redefine shapes that already exist there

## TypeScript
- No `any` — use proper types or `unknown`
- No unused variables
- No `console.log` — avoid logging in frontend code

## Tailwind
- Use Tailwind utility classes for all styling
- No inline styles
- No external CSS frameworks alongside Tailwind
