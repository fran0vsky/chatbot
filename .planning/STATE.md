---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Dino Platform
status: completed
stopped_at: Phase 28 context gathered
last_updated: "2026-05-31T21:34:03.828Z"
last_activity: 2026-05-30 -- Phase 27 Plan 01 Tasks 1–6 executed
progress:
  total_phases: 11
  completed_phases: 9
  total_plans: 31
  completed_plans: 32
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v1.1 SpinoChat rebrand)

**Core value:** A user can open the app, type a message, get a real answer, and keep the conversation going.
**Current focus:** Phase 27 — ngrx-state-refactor

## Current Position

Phase: 27 (ngrx-state-refactor) — EXECUTING
Plan: 1 of 1
Status: Plan 27-01 Tasks 1–6 done (NgRx store + slices + ChatComponent refactor + action catalogue); Task 7 manual regression sweep pending
Last activity: 2026-05-30 -- Phase 27 Plan 01 Tasks 1–6 executed

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Working Chat | 3 | — | — |
| 2. Choose Your Model | 2 | — | — |
| 12 | 3 | - | - |
| 24 | 1 | - | - |

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
- Phase 23: Groupchat v1 is single-turn per send; multi-turn group history deferred
- Phase 23: Cap of 4 dinos enforced client-side in GroupchatService.MAX_DINOS (DoS mitigation T-23-01)
- Phase 23: Groupchat reuses existing ChatService.streamMessage with per-dino AbortControllers (no backend change needed)
- Phase 24: Elo K_FACTOR=24 (moderate volatility for small roster); skip/tie treated as draw (Sa=Sb=0.5)
- Phase 24: Arena phase state machine (idle/streaming/voted) drives blind identity reveal
- Phase 24: ui lib @nx/enforce-module-boundaries errors are pre-existing workspace config issues affecting all ui components — not introduced by this plan
- Phase 27: Classic @ngrx/store + effects (not SignalStore) — Phase 29 voice assistant needs a named, enumerable action surface (NGX-02)
- Phase 27: Migrated only ui/dino/session slices; streaming/knowledge/skill/arena/groupchat stay component signals (bounded refactor)
- Phase 27: activeSessionId tracks ChatService.currentThreadId (ChatService stays thread authority; store syncs via setActiveSessionId)
- Phase 27: ACTION_CATALOGUE + dispatchCatalogued (zod-validated) is the ONLY assistant dispatch surface; destructive intents absent by construction (AST-03)
- Phase 27: NgRx pinned to 21.1.0; zod 4.4.3; installed via `npm install --legacy-peer-deps`

### Pending Todos

- **Phase 21 Task 5 — cross-thread memory smoke test (human):** with `DATABASE_URL` + `OPENROUTER_API_KEY` set and `user_memories` pushed (`drizzle-kit push`): tell rexford a fact in thread A → recall in new thread B (same dino) → veloce in thread C must NOT know → unset `DATABASE_URL` → no crash, no recall. See 21-01-SUMMARY.md.
- **Phase 22 Task 5 — teach-once smoke test (human):** with DB + key and `dino_skills` pushed: teach rexford "Always answer in British English." → new chat with rexford applies it without re-teaching → manager delete stops it → veloce unaffected. See 22-01-SUMMARY.md.
- **Phase 23 Task 4 — groupchat smoke test (human):** serve app with live API key; enter Group chat; select 3 dinos; send "Explain recursion in one line."; confirm 3 attributed panels stream in parallel; kill network for one model and confirm only that panel errors. See 23-01-SUMMARY.md.
- **Phase 27 Task 7 — NgRx regression sweep (human):** serve the app and exercise EVERY flow (send/stream, stop, regenerate, edit-and-resend, theme toggle + reload persistence, new chat, switch/delete/rename/pin session, dino picker, Explore, groupchat, arena, leaderboard). Confirm no behavior change vs pre-refactor + open Redux DevTools to confirm actions fire. See 27-01-SUMMARY.md. **Env note:** `nx test frontend` currently crashes with a pre-existing TS `referencedFiles` bug (reproduces on pre-NgRx baseline too) — see phase deferred-items.md.
- **Phase 24 Task 5 — arena + leaderboard smoke test (human):** push `dino_ratings` table (`drizzle-kit push`), serve app; navigate Arena → enter prompt → two anonymous panels stream → vote → both revealed + ratings updated → Leaderboard tab reflects results; repeat with DATABASE_URL unset → no crash, ratings stay at 1000. See 24-01-SUMMARY.md.
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

Last session: 2026-05-31T21:34:03.822Z
Stopped at: Phase 28 context gathered
Resume file: .planning/phases/28-voice-i-o-ssml/28-CONTEXT.md
