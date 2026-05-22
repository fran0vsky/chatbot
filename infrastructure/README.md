# Infrastructure

One-time GCP setup and reference for the Chatbot monorepo.

## Architecture

| Component  | Service                          | Notes                              |
|------------|----------------------------------|------------------------------------|
| Backend    | GCE VM (Docker container)        | Deployed via SSH on every main push |
| Frontend   | GCS static bucket                | Angular SPA                        |
| Storybook  | GCS static bucket                | Deployed after every frontend deploy |
| Database   | Cloud SQL PostgreSQL 16          | Private IP, accessed from VM       |
| Images     | Artifact Registry                | Tagged by git SHA + `latest`       |
| Secrets    | Secret Manager                   | Pulled by VM at deploy time        |

## First-time setup

### 1. Provision all GCP resources

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
export GCE_ZONE=us-central1-a
export DB_PASSWORD=choose-a-strong-password
export OPENROUTER_API_KEY=sk-or-...

bash infrastructure/provision-gcp.sh
```

Creates: GCE VM, GCS buckets, Cloud SQL instance, Artifact Registry repo,
Secret Manager secrets, and two service accounts (VM + CI).

### 2. Bootstrap the VM

Copy the setup script to the newly created VM and run it:

```bash
gcloud compute scp infrastructure/setup-gce.sh \
  $GCE_INSTANCE:/tmp/setup-gce.sh --zone=$GCE_ZONE

gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE \
  --command="sudo bash /tmp/setup-gce.sh"
```

This installs Docker and places `/opt/chatbot/deploy.sh` on the VM.
The deploy script is called by CI on every push to `main`.

### 3. Set up Workload Identity Federation

Follow the [WIF setup guide](https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account)
and bind it to the `chatbot-ci@PROJECT_ID.iam.gserviceaccount.com` service account.

### 4. Configure GitHub Actions

Go to **Settings → Secrets and variables → Actions** and add:

**Variables (`vars.*`):**

| Name                    | Value                                               |
|-------------------------|-----------------------------------------------------|
| `GCP_PROJECT_ID`        | your GCP project ID                                 |
| `GCP_REGION`            | e.g. `us-central1`                                  |
| `GCP_ARTIFACT_REPO`     | `chatbot`                                           |
| `GCE_INSTANCE`          | `chatbot-backend`                                   |
| `GCE_ZONE`              | e.g. `us-central1-a`                                |
| `FRONTEND_BUCKET`       | `PROJECT_ID-frontend`                               |
| `STORYBOOK_BUCKET`      | `PROJECT_ID-storybook`                              |
| `FRONTEND_URL`          | `https://storage.googleapis.com/PROJECT_ID-frontend` |
| `GCP_WIF_PROVIDER`      | from WIF setup                                      |
| `GCP_WIF_SERVICE_ACCOUNT` | `chatbot-ci@PROJECT_ID.iam.gserviceaccount.com`   |

**Secrets (`secrets.*`):**

| Name                | Purpose                   |
|---------------------|---------------------------|
| `OPENROUTER_API_KEY` | E2E tests (not deployed — backend reads from Secret Manager) |

**Remove old variables** (no longer used):
`CLOUD_RUN_SERVICE`, `FIREBASE_HOSTING_URL`, `FIREBASE_PROJECT_ID`

---

## CI/CD flow

```
push to main
  │
  ├─ lint-test ──────────────────────────────────┐
  │      │                                        │
  │      ├─► e2e ────────────────────────────────┤
  │      │       │                                │
  │      │       ├─► deploy-frontend              │
  │      │       │       └─► deploy-storybook     │
  │      │       │                                │
  │      │       └─► deploy-backend ◄─────────────┘
  │      │                 (needs e2e + image push)
  │      │
  │      └─► build-backend-image (parallel with e2e)
  │
  └─ (PRs: lint-test + e2e only, no deploy)
```

---

## SPA routing on GCS

GCS is configured with `--web-error-page=index.html`, so all 404s serve
`index.html` content — Angular's router takes over client-side.
The response status is 404 rather than 200, which works in practice but
is not spec-correct.

**For a custom domain with HTTPS and clean routing**, add a
[Cloud Load Balancer](https://cloud.google.com/load-balancing/docs/https/ext-load-balancer-backend-buckets)
in front of the GCS backend bucket. This costs ~$18/month for the
forwarding rule alone.

---

## Database

The backend connects to Cloud SQL via **private IP** inside the default VPC.
The `DATABASE_URL` secret is fetched from Secret Manager by the deploy script
at container start time.

**Local access** (for migrations / psql):

```bash
# Option A — direct psql via Cloud SQL Auth Proxy
./cloud-sql-proxy PROJECT_ID:REGION:chatbot-db
psql "host=127.0.0.1 port=5432 dbname=chatbot user=chatbot"

# Option B — gcloud interactive shell
gcloud sql connect chatbot-db --user=chatbot --database=chatbot
```

**Rotate the database password:**

```bash
gcloud sql users set-password chatbot \
  --instance=chatbot-db --password=NEW_PASSWORD

NEW_URL="postgresql://chatbot:NEW_PASSWORD@SQL_IP:5432/chatbot"
echo -n "$NEW_URL" | gcloud secrets versions add database-url --data-file=-
```

---

## Rotating the OpenRouter API key

```bash
echo -n "sk-or-new-key" | \
  gcloud secrets versions add openrouter-api-key --data-file=-
```

The next deploy will pick up the new version automatically.
To apply immediately without a redeploy, SSH in and restart the container:

```bash
gcloud compute ssh chatbot-backend --zone=ZONE \
  --command="bash /opt/chatbot/deploy.sh \
    \$(docker inspect chatbot-backend --format='{{.Config.Image}}') \
    FRONTEND_URL"
```
