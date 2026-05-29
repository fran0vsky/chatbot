---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Dino Platform
status: executing
last_updated: "2026-05-29T13:30:00.000Z"
last_activity: 2026-05-29
progress:
  total_phases: 0
  completed_phases: 2
  total_plans: 0
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v1.1 SpinoChat rebrand)

**Core value:** A user can open the app, type a message, get a real answer, and keep the conversation going.
**Current focus:** Phase 20 — dino mascots: pipeline + Mascot wiring code-complete; per-dino art (Task 1) and visual QA (Task 5) are pending human steps before the phase can be verified complete

## Current Position

Phase: 20 — Dino Mascots
Plan: 20-01 (code-complete, HUMAN-NEEDED — art + QA pending)
Status: Tasks 2–4 done (split/optimize scripts generalized to N dinos; Mascot renders per-dino pixel-art by dinoId+theme with Spino SVG fallback; wired into DinoCard + chat header). PLACEHOLDER mascots generated via scripts/gen-placeholder-mascots.js + pipeline, so per-dino mascots now render (distinct by hue) in Explore + chat. Real pixel-art (distinct species) DEFERRED to todo 2026-05-29-replace-placeholder-dino-mascots. Phase functionally working but NOT fully verified (MASC-06/07 need real art). `nx lint frontend` green; `nx lint ui` has 10 PRE-EXISTING errors (input-composer/message-bubble/tool-call-bubble), none in touched files.
Last activity: 2026-05-29 — Phase 20 code + placeholder art shipped inline; real art tracked as a pending todo

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Working Chat | 3 | — | — |
| 2. Choose Your Model | 2 | — | — |
| 12 | 3 | - | - |

## Accumulated Context

### Roadmap Evolution

- Phase 3 added: UI/UX Refinement Phase
- Phase 4 added: Dark Theme and Visual Polish
- Phase 8 added: Chat History Sidebar
- Phase 9 added: Tool Calling (Function Calling) — LangGraph tool node + UI for tool calls; starter tools `get_current_time` and `web_search`
- Phase 10 added: Token Streaming (SSE, word-by-word render)
- Phase 11 added: Reasoning / Thinking Display

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: OpenRouter replaces Gemini; @langchain/openai with configuration.baseURL
- Init: GPT-4o mini as default model (`openai/gpt-4o-mini` namespaced ID required)
- Init: MemorySaver kept for per-session memory; no database needed
- Phase 2: Per-request model selection via Map<modelId, CompiledGraph> — one MemorySaver shared across all graphs preserves thread history across model switches (D-09, D-10)
- Phase 2: Unknown model IDs fall back silently to gpt-4o-mini (D-11)
- Phase 2: Frontend uses plain class properties (not signals) — OnPush + ChangeDetectorRef pattern, consistent with existing isLoading field

### Pending Todos

- **Commit all changes (Phases 1–4)** — run `pnpm nx build frontend` first to verify, then commit with message: `feat(phase-4): desert theme — day/night toggle, snake mascot, bubble restyling, cactus scrollbar`
- Human one-time setup (Plan 03 Task 2): GCP project + APIs, Artifact Registry repo, Secret Manager `openrouter-api-key`, Cloud Run service `chatbot-backend`, Workload Identity Federation, Firebase project + Hosting, 8 GitHub Actions variables + 2 secrets. Full checklist in `README.md` `## Deployment`.
- Local smoke test of the full stack: `npx nx serve backend` + `npx nx serve frontend` with `OPENROUTER_API_KEY` in `.env`; verify model selector routes to both models.
- Local Playwright E2E dry-run (`npx nx e2e frontend-e2e` with `OPENROUTER_API_KEY` exported).

### Blockers/Concerns

- ~~`npx nx build` fails on this dev machine: Nx 22.7.0 + Node 24.12.0 `ERR_UNSUPPORTED_ESM_URL_SCHEME`~~ **RESOLVED (Phase 18):** root cause was Nx doing `import()` on a raw lowercase-drive Windows path. Fixed via `patches/nx+22.7.0.patch` (patch-package + `postinstall`). Nx, lint, test, and build now run locally. Backend `typecheck` target still has 2 pre-existing errors (NestJS decorator `import type` quirk + LangChain `tool.invoke` typing) — unrelated, not part of the lint/test gate.
- Node: default `node` is now 20.18.1 (via nvm, set during Phase 18 diagnosis). The Nx patch also fixes Node 24, so either works.
- Backend Vitest workers need an uppercase-drive cwd under Nx; handled by `apps/backend/vitest.run.mjs`.
- `@langchain/openai ^1.10.0` was not on npm; pinned to `^1.4.0` (latest published 1.x is 1.4.5).
- Docker not installed on the dev machine — Dockerfile changes are CI-only.
- `apps/frontend/src/main.ts` has a pre-existing `console.error(err)` lint warning (1 warning, 0 errors).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260525-l8i | Soft Studio + Capybara redesign (palette + mascot + token rename) | 2026-05-25 | pending | [260525-l8i-redesign-soft-studio-capybara](./quick/260525-l8i-redesign-soft-studio-capybara/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Persistent history across sessions | Deferred | Init |
| v2 | Markdown rendering in assistant messages | Deferred | Init |
| v2 | Real web search tool | Deferred | Init |

## Session Continuity

Last session: 2026-05-25T14:55:12.158Z
Stopped at: Phase 13 context gathered
Resume file: .planning/phases/13-jungle-atmosphere/13-CONTEXT.md
