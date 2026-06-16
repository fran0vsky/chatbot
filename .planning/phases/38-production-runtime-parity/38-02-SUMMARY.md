---
phase: 38-production-runtime-parity
plan: "02"
subsystem: deploy / env-contract
tags: [deploy, secret-manager, tavily, env-contract, vm-deploy]
dependency_graph:
  requires: [38-01]
  provides: [TAVILY_API_KEY injected into production container]
  affects: [scripts/vm-deploy.sh, .env.example, .planning/INFRASTRUCTURE.md]
tech_stack:
  added: []
  patterns: [Secret Manager graceful-degradation pattern (2>/dev/null || echo "")]
key_files:
  created: []
  modified:
    - scripts/vm-deploy.sh
    - .planning/INFRASTRUCTURE.md
decisions:
  - "D-01: Secret name tavily-api-key (kebab-case, consistent with openrouter-api-key and database-url)"
  - "D-02: Graceful degradation via 2>/dev/null || echo '' — absent secret yields empty key, deploy never aborts"
  - "D-03: -e TAVILY_API_KEY injected directly after OPENROUTER_API_KEY in docker run block"
  - "D-04: Secret creation is a human one-time task; documented in INFRASTRUCTURE.md"
  - "D-05: Env-contract audit confirmed complete — no gaps found"
metrics:
  duration: ~15min
  completed_date: "2026-06-16"
  tasks_completed: 3
  tasks_manual: 1
  files_changed: 2
---

# Phase 38 Plan 02: Tavily Secret Wire-Up & Env Contract Audit Summary

Wire `TAVILY_API_KEY` through `vm-deploy.sh` (Secret Manager fetch + `docker run -e` injection) so
`web_search` returns real Tavily results on the live site; audit confirms the full backend env contract
is already single-sourced and complete in `.env.example`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fetch + inject TAVILY_API_KEY in vm-deploy.sh | d319081 | scripts/vm-deploy.sh |
| 2 | Audit + complete the env contract | (no file change — audit confirmed complete) | .env.example (verified) |
| 3 | Document the tavily-api-key secret in INFRASTRUCTURE.md | 62359ce | .planning/INFRASTRUCTURE.md |
| 4 | Create the secret + verify web_search live | PENDING (manual) | — |

## Env-Contract Audit (Task 2)

Cross-check of every `process.env[…]` read in the backend against injection source:

| Env var | Backend file | Production source | In .env.example |
|---|---|---|---|
| `OPENROUTER_API_KEY` | agents / memory-creator | vm-deploy.sh `fetch_secret openrouter-api-key` | Yes |
| `TAVILY_API_KEY` | web-search.tool.ts | vm-deploy.sh `fetch_secret tavily-api-key` (added this plan) | Yes |
| `DATABASE_URL` | database.module.ts | vm-deploy.sh `fetch_secret database-url` (graceful) | Yes |
| `CORS_ORIGIN` | main.ts | vm-deploy.sh `-e CORS_ORIGIN="$FRONTEND_URL"` | Yes |
| `PORT` | main.ts | Dockerfile `ENV PORT=3000` (override via `-e PORT=3000` in docker run) | Yes |
| `NODE_ENV` | Dockerfile implicit | Dockerfile `ENV NODE_ENV=production` (override via `-e NODE_ENV=production` in docker run) | Yes |
| `BODY_LIMIT` | main.ts | Code default `10mb`; vm-deploy.sh does NOT inject (optional, handled in code) | Yes (added 38-01) |

**Conclusion:** Contract complete. All seven vars are in `.env.example`. All runtime-required vars are
injected by vm-deploy.sh or sourced from the Dockerfile. No gaps found — `.env.example` required no edits.

## Deviations from Plan

None — plan executed exactly as written. `.env.example` needed no edits (all vars already present from
prior plans); only the `vm-deploy.sh` and `INFRASTRUCTURE.md` changes were required.

## Pending Manual Task (Task 4)

**Human one-time operator steps required to activate web_search on production:**

1. Obtain a free Tavily key at https://tavily.com
2. Run (authenticated as franekkaminski@gmail.com):
   ```bash
   printf %s "$TAVILY_API_KEY" | gcloud secrets create tavily-api-key \
     --project=chatbot-franek-2026 --data-file=-
   ```
3. Grant VM runtime SA `secretAccessor` on the new secret if not covered by existing project-wide grant.
4. Trigger a deploy (push to main or re-run the deploy job).
5. On https://dinoagents.duckdns.org, ask a search-capable dino (e.g. rexford) a current-events
   question and confirm real cited results — not "Search unavailable".

The deploy is safe before the secret exists (graceful degradation — Task 1 uses `2>/dev/null || echo ""`
so an absent secret does not abort the deploy; web_search degrades to its existing unconfigured message).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. `TAVILY_API_KEY` flows only through
the VM runtime env (Secret Manager → shell var → container `-e` flag); the value is never echoed,
logged, or committed. Mirrors the existing `OPENROUTER_API_KEY` handling. No new threat flags.

## Self-Check: PASSED

- `scripts/vm-deploy.sh` modified: confirmed (fetch + inject lines present, `bash -n` clean)
- `.planning/INFRASTRUCTURE.md` modified: confirmed (tavily-api-key in secrets table + creation command)
- Commit d319081: confirmed (vm-deploy.sh changes)
- Commit 62359ce: confirmed (INFRASTRUCTURE.md changes)
- `.env.example` verified complete: all 7 vars present, no edits needed
