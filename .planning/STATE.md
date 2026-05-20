---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Phase 2 complete — all code done, awaiting commit + deploy
last_updated: "2026-05-20T00:00:00.000Z"
last_activity: 2026-05-20 — Phase 2 plans 02-01 and 02-02 executed; all type-check and grep gates green
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-17)

**Core value:** A user can open the app, type a message, get a real answer, and keep the conversation going.
**Current focus:** Phase 2 complete — model selector wired end-to-end

## Current Position

Phase: 2 of 2 (Choose Your Model)
Plan: 2 of 2 in current phase (code complete)
Status: Both phases code complete; pending commit and human GCP/Firebase one-time setup before first production deploy
Last activity: 2026-05-20 — Phase 2 plans 02-01 and 02-02 executed; all type-check and grep gates green

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Working Chat | 3 | — | — |
| 2. Choose Your Model | 2 | — | — |

## Accumulated Context

### Roadmap Evolution

- Phase 3 added: UI/UX Refinement Phase

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

- **Commit Phase 1 + Phase 2 changes** (both denied during execution; user should commit manually).
- Human one-time setup (Plan 03 Task 2): GCP project + APIs, Artifact Registry repo, Secret Manager `openrouter-api-key`, Cloud Run service `chatbot-backend`, Workload Identity Federation, Firebase project + Hosting, 8 GitHub Actions variables + 2 secrets. Full checklist in `README.md` `## Deployment`.
- Local smoke test of the full stack: `npx nx serve backend` + `npx nx serve frontend` with `OPENROUTER_API_KEY` in `.env`; verify model selector routes to both models.
- Local Playwright E2E dry-run (`npx nx e2e frontend-e2e` with `OPENROUTER_API_KEY` exported).

### Blockers/Concerns

- `npx nx build` fails on this dev machine: Nx 22.7.0 + Node 24.12.0 causes `ERR_UNSUPPORTED_ESM_URL_SCHEME` on Windows. This is pre-existing (Phase 1 commits were also CI-verified only). TypeScript compilation (tsc --noEmit) passes clean on all changed packages. Full build verification happens on CI push.
- `@langchain/openai ^1.10.0` was not on npm; pinned to `^1.4.0` (latest published 1.x is 1.4.5).
- Docker not installed on the dev machine — Dockerfile changes are CI-only.
- `apps/frontend/src/main.ts` has a pre-existing `console.error(err)` lint warning (1 warning, 0 errors).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Persistent history across sessions | Deferred | Init |
| v2 | Markdown rendering in assistant messages | Deferred | Init |
| v2 | Real web search tool | Deferred | Init |

## Session Continuity

Last session: 2026-05-20T00:00:00.000Z
Stopped at: Phase 2 code complete — both plans executed, SUMMARY files written
Resume file: .planning/phases/02-choose-your-model/02-02-SUMMARY.md
