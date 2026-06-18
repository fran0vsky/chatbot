# DinoAgents Infrastructure — Architecture & Runbook

**Status:** Live — https://dinoagents.duckdns.org
**Last updated:** 2026-06-12

## Architecture

| Layer | Choice | Notes |
|---|---|---|
| VM | **Compute Engine** `spinochat-backend` (e2-micro, Container-Optimized OS, `us-central1-a`) | COS is Docker-only — no `apt`, no host-level nginx/certbot. |
| Backend container | **Docker multi-stage** (`apps/backend/Dockerfile`), named `spinochat`, port `3000` on internal `web` network | Reproducible builds, slim runtime image, runs as non-root, tini for PID-1. |
| Frontend hosting | **Baked into the backend Docker image** — `Dockerfile` copies `dist/apps/frontend/browser` into `./dist/frontend`; `main.ts` serves it via `useStaticAssets` at the same origin as `/api/*` | No GCS bucket for the app frontend; serving is same-origin from `spinochat:3000`. |
| TLS / Ingress | **Caddy container** (`caddy:2`) on ports `80`/`443`, reverse-proxying to `spinochat:3000` over the shared `web` Docker network; auto-obtains + auto-renews Let's Encrypt cert | No certbot, no cron. Backend does NOT publish port 80 — Caddy owns it. Config at `infra/caddy/Caddyfile`. |
| Database | **Cloud SQL Postgres 17** (`db-f1-micro`), instance `spinochat-db` | Managed, automatic backups. Two databases: `spinochat` (prod), `spinochat_dev` (local dev). |
| ORM | **Drizzle** (`drizzle-orm` + `drizzle-kit`) | TypeScript-first. Schema: `apps/backend/src/app/database/schema.ts`. Boot-time migration runner in `apps/backend/src/app/database/migrate.ts`. |
| Secrets | **Secret Manager** — `openrouter-api-key`, `database-url`, `tavily-api-key` | Runtime SA reads via metadata service; never in git. |
| CI/CD | **GitHub Actions** with Workload Identity Federation | No SA JSON keys in repo. Pipeline: `lint-test` → `e2e` → `build-image` → `deploy-backend` → `smoke`. |
| Storybook | **Separate GCS bucket** `spinochat-storybook-chatbot-franek-2026`, deployed by CI `deploy-storybook` job (`continue-on-error: true`) | Best-effort; currently broken on Angular 21 per ci.yml comment. Does NOT share the app's serving path. |

> **Historical note:** An earlier Cloud Run service (`chatbot-backend`) was used during initial development and has been torn down. It is not the current serving path.

> **nginx note:** `infra/nginx/dinoagents.conf` is retained for reference only — it does **not** apply to this VM (COS is Docker-only; nginx was never installed on the live host).

---

## Secret Manager secrets

All three secrets are fetched by `scripts/vm-deploy.sh` via the VM runtime service account (`fetch_secret` calls). The deploy degrades gracefully when a secret is absent (empty value, no abort).

| Secret name | What it holds | Created |
|---|---|---|
| `openrouter-api-key` | OpenRouter API key for LLM calls | Phase 3 |
| `database-url` | Cloud SQL `postgresql://…` connection string | Phase 3 |
| `tavily-api-key` | Tavily Search API key for `web_search` tool | Phase 38 |

### One-time: create the `tavily-api-key` secret

Obtain a free key at https://tavily.com (free tier — 1000 searches/month), then run:

```bash
# Create the secret (first time)
printf %s "$TAVILY_API_KEY" | gcloud secrets create tavily-api-key \
  --project=chatbot-franek-2026 \
  --data-file=-

# Grant the VM runtime SA access (if not already covered by project-wide grant)
gcloud secrets add-iam-policy-binding tavily-api-key \
  --project=chatbot-franek-2026 \
  --member="serviceAccount:<vm-runtime-sa>@chatbot-franek-2026.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# If the secret already exists and you want to rotate the value:
printf %s "$TAVILY_API_KEY" | gcloud secrets versions add tavily-api-key \
  --project=chatbot-franek-2026 \
  --data-file=-
```

`vm-deploy.sh` reads the secret with `fetch_secret tavily-api-key 2>/dev/null || echo ""` — if the secret does not exist yet, the deploy still succeeds and `web_search` returns its existing "Search unavailable: TAVILY_API_KEY is not configured." message.

---

## CI deploy flow

On push to `main`, GitHub Actions runs:

1. `lint-test` — Nx affected lint/test/build
2. `e2e` — Playwright
3. `build-image` — Docker multi-stage build (bakes frontend SPA into image) → push to Artifact Registry
4. `deploy-backend` — SSH into VM, pipe `scripts/vm-deploy.sh` over stdin; pulls new image, stops/removes old container, starts new `spinochat` container on the `web` network (no port 80 publish — Caddy owns it)
5. `smoke` — curl probes `/api/dinos`, `/api/agents/chat` (SSE end-to-end), and `/api/health` (checks `tools.web_search == true`) against `https://dinoagents.duckdns.org`
6. `deploy-storybook` — best-effort GCS rsync (`continue-on-error: true`)

