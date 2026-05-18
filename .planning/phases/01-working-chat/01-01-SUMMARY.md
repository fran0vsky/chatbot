---
phase: 01-working-chat
plan: 01
status: complete
completed: 2026-05-18
requirements: [BACK-01, BACK-02, BACK-03, BACK-04, BACK-05]
---

# Plan 01-01 Summary — Backend on OpenRouter

## What shipped

- `apps/backend/src/app/agents/agents.service.ts` rewritten: `ChatOpenAI` against OpenRouter, simplified graph (`START → agent → END`), `MemorySaver` retained for per-thread memory.
- `apps/backend/package.json` declares `@langchain/openai ^1.4.0` explicitly.
- `.env.example` documents `OPENROUTER_API_KEY` (Gemini removed).
- `docker-compose.yml` forwards `OPENROUTER_API_KEY` to the backend service.
- `apps/backend/Dockerfile` copies `libs/` in both builder and runner stages so `@org/shared-types` resolves at install time.

## ChatOpenAI configuration

```ts
new ChatOpenAI({
  apiKey: process.env['OPENROUTER_API_KEY'],
  modelName: 'openai/gpt-4o-mini',
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
})
```

## Graph shape

`START → agent → END` (no tool node, no conditional edges, no `bindTools`). The unsafe `ToolMessage` cast and the placeholder `searchTool` are gone.

## Dockerfile fix

Both stages now have `libs/` available:

- Builder: `COPY libs/ libs/` immediately before `RUN npx nx build backend --prod`
- Runner: `COPY --from=builder /app/libs ./libs` before `RUN npm ci --omit=dev --legacy-peer-deps`

## Install notes

- Requested `^1.10.0` was not on npm (latest published 1.x is `1.4.5`); pinned to `^1.4.0` after `npm view @langchain/openai versions`.
- `npm install --legacy-peer-deps` was needed (matches existing Dockerfile flag). 18 pre-existing vulnerabilities reported, unrelated to this install.

## Static gates

- `npx nx build backend` → exit 0
- `npx nx lint backend` → exit 0

## Smoke test

Not run from this session (no `OPENROUTER_API_KEY` exported locally). The plan's curl/PowerShell smoke commands are documented in `.planning/phases/01-working-chat/01-01-PLAN.md` `<verification>` and can be executed before merging.
