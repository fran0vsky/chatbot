---
phase: 39-deploy-truth-and-smoke-checks
verified: 2026-06-16T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (code-complete); 1 item requires live-run confirmation
overrides_applied: 0
human_verification:
  - test: "Merge to main and watch the GitHub Actions run — confirm smoke job passes against live deploy"
    expected: |
      After deploy-backend completes, the smoke job runs three checks:
      - /api/dinos returns 200 with a non-empty JSON array (✓ logged)
      - /api/agents/chat (SSE, dinoId: rexford) streams token events and a done event (✓ logged)
      - /api/health returns { tools: { web_search: true } } (✓ logged)
      All three print ✓ and the job exits 0. deploy-frontend is absent from the run graph.
      deploy-storybook still appears with continue-on-error.
    why_human: "Cannot invoke the live VM, GitHub Actions runner, or the deployed backend from this local verification. Live smoke-check pass requires a real git push to main and observation of the resulting CI run."
---

# Phase 39: Deploy Truth & Smoke Checks — Verification Report

**Phase Goal:** CI green guarantees the website works — post-deploy verification, removal of misleading deploy steps, and runbooks that match reality.
**Verified:** 2026-06-16
**Status:** human_needed — all code is correct and complete; one runtime-only check (live CI run) is pending.
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | CI runs a post-deploy smoke stage: `/api/dinos` 200, streamed chat probe end-to-end, `/api/health` web_search==true (PROD-04) | VERIFIED (code) / HUMAN-UAT (runtime) | `smoke` job in ci.yml L213–282: needs: deploy-backend, if: main, three curl+jq checks, 3-attempt retry for 429s |
| SC2 | Vestigial GCS frontend deploy job removed; one documented serving path — Docker-baked frontend behind Caddy (PROD-05) | VERIFIED | `deploy-frontend` absent from ci.yml (grep confirms zero matches); deploy-storybook repointed to `needs: e2e` (L174) |
| SC3 | INFRASTRUCTURE.md + README describe real Caddy/baked-frontend architecture; stale nginx/certbot/Firebase/Cloud Run content removed | VERIFIED | INFRASTRUCTURE.md: Caddy container row, baked-in frontend row, Cloud Run annotated as historical, nginx noted as reference-only, no GCS-frontend-as-live path, three secrets documented |
| SC4 | `infra/caddy/Caddyfile` reflects live VM config with documented domain templating | VERIFIED | Caddyfile header comment: domain templating + `{DOMAIN}` placeholder + `Live hostname: dinoagents.duckdns.org`; `reverse_proxy spinochat:3000` unchanged |

