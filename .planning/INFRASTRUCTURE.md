# SpinoChat Infrastructure — Architecture & Setup Runbook

**Status:** scaffolded, provisioning in progress
**Last updated:** 2026-05-27

## Architecture decisions

| Layer | Choice | Why |
|---|---|---|
| Backend hosting | **Compute Engine** (e2-micro VM, Container-Optimized OS) | Mentor's explicit guidance. Cloud Run service from earlier work is deprecated and will be torn down once Compute path is live. |
| Backend container | **Docker multi-stage** (`apps/backend/Dockerfile`) | Reproducible builds, slim runtime image, runs as non-root, tini for proper signal handling. |
| Database | **Cloud SQL Postgres 17** (`db-f1-micro`, ~$7/mo) | Managed, automatic backups, mentor's "separate database" intent. First $300 GCP free trial covers ~3.5 years of this tier. |
| ORM | **Drizzle** (`drizzle-orm` + `drizzle-kit`) | TypeScript-first, lightweight, type-safe queries. Schema lives at `apps/backend/src/app/database/schema.ts`. |
| Frontend hosting | **GCS bucket** with static-website + public-read IAM | Mentor's explicit "no Firebase". Cheaper, GCP-native. HTTPS via storage.googleapis.com URL; custom domain + Cloud CDN added later. |
| Storybook hosting | **Separate GCS bucket**, deployed after frontend | Mentor's ask. Same pattern as frontend. |
| Secrets | **Secret Manager** (`openrouter-api-key`, `database-url`, `tavily-api-key`) | Runtime SA mounts at boot; never in env files committed to git. |
| CI/CD | **GitHub Actions** with Workload Identity Federation | Already configured in `.github/workflows/ci.yml`. No service-account JSON keys in repo. |
| Deploy trigger | Push to `main` | CI runs lint/test/e2e/build; on success, deploys backend (SSH+docker on VM) + frontend (rsync to GCS) + storybook (rsync to GCS). |

## Dev vs prod database (added 2026-06-04)

The Cloud SQL instance `spinochat-db` hosts **two** databases so local development never pollutes production:

| Database | Used by | Connection |
|---|---|---|
| `spinochat` | **Production** (Cloud Run/VM) | Secret Manager `database-url` |
| `spinochat_dev` | **Local dev** (`nx serve backend`) | local `.env` `DATABASE_URL` (ends `/spinochat_dev`) |

Both share the same instance, user (`spinochat-app`), and authorized-network allowlist — only the database name differs. Schema is identical (pushed from `apps/backend/src/app/database/schema.ts`). To re-create/refresh the dev schema after a schema change:

```powershell
# from repo root; export DDL from schema.ts and apply to spinochat_dev
$env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').ToString().Substring('DATABASE_URL='.Length)
cd apps/backend; npx drizzle-kit export --dialect=postgresql --schema=./src/app/database/schema.ts
# pipe the printed DDL into the spinochat_dev database (psql or a node pg client)
```

> **Local SSL note:** `database.module.ts` strips `sslmode`/`uselibpqcompat` from the URL and sets `ssl: { rejectUnauthorized: false }` for public-IP connections (Cloud SQL's per-instance CA isn't in the local trust store). Unix-socket (`/cloudsql/`) connections in prod are left untouched.

## What's already in the repo

| File | Purpose |
|---|---|
| `apps/backend/Dockerfile` | Multi-stage backend image build |
| `.dockerignore` | Excludes frontend/planning/etc from backend builds |
| `apps/backend/drizzle.config.ts` | Drizzle migration config |
| `apps/backend/src/app/database/schema.ts` | Sessions + messages tables |
| `apps/backend/src/app/database/database.module.ts` | NestJS module providing Drizzle client via `DATABASE_CONNECTION` token |
| `scripts/setup-gcp.ps1` | Bootstrap: Artifact Registry, Secret Manager, github-deployer SA, WIF. **Already ran once.** |
| `scripts/setup-postgres.ps1` | Cloud SQL instance + db + user + secret. **NEW.** |
| `scripts/setup-gcs-frontend.ps1` | GCS buckets for frontend + storybook. **NEW.** |
| `scripts/setup-compute.ps1` | Compute Engine VM + firewall + SSH access for deploy. **NEW.** |
| `scripts/vm-deploy.sh` | Installed on VM at `/opt/chatbot/deploy.sh`; CI invokes via SSH. **NEW.** |
| `.github/workflows/ci.yml` | Full pipeline: lint/test/e2e → build-image → deploy-backend (GCE) + deploy-frontend (GCS) + deploy-storybook (GCS). |

## Runbook — first-time setup

### Prerequisites

- `gcloud` CLI authenticated (`gcloud auth login` done — confirmed `franekkaminski@gmail.com` active)
- GCP project `chatbot-franek-2026` exists (confirmed)
- OpenRouter API key already in local `.env` and Secret Manager (confirmed)

### Step 1 — Add Drizzle deps to backend

```powershell
npm install -w apps/backend drizzle-orm pg
npm install -w apps/backend -D drizzle-kit @types/pg
```

### Step 2 — Provision Postgres

```powershell
.\scripts\setup-postgres.ps1
```

Takes ~3-5 minutes. Output prints:
- The Cloud SQL connection name
- The auto-generated `DATABASE_URL` to paste into local `.env`
- The Secret Manager secret name (`database-url`) for runtime use

After it finishes, paste the printed `DATABASE_URL` into your local `.env`.

