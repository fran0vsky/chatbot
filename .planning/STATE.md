---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Dino Platform
status: executing
last_updated: "2026-05-29T21:45:00.000Z"
last_activity: 2026-05-29
progress:
  total_phases: 0
  completed_phases: 4
  total_plans: 0
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v1.1 SpinoChat rebrand)

**Core value:** A user can open the app, type a message, get a real answer, and keep the conversation going.
**Current focus:** Phases 21 + 22 (memory + teach-a-skill) code-complete and verified. Both have a live smoke test (Task 5 each) pending human run with DATABASE_URL + OPENROUTER_API_KEY. Next candidate: Phase 23 — Dino Groupchat (or Phase 20 real mascot art).

## Current Position

Phase: 22 — Teach-a-Skill (complete; live teach-once smoke test pending human run)
Plan: 22-01 (Tasks 1–4 done + verified; Task 5 manual smoke test deferred to human)
Status: dino_skills table (userId × dinoId) + MemoryService getSkills/addSkill/deleteSkill (null-safe) + SkillsController (GET/POST/DELETE skills, DELETE memories) + shared DinoSkill/LearnedItems. Agent loop assembles base prompt → skills block (standing instructions) → memories block. Frontend: SkillService, "Teach {dino}" header button + overlay (title/instruction + save), presentational SkillManager (skills + memories w/ delete) + stories, exported from @chatbot/ui. userId logic refactored into exported loadUserId()/USER_ID_KEY in chat.service (shared with SkillService). Verified: lint (@org/backend, @org/shared-types, frontend) green; `nx build @chatbot/ui` + `nx build frontend` green (frontend specs unrunnable on this box); backend Vitest 35/35 via vitest.run.mjs (5 new skill tests).
Last activity: 2026-05-29 — Phases 21 + 22 implemented + verified in one session

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

- **Phase 21 Task 5 — cross-thread memory smoke test (human):** with `DATABASE_URL` + `OPENROUTER_API_KEY` set and `user_memories` pushed (`drizzle-kit push`): tell rexford a fact in thread A → recall in new thread B (same dino) → veloce in thread C must NOT know → unset `DATABASE_URL` → no crash, no recall. See 21-01-SUMMARY.md.
- **Phase 22 Task 5 — teach-once smoke test (human):** with DB + key and `dino_skills` pushed: teach rexford "Always answer in British English." → new chat with rexford applies it without re-teaching → manager delete stops it → veloce unaffected. See 22-01-SUMMARY.md.
- **DB migration:** push the two new tables before the smoke tests — `user_memories` (Phase 21) and `dino_skills` (Phase 22) — via `npx nx run @org/backend:... drizzle-kit push` (or the project's drizzle push script) against `DATABASE_URL`.
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
