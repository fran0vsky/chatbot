---
phase: 39-deploy-truth-and-smoke-checks
plan: "02"
subsystem: ci
tags: [smoke-test, ci, deploy, cleanup]
dependency_graph:
  requires: [GET /api/health readiness endpoint (39-01)]
  provides: [post-deploy smoke CI job, single documented serving path]
  affects: [.github/workflows/ci.yml]
tech_stack:
  added: []
  patterns: [bash set -euo pipefail in CI step, curl + jq assertions, bounded retry loop for free-model 429s]
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
decisions:
  - "D-01: smoke job placed after deploy-backend (needs: deploy-backend) with same main-branch if guard"
  - "D-02: Live URL hardcoded as https://dinoagents.duckdns.org (already public in README/ROADMAP)"
  - "D-03: /api/dinos check uses jq -e 'type == \"array\" and length > 0'"
  - "D-04: Chat probe uses dinoId rexford (free model) with one-line tool-free prompt to minimise cost"
  - "D-05: Chat probe retries up to 3 times with 10s sleep to absorb transient 429s; --max-time 60 prevents hung streams"
  - "D-06: /api/health check uses jq -e '.tools.web_search == true'"
  - "D-07: deploy-frontend job removed entirely; no other jobs modified"
  - "D-08: deploy-storybook repointed to needs: e2e (was deploy-frontend); continue-on-error preserved"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-16"
  tasks_completed: 2
  files_changed: 1
---

# Phase 39 Plan 02: CI Smoke Job + Remove Vestigial Frontend Deploy Summary

Post-deploy smoke job probing /api/dinos, /api/agents/chat (SSE stream end-to-end), and /api/health for web_search truth, replacing the misleading GCS frontend deploy with a single documented serving path (Docker-baked frontend behind Caddy).

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Remove vestigial deploy-frontend job, repoint deploy-storybook | 5558edd | Done |
| 2 | Add post-deploy smoke job | 5558edd | Done |
| 3 | Confirm smoke job passes against live deploy | — | HUMAN-UAT (manual, pending) |

## What Was Built

`.github/workflows/ci.yml` modified:

**Removed:** `deploy-frontend` job (GCS rsync, ~40 lines) — the frontend is baked into the backend Docker image and served by Caddy at the same origin as `/api/*`; the bucket copy built with `apiUrl: ''` could not reach the API from the bucket origin and was a dead, misleading path.

**Repointed:** `deploy-storybook` `needs: deploy-frontend` → `needs: e2e` so the pipeline graph stays valid after removing `deploy-frontend`. All other storybook settings (`continue-on-error: true`, steps) unchanged.

**Added:** `smoke` job:
- `needs: deploy-backend`, `if: github.ref == 'refs/heads/main'`, `runs-on: ubuntu-latest`
- Single bash run step with `set -euo pipefail`
- Check 1: `GET /api/dinos` → `jq -e 'type == "array" and length > 0'`
- Check 2: `POST /api/agents/chat` with `dinoId: rexford`, `--max-time 60`, bounded 3-attempt retry (10s sleep) for transient 429s; asserts both `"type":"token"` and `"type":"done"` present in stream
- Check 3: `GET /api/health` → `jq -e '.tools.web_search == true'`
- Each check echoes a ✓ or ✗ line for log readability; any failure exits non-zero

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 both touched only `.github/workflows/ci.yml` and were committed together as a single atomic commit (consistent with project 1-commit-per-session convention per memory).

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The smoke job only reads from the public HTTPS domain (no secrets sent, no new surface). Consistent with T-39-02-03 (accepted in plan threat model).

## Human-UAT Pending (Task 3)

After merging to main (with Phase 38's Tavily wiring deployed on the VM):
1. Watch the GitHub Actions run triggered by the merge commit
2. Confirm the `smoke` job runs after `deploy-backend` and all three checks print ✓
3. Confirm `deploy-frontend` is absent from the run graph
4. Confirm `deploy-storybook` still appears and its `continue-on-error` tolerates any known failure

This satisfies PROD-04 (CI smoke stage) and PROD-05 (vestigial GCS deploy removed).

## Self-Check: PASSED

- [x] `.github/workflows/ci.yml` modified — `deploy-frontend` job absent
- [x] `.github/workflows/ci.yml` — `deploy-storybook` has `needs: e2e`
- [x] `.github/workflows/ci.yml` — `smoke` job present with `needs: deploy-backend`
- [x] Commit 5558edd exists
- [x] Structure check: no `deploy-frontend:` key, smoke job present, storybook repointed
- [x] Smoke job content check: /api/dinos, /api/agents/chat, /api/health, "type":"token", "type":"done", .tools.web_search, --max-time 60, retry loop, set -euo pipefail all present