**Score:** 4/4 truths verified at code level.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/app/health/health.controller.ts` | GET /api/health endpoint | VERIFIED | 18 lines: reads `TAVILY_API_KEY`, returns `{ status: 'ok', tools: { web_search: boolean } }` — no secret leaked |
| `apps/backend/src/app/health/health.controller.spec.ts` | Unit tests (4 cases) | VERIFIED | 41 lines: key-set true, no-secret-leak, empty-string false, undefined false — all 4 branches covered |
| `apps/backend/src/app/app.module.ts` | HealthController registered | VERIFIED | L9 import, L13 controllers array includes HealthController alongside AppController |
| `.github/workflows/ci.yml` | smoke job + deploy-frontend removed + deploy-storybook repointed | VERIFIED | smoke job L213–282, deploy-frontend absent (0 grep matches), deploy-storybook needs: e2e L174 |
| `.planning/INFRASTRUCTURE.md` | Live Caddy architecture, Secret Manager secrets, real CI flow | VERIFIED | Full rewrite: Caddy TLS, baked frontend, 3 secrets, CI flow: lint-test→e2e→build-image→deploy-backend→smoke→deploy-storybook |
| `infra/caddy/Caddyfile` | Domain templating comment + live hostname | VERIFIED | Header comment lines added; {DOMAIN} placeholder kept; reverse_proxy spinochat:3000 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `HealthController` | `AppModule` | import + controllers array | WIRED | app.module.ts L9, L13 |
| `HealthController` | `/api/health` route | `@Controller('health')` + global `api` prefix in main.ts | WIRED | Controller decorator confirmed; global prefix set in main.ts per plan D-01 |
| `smoke` job | `deploy-backend` | `needs: deploy-backend` in ci.yml L216 | WIRED | Confirmed |
| `smoke` job | health check | `curl "$URL/api/health"` + `jq -e '.tools.web_search == true'` | WIRED | ci.yml L272–278 |
| `smoke` job | chat probe | `curl -N "$URL/api/agents/chat"` + token/done presence checks | WIRED | ci.yml L236–264 |
| `deploy-storybook` | `e2e` (not deploy-frontend) | `needs: e2e` | WIRED | ci.yml L174 — repointed correctly |

---

### Data-Flow Trace (Level 4)

`HealthController.check()` reads `process.env['TAVILY_API_KEY']` synchronously — no DB, no fetch, no async path. The boolean is derived directly from the env var at request time. This is correct behavior for a readiness probe: it reflects the live environment state of the running process.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `health.controller.ts` | `webSearch` (boolean) | `process.env['TAVILY_API_KEY']` — runtime env of the container | Yes (reflects actual TAVILY_API_KEY presence on VM) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| HealthController returns correct shape (key unset) | Unit test: `web_search false when TAVILY_API_KEY is not set` | spec.ts L33–40 — confirmed implementation matches assertion | PASS |
| HealthController does not leak secret | Unit test: `does not leak the TAVILY_API_KEY value` | spec.ts L17–24 — JSON.stringify(result) does not contain key value | PASS |
| smoke job has all three checks | grep `/api/dinos`, `/api/agents/chat`, `/api/health` in ci.yml | All three present at lines 226, 236, 272 | PASS |
| deploy-frontend removed | grep `deploy-frontend` in ci.yml | 0 matches | PASS |
| Live smoke checks pass against deployed VM | Merge to main + watch CI run | Cannot verify locally | HUMAN-UAT |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist for this phase. No probes declared in PLAN files.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROD-04 | 39-02 | CI smoke stage: /api/dinos 200, streamed chat probe, web_search configured | CODE-COMPLETE (HUMAN-UAT pending runtime pass) | smoke job in ci.yml; health endpoint in 39-01 |
| PROD-05 | 39-02, 39-03 | One serving path; GCS deploy removed; runbooks describe real Caddy/baked-frontend | VERIFIED | deploy-frontend absent from ci.yml; INFRASTRUCTURE.md rewritten |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Scanned: `health.controller.ts`, `health.controller.spec.ts`, `app.module.ts`, `ci.yml`, `INFRASTRUCTURE.md`, `Caddyfile`. No TBD/FIXME/XXX/placeholder/TODO in new or modified code. No empty returns, no stub handlers, no hardcoded empty arrays.

---

### Human Verification Required

#### 1. Live CI Smoke Run

**Test:** Merge Phase 38 + Phase 39 changes to main (or confirm they are already on main) and observe the GitHub Actions run triggered by the merge commit.

**Expected:**
- `deploy-frontend` is absent from the run graph entirely.
- `smoke` job appears after `deploy-backend` finishes.
- The smoke job logs three "✓" lines:
  - `✓ /api/dinos returned a non-empty JSON array`
  - `✓ /api/agents/chat streamed token events and a done event`
  - `✓ /api/health reports web_search: true`
- `smoke` job exits 0 (green).
- `deploy-storybook` still appears in the graph with `continue-on-error` (may be red, that is acceptable).

**Why human:** The smoke job probes `https://dinoagents.duckdns.org` — a live VM. The code is verified correct, but whether the VM is reachable, the Tavily secret is present in Secret Manager, and the `rexford` free model is not 429-ing can only be confirmed by running CI against the deployed environment.

This satisfies PROD-04 and completes the HUMAN-UAT item declared in 39-02-SUMMARY.md Task 3.

---

### Gaps Summary

No code gaps. All four success criteria are satisfied by the delivered code and documentation. The sole open item is the runtime confirmation (live CI run), which is by design a HUMAN-UAT item — it cannot be verified locally and is noted in the 39-02 SUMMARY as explicitly pending.

**Phase verdict: CODE-COMPLETE. Awaiting live CI run confirmation (HUMAN-UAT).**

---

_Verified: 2026-06-16_
_Verifier: Claude (gsd-verifier)_
