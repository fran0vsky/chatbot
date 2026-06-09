# Phase 36: HTTPS / Let's Encrypt - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning
**Source:** Direct planning (decisions captured via plan-phase questions; GSD planning subagents skipped per maker preference)

<domain>
## Phase Boundary

Serve DinoAgents over HTTPS from the production Compute Engine VM with an auto-renewing
Let's Encrypt certificate.

**Current reality:** The VM runs a **single backend Docker container** (`docker-compose.yml`,
host port `3000`) that serves BOTH the `/api/*` routes AND the baked-in Angular SPA from the
same origin (`main.ts` → `useStaticAssets`). The frontend's `environment.prod.ts` uses
`apiUrl: ''` (relative paths), so the SPA already calls the API same-origin — **there is no
separate frontend host and mixed-content is largely a non-issue** once the single origin is
HTTPS. The backend already sets `X-Accel-Buffering: no` on its SSE stream
(`agents.controller.ts`), which nginx honors to keep token streaming un-buffered.

**In scope:** host-level nginx reverse proxy in front of `localhost:3000`, certbot issuance +
auto-renew, HTTP→HTTPS redirect, `CORS_ORIGIN` update to the HTTPS origin, a VM runbook, and
rewriting the stale README deployment section (still describes Cloud Run + Firebase) to the
VM + nginx + certbot reality.

**Out of scope:** CDN, multi-domain/SAN certs, infra-as-code rewrite, moving off the VM,
containerizing nginx (host-level chosen), any application/feature code changes.

</domain>

<decisions>
## Implementation Decisions

### TLS stack
- **D-01:** **Host-level nginx + certbot** (apt-installed on the VM) reverse-proxying to the
  Docker backend on `localhost:3000`. Chosen over a dockerized nginx+certbot compose stack for
  fewer moving parts and the canonical `certbot --nginx` auto-renew path. The backend container
  stays as-is (still publishes `3000`).
- **D-02:** Certificate obtained and managed with **`certbot --nginx`**, which detects the
  shipped HTTP server block, obtains the cert, and **auto-injects the `443 ssl` server block +
  the 80→443 redirect**, and installs the systemd renew timer. This sidesteps the cert/nginx
  chicken-and-egg (no 443 block referencing a not-yet-existing cert at first boot).

### Domain
- **D-03:** A registered domain with an **A record already pointing at the VM's public IP** is
  assumed ready (HTTP-01 challenge can complete immediately). All shipped artifacts use a
  `{DOMAIN}` placeholder the maker fills in on the VM; no real domain is committed to the repo.

### Reverse-proxy correctness (streaming + uploads)
- **D-04:** The proxy location to `localhost:3000` MUST preserve **SSE streaming** and **image
  uploads**: rely on the backend's existing `X-Accel-Buffering: no` plus an explicit raised
  `proxy_read_timeout`/`proxy_send_timeout` (e.g. 1h) so long streams aren't cut; set
  `proxy_buffering off` on the API path as belt-and-suspenders; standard
  `proxy_set_header` (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto) and
  `Upgrade`/`Connection` headers; and a larger `client_max_body_size` (e.g. 25m) for pasted
  screenshots.

### CORS / origin
- **D-05:** Set `CORS_ORIGIN=https://{DOMAIN}` on the backend container (docker-compose env +
  `.env.example` doc). Same-origin makes CORS mostly moot, but it must not be left as the
  localhost dev default in production.

### Docs
- **D-06:** Rewrite the README `## Deployment` section to the VM + nginx + certbot architecture
  with a step-by-step runbook (install, deploy config, issue cert, verify redirect + cert +
  renewal dry-run + streaming over HTTPS). Remove the stale Cloud Run + Firebase + WIF content.

### Claude's Discretion
- Exact nginx directive values (timeout duration, `client_max_body_size`, gzip/security
  headers), file layout under `infra/nginx/`, and runbook prose wording — provided D-01..D-06 hold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deployment surface
- `docker-compose.yml` — the backend service (port 3000, env vars) the proxy sits in front of.
- `apps/backend/src/main.ts` — `enableCors({ origin: process.env['CORS_ORIGIN'] })`, global
  `api` prefix, static SPA serving.
- `apps/backend/src/app/agents/agents.controller.ts` — SSE headers incl. `X-Accel-Buffering: no`.
- `apps/frontend/src/environments/environment.prod.ts` — `apiUrl: ''` (relative, same-origin).
- `.env.example` — env var documentation convention.
- `README.md` `## Deployment` — stale Cloud Run + Firebase content to replace.

</canonical_refs>

<scope_fence>
## Scope Fence

- No application/feature code changes (no controllers, services, components).
- Do NOT rename infra resources — VM/bucket/DB names stay `spinochat-*` (re-provisioning risk).
- nginx runs on the host, not in docker-compose. Backend container is untouched except its
  `CORS_ORIGIN` env value.
- Real domain + cert issuance happen on the VM (manual runbook task); the repo ships only
  placeholder-templated config + docs.

</scope_fence>

<deferred>
## Deferred Ideas

- Containerizing nginx/certbot (compose) — rejected (D-01).
- HSTS preload, CDN, multi-domain certs, infra-as-code — out of scope.

</deferred>

---

*Phase: 36-https-lets-encrypt*
*Context gathered: 2026-06-09 via direct planning*
