---
phase: 39-deploy-truth-and-smoke-checks
plan: "03"
subsystem: docs
tags: [documentation, infrastructure, runbook, caddy, deployment]
dependency_graph:
  requires: [CI smoke job and vestigial GCS deploy removal (39-02)]
  provides: [accurate INFRASTRUCTURE.md runbook, truthful Caddyfile with domain docs]
  affects: [.planning/INFRASTRUCTURE.md, infra/caddy/Caddyfile]
tech_stack:
  added: []
  patterns: [verify-before-write doc pattern — all claims cross-checked against vm-deploy.sh + Dockerfile + main.ts before documenting]
key_files:
  created: []
  modified:
    - .planning/INFRASTRUCTURE.md
    - infra/caddy/Caddyfile
decisions:
  - "D-01: Rewrote INFRASTRUCTURE.md wholesale (not patched) — the stale GCS/Firebase/Cloud-Run narrative was pervasive enough that surgical edits would have left contradictions"
  - "D-02: README Deployment section required no changes — already accurate per prior work; verified and left as-is per plan D-06"
  - "D-03: Caddyfile change was minimal — added 'Domain templating' comment and named dinoagents.duckdns.org; {DOMAIN} placeholder kept in directive"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-16"
  tasks_completed: 2
  files_changed: 2
---

# Phase 39 Plan 03: Deploy Truth — Docs & Caddyfile Summary

INFRASTRUCTURE.md rewritten from a superseded GCS-bucket/Firebase/Cloud-Run narrative to the live Caddy + baked-frontend + Secret Manager architecture; Caddyfile header updated to document domain templating and name the live host (dinoagents.duckdns.org).

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Rewrite INFRASTRUCTURE.md to live architecture | 071c4c6 | Done |
| 2 | Verify/trim README Deployment + update Caddyfile | dd3d81d | Done |

## What Was Built

### INFRASTRUCTURE.md (rewritten)

The document previously described:
- GCS-bucket frontend hosting as the live serving path
- `apiUrl: 'http://<external-ip>'` frontend env step
- "HTTPS comes later" as a deferred item
- Firebase/Cloud Run teardown runbook steps
- Deploy flow listing `deploy-frontend` (GCS rsync) + `deploy-storybook`

All of the above replaced with the actual live system:

**Architecture table:** Frontend row now reads "baked into the backend Docker image, served same-origin via `useStaticAssets`" (cross-checked against `Dockerfile` COPY of `dist/apps/frontend/browser` and `main.ts` `useStaticAssets` call). TLS/Ingress row now reads "Caddy container, 80/443, auto Let's Encrypt, reverse-proxy over `web` network". Cloud Run annotated as historical (torn down).

**Secret Manager secrets:** Documents exactly the three secrets that `scripts/vm-deploy.sh` fetches: `openrouter-api-key`, `database-url`, `tavily-api-key` — verified line-by-line against `fetch_secret` calls in vm-deploy.sh.

**CI deploy flow:** Updated to the real order: `lint-test` → `e2e` → `build-image` → `deploy-backend` → `smoke` → `deploy-storybook` (best-effort). No GCS frontend deploy step.

**Preserved verbatim:** Dev vs prod database section (both databases, Cloud SQL split) and its local SSL note (`ssl: { rejectUnauthorized: false }`).

**Status/Last updated:** "Live — https://dinoagents.duckdns.org" / 2026-06-12.

### infra/caddy/Caddyfile (header updated)

Added two header comment lines:
```
# Domain templating: {DOMAIN} is a placeholder. Copy this file to the VM and
# replace {DOMAIN} with the real hostname before starting Caddy.
# Live hostname: dinoagents.duckdns.org
```

The `{DOMAIN}` placeholder is kept in the directive (not hardcoded). `reverse_proxy spinochat:3000` confirmed correct — no change needed.

### README.md (verified, no changes)

The "## Deployment" section already accurately described the Caddy/baked-frontend architecture with the nginx note clearly labeled "retained for reference only and does not apply to this VM". No contradictions found; no changes made.

## Verification

```
DOCS_TRUTH_OK
```

Node check passed: `tavily-api-key` present in INFRASTRUCTURE.md, no `http://<external-ip>` step remaining, Caddyfile has `spinochat:3000` and `dinoagents.duckdns.org`.

## Deviations from Plan

None — plan executed exactly as written. README required no changes (D-06 in plan: "verify, only trim anything that contradicts"; nothing contradicted).

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. Documentation-only changes. Secret names documented match what is already in `vm-deploy.sh` (same exposure level). Consistent with T-39-03-02 (accepted in plan threat model).

## Self-Check: PASSED

- [x] `.planning/INFRASTRUCTURE.md` rewritten — no GCS-frontend-as-live, no `http://<external-ip>` step, no "HTTPS comes later"
- [x] INFRASTRUCTURE.md names `openrouter-api-key`, `database-url`, AND `tavily-api-key`
- [x] INFRASTRUCTURE.md Last updated: 2026-06-12
- [x] Dev vs prod database section preserved
- [x] `infra/caddy/Caddyfile` documents `{DOMAIN}` templating and names `dinoagents.duckdns.org`
- [x] `infra/caddy/Caddyfile` keeps `reverse_proxy spinochat:3000`
- [x] README Deployment section verified accurate — no certbot/Firebase/GCS-frontend live instructions
- [x] Node doc-truth check prints `DOCS_TRUTH_OK`
- [x] Commit 071c4c6 exists (INFRASTRUCTURE.md)
- [x] Commit dd3d81d exists (Caddyfile)