### Step 3 — Generate initial Drizzle migration

```powershell
npx drizzle-kit generate --config=apps/backend/drizzle.config.ts
npx drizzle-kit push --config=apps/backend/drizzle.config.ts
```

This creates `apps/backend/drizzle/` with SQL migration files and applies them to Cloud SQL.

### Step 4 — Provision GCS buckets

```powershell
.\scripts\setup-gcs-frontend.ps1
```

Creates `spinochat-frontend-chatbot-franek-2026` and `spinochat-storybook-chatbot-franek-2026`. Grants `github-deployer` SA write access.

### Step 5 — Provision Compute Engine VM

```powershell
.\scripts\setup-compute.ps1
```

Provisions:
- e2-micro VM in `us-central1-a` (free tier) — set `$UseFreeRegion = $false` in the script to use `europe-west1-b` with e2-small (~$13/mo) for EU latency.
- Static external IP
- Firewall rule for HTTP/HTTPS
- VM service account with Secret/Registry/Logging access
- `/opt/chatbot/deploy.sh` installed via startup-script

Note the printed external IP — needed for frontend env config.

### Step 6 — Set GitHub Actions repository variables

In GitHub → repo Settings → Secrets and variables → Actions → **Variables** tab:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | `chatbot-franek-2026` |
| `GCP_REGION` | `europe-west1` (or `us-central1` if you used free region) |
| `GCP_ARTIFACT_REPO` | `chatbot` |
| `GCP_WIF_PROVIDER` | (from setup-gcp.ps1 output) |
| `GCP_WIF_SERVICE_ACCOUNT` | `github-deployer@chatbot-franek-2026.iam.gserviceaccount.com` |
| `GCE_INSTANCE` | `spinochat-backend` |
| `GCE_ZONE` | `us-central1-a` (or whatever the setup-compute.ps1 output shows) |
| `FRONTEND_BUCKET` | `spinochat-frontend-chatbot-franek-2026` |
| `STORYBOOK_BUCKET` | `spinochat-storybook-chatbot-franek-2026` |
| `FRONTEND_URL` | `https://storage.googleapis.com/spinochat-frontend-chatbot-franek-2026/index.html` |

And **Secrets** tab:

| Secret | Value |
|---|---|
| `OPENROUTER_API_KEY` | (already set from previous setup) |

### Step 7 — Update frontend production env

Edit `apps/frontend/src/environments/environment.prod.ts`:

```ts
export const environment = {
  production: true,
  apiUrl: 'http://<external-ip-from-step-5>',
};
```

(HTTPS comes later via Load Balancer + managed SSL cert.)

### Step 8 — First deploy

Push to `main`. The CI workflow runs in order:

1. `lint-test` — Nx affected lint/test/build
2. `e2e` — Playwright
3. In parallel: `build-backend-image` (Docker build + push to Artifact Registry)
4. `deploy-backend` (SSH into VM, run `/opt/chatbot/deploy.sh`)
5. `deploy-frontend` (build Angular prod, rsync to GCS bucket)
6. `deploy-storybook` (build storybook, rsync to its bucket)

If everything passes, after ~5-8 minutes:
- Backend live at `http://<external-ip>`
- Frontend live at `https://storage.googleapis.com/spinochat-frontend-chatbot-franek-2026/index.html`
- Storybook live at `https://storage.googleapis.com/spinochat-storybook-chatbot-franek-2026/index.html`

### Step 9 — Verify and cleanup old infra

After live deploy succeeds:

```powershell
# Verify backend health
curl http://<external-ip>/health  # adjust path to whatever AppController exposes

# Tear down deprecated Cloud Run service
gcloud run services delete chatbot-backend --region=europe-west1

# Delete .firebaserc (no longer needed)
git rm .firebaserc
git commit -m "chore: remove Firebase config (replaced by GCS bucket)"
```

## Secret Manager secrets

All secrets are read by `vm-deploy.sh` via the VM runtime service account. The deploy degrades gracefully when a secret is absent (empty value returned, no abort).

| Secret name | What it holds | Created |
|---|---|---|
| `openrouter-api-key` | OpenRouter API key for LLM calls | Phase 3 |
| `database-url` | Cloud SQL `postgresql://…` connection string | Phase 3 |
| `tavily-api-key` | Tavily Search API key for `web_search` tool | **One-time task — see below** |

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

`vm-deploy.sh` reads the secret with `fetch_secret tavily-api-key 2>/dev/null || echo ""` — if the secret
does not exist yet, the deploy still succeeds and `web_search` returns its existing "Search unavailable:
TAVILY_API_KEY is not configured." message. The key activates search on the next deploy after the secret
is created, with no code change required.

## Deferred / next steps

- **HTTPS for backend**: HTTPS Load Balancer + managed SSL cert in front of the Compute VM (~30 min, separate cost)
- **Custom domain**: Same Load Balancer + DNS A record + managed cert
- **Cloud SQL Auth Proxy on VM**: Currently the VM connects to Cloud SQL over public IP with authorized-networks. Auth Proxy would be cleaner and more secure
- **Backup strategy**: Cloud SQL has automatic backups but no off-site copy. Could add scheduled export to GCS
- **Monitoring**: Cloud Logging is wired (VM SA has logWriter); add Cloud Monitoring uptime checks + alerting later
- **Compute autoscaling**: e2-micro is fine for v1.1 traffic. If it saturates, switch to instance group with autoscale, or move back to Cloud Run
