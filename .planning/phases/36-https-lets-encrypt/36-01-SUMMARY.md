---
phase: 36-https-lets-encrypt
plan: 01
subsystem: infra
tags: [nginx, certbot, lets-encrypt, tls, https, reverse-proxy, docker-compose, cors, deployment]

# Dependency graph
requires:
  - phase: deployment-vm
    provides: backend Docker container on localhost:3000 serving /api/* + SPA same-origin
provides:
  - Host-level nginx reverse-proxy site config (HTTP bootstrap, streaming/upload-safe) at infra/nginx/dinoagents.conf
  - CORS_ORIGIN wired to the HTTPS origin in docker-compose.yml + documented in .env.example
  - README ## Deployment rewritten for the VM + nginx + certbot architecture (Cloud Run/Firebase/WIF content removed)
affects: [deployment, infra, future-tls-changes]

# Tech tracking
tech-stack:
  added: [nginx (host-level), certbot, python3-certbot-nginx]
  patterns: [HTTP-bootstrap nginx block that certbot --nginx augments with TLS + 80→443 redirect; SSE/upload-safe proxy directives]

key-files:
  created:
    - infra/nginx/dinoagents.conf
  modified:
    - docker-compose.yml
    - .env.example
    - README.md

key-decisions:
  - "Host-level nginx + certbot (D-01), not dockerized — canonical certbot --nginx auto-renew path"
  - "Ship HTTP-only server block; certbot --nginx injects the 443 ssl server + 301 redirect (D-02), avoiding the cert/nginx chicken-and-egg"
  - "proxy_buffering off + proxy_read_timeout/proxy_send_timeout 3600s preserve SSE token streaming; client_max_body_size 25m for pasted screenshots (D-04)"
  - "CORS_ORIGIN=${CORS_ORIGIN:-https://{DOMAIN}} in compose so the VM .env value flows through (D-05)"
  - "{DOMAIN} placeholder everywhere; no real hostname or cert committed (D-03)"

patterns-established:
  - "Committed nginx site configs live under infra/nginx/ as HTTP-bootstrap templates that certbot augments on the VM"

requirements-completed: [INFRA-01]

# Metrics
duration: ~15min
completed: 2026-06-09
---

# Phase 36: HTTPS / Let's Encrypt Summary

**Host-level nginx reverse-proxy config (streaming/upload-safe, HTTP bootstrap for `certbot --nginx`) plus a CORS_ORIGIN bump and a VM + nginx + certbot deployment runbook replacing the stale Cloud Run/Firebase docs.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-09
- **Tasks:** 3 of 4 (Task 4 is a manual VM step — HUMAN-UAT)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `infra/nginx/dinoagents.conf` — single port-80 server block reverse-proxying `{DOMAIN}` → `http://localhost:3000`, carrying SSE-safe directives (`proxy_buffering off`, `proxy_read_timeout 3600s`, `X-Forwarded-Proto $scheme`, upgrade headers) and `client_max_body_size 25m`; leading comment documents the `certbot --nginx` augmentation step.
- `docker-compose.yml` — backend `environment` gains `CORS_ORIGIN=${CORS_ORIGIN:-https://{DOMAIN}}` so the VM `.env` value flows to the app's `enableCors`.
- `.env.example` — localhost dev default replaced with the documented HTTPS production origin (`CORS_ORIGIN=https://your-domain.example`).
- `README.md ## Deployment` — fully rewritten to the Compute Engine VM + host-nginx + certbot architecture with a numbered runbook (install, deploy config, `certbot --nginx`, set CORS, verify HTTPS/redirect/streaming, `certbot renew --dry-run`). All Cloud Run, Artifact Registry, Workload Identity Federation, and Firebase Hosting content removed.

## Files Created/Modified
- `infra/nginx/dinoagents.conf` — host-level nginx reverse-proxy (HTTP bootstrap; certbot adds TLS)
- `docker-compose.yml` — backend `CORS_ORIGIN` env (HTTPS origin)
- `.env.example` — documented `CORS_ORIGIN` HTTPS production origin
- `README.md` — VM + nginx + certbot deployment runbook (replaces retired GCP architecture)

## Decisions Made
None beyond the plan's D-01..D-06 — followed as specified. `.env.example` already had a `CORS_ORIGIN=http://localhost:4200` dev default; per the must-have ("no localhost dev default in production") it was replaced with the HTTPS placeholder rather than appended.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- `docker compose config` could not run locally (Docker not installed on this dev machine, exit 127). Compose validity was instead confirmed by parsing `docker-compose.yml` with the `yaml` library (PARSE_OK; backend env includes the new `CORS_ORIGIN` line). nginx directives and README content were verified via grep against the plan's acceptance criteria.

## Verification (static — per plan)
- nginx config: exactly one `listen 80` server block, no real `listen 443` directive (TLS comment-only); contains `proxy_pass http://localhost:3000;`, `X-Forwarded-Proto $scheme`, `proxy_buffering off`, `proxy_read_timeout 3600s`, `client_max_body_size 25m`, `{DOMAIN}` placeholder. ✓
- docker-compose.yml: parses; backend `environment` includes `CORS_ORIGIN=${CORS_ORIGIN:-https://{DOMAIN}}`. ✓
- .env.example: `CORS_ORIGIN=` line with explanatory comment, HTTPS placeholder. ✓
- README `## Deployment`: contains `certbot --nginx` + `certbot renew --dry-run`, references `infra/nginx/dinoagents.conf`, includes HTTP→HTTPS redirect verification + `CORS_ORIGIN=https://` step; no Cloud Run / Artifact Registry / Workload Identity / Firebase Hosting terms. ✓

## User Setup Required
**Live cert issuance + verification is a manual VM task (Task 4 — HUMAN-UAT, blocks INFRA-01 live verification).** On the production VM, follow the new README runbook with the real domain:
1. Confirm the domain's A record resolves to the VM IP; ports 80/443 open, 3000 not public.
2. `sudo apt install nginx certbot python3-certbot-nginx`; deploy `dinoagents.conf` (replace `{DOMAIN}`), symlink, `sudo nginx -t && sudo systemctl reload nginx`.
3. `sudo certbot --nginx -d {DOMAIN}` (issues cert, injects 443 + redirect, installs renew timer).
4. Set `CORS_ORIGIN=https://{DOMAIN}` in the VM `.env`; `docker compose up -d`.
5. Verify: valid Let's Encrypt cert (padlock), `http://` 301→`https://`, chat streams token-by-token over HTTPS, image paste/upload works, no mixed-content errors.
6. `sudo certbot renew --dry-run` succeeds; renew timer active.

## Next Phase Readiness
- All committable deliverables for INFRA-01 are in the repo. The phase goal (valid auto-renewing HTTPS) goes live only after the manual VM runbook is executed.
- No code dependencies introduced; backend container is untouched except its `CORS_ORIGIN` env value. Infra resource names stay `spinochat-*` (not renamed).

---
*Phase: 36-https-lets-encrypt*
*Completed: 2026-06-09*