> For the Caddy runbook and manual first-time setup, see **README.md "## Deployment"**.

---

## Dev vs prod database

The Cloud SQL instance `spinochat-db` hosts **two** databases so local development never pollutes production:

| Database | Used by | Connection |
|---|---|---|
| `spinochat` | **Production** (VM) | Secret Manager `database-url` |
| `spinochat_dev` | **Local dev** (`nx serve backend`) | local `.env` `DATABASE_URL` (ends `/spinochat_dev`) |

Both share the same instance, user (`spinochat-app`), and authorized-network allowlist — only the database name differs. Schema is identical (pushed from `apps/backend/src/app/database/schema.ts`). To re-create/refresh the dev schema after a schema change:

```powershell
# from repo root; export DDL from schema.ts and apply to spinochat_dev
$env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').ToString().Substring('DATABASE_URL='.Length)
cd apps/backend; npx drizzle-kit export --dialect=postgresql --schema=./src/app/database/schema.ts
# pipe the printed DDL into the spinochat_dev database (psql or a node pg client)
```

> **Local SSL note:** `database.module.ts` strips `sslmode`/`uselibpqcompat` from the URL and sets `ssl: { rejectUnauthorized: false }` for public-IP connections (Cloud SQL's per-instance CA isn't in the local trust store). Unix-socket (`/cloudsql/`) connections in prod are left untouched.

---

## Infrastructure inventory

| Resource | Name | Notes |
|---|---|---|
| GCP project | `chatbot-franek-2026` | |
| Artifact Registry repo | `chatbot` (`europe-west1`) | Backend images |
| Compute Engine VM | `spinochat-backend` (`us-central1-a`) | COS, e2-micro |
| Cloud SQL instance | `spinochat-db` | Postgres 17, db-f1-micro |
| Storybook GCS bucket | `spinochat-storybook-chatbot-franek-2026` | Best-effort |
| Avatar GCS bucket | `${PROJECT_ID}-dino-avatars` (e.g. `chatbot-franek-2026-dino-avatars`) | Public-read, uniform-bucket-level-access; VM SA has `roles/storage.objectAdmin` |
| WIF provider | (set in GitHub Actions `GCP_WIF_PROVIDER`) | No SA JSON keys |
| Live URL | https://dinoagents.duckdns.org | Caddy TLS, Let's Encrypt auto-renew |

> **Naming note:** All `spinochat-*` infra resource names were set during initial provisioning and must NOT be renamed without re-provisioning.

---

## Avatar storage (Phase 42-02)

### Bucket

| Property | Value |
|---|---|
| Bucket name | `${PROJECT_ID}-dino-avatars` (default from `provision-gcp.sh`; override via `AVATAR_BUCKET` env) |
| Location | `us-central1` (same as other buckets) |
| Access control | Uniform bucket-level access; `allUsers` has `roles/storage.objectViewer` (public-read) |
| Write access | VM runtime service account (`chatbot-vm@${PROJECT_ID}.iam.gserviceaccount.com`) has `roles/storage.objectAdmin` via project-level IAM |
| Auth method | Application Default Credentials — VM runs with `--scopes=cloud-platform`; no key file |

### Object naming

`avatars/<uuid>.<ext>` — uuid generated by `crypto.randomUUID()`, ext derived from the file mimetype.

### Public URL

`https://storage.googleapis.com/<AVATAR_BUCKET>/avatars/<uuid>.<ext>`

Stored in `custom_dinos.avatarUrl`. The bucket is public-read via uniform access — no per-object ACL call is needed.

### Env contract

| Variable | Required | Description |
|---|---|---|
| `AVATAR_BUCKET` | Yes (production) | GCS bucket name for avatar uploads. When unset, `POST /api/custom-dinos/avatar` returns HTTP 400 with "avatar upload is not configured". All other custom-dino CRUD still works without this variable. |

### One-time provisioning

Run `bash infrastructure/provision-gcp.sh` (with `GCP_PROJECT_ID` and credentials set) — the script creates the bucket, grants `allUsers objectViewer`, and adds `objectAdmin` to the VM SA. Then set `AVATAR_BUCKET=${PROJECT_ID}-dino-avatars` in the VM environment (e.g., via `scripts/vm-deploy.sh` or Secret Manager).

---

## Monitoring / next steps

- **Cloud Logging** is wired (VM SA has logWriter). Add Cloud Monitoring uptime checks + alerting as traffic grows.
- **Cloud SQL Auth Proxy**: currently the VM connects to Cloud SQL over public IP with authorized-networks. Auth Proxy would be cleaner.
- **Backup strategy**: Cloud SQL has automatic backups but no off-site copy; add scheduled export to GCS if needed.
- **Scaling**: e2-micro is fine for current traffic. If it saturates, switch to an instance group with autoscale, or move back to Cloud Run.
