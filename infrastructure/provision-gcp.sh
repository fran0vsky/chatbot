#!/usr/bin/env bash
# One-time GCP resource provisioning for the Chatbot project.
# Prerequisites: gcloud CLI authenticated as project owner/editor.
#
# Usage:
#   export GCP_PROJECT_ID=your-project-id
#   export DB_PASSWORD=choose-a-strong-password
#   export OPENROUTER_API_KEY=sk-or-...
#   bash infrastructure/provision-gcp.sh
set -euo pipefail

# ── Configuration (override via env vars) ────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Please set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${GCE_ZONE:-us-central1-a}"
INSTANCE_NAME="${GCE_INSTANCE:-chatbot-backend}"
MACHINE_TYPE="${GCE_MACHINE_TYPE:-e2-small}"
ARTIFACT_REPO="${GCP_ARTIFACT_REPO:-chatbot}"
FRONTEND_BUCKET="${FRONTEND_BUCKET:-${PROJECT_ID}-frontend}"
STORYBOOK_BUCKET="${STORYBOOK_BUCKET:-${PROJECT_ID}-storybook}"
AVATAR_BUCKET="${AVATAR_BUCKET:-${PROJECT_ID}-dino-avatars}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-chatbot-db}"
DB_NAME="${DB_NAME:-chatbot}"
DB_USER="${DB_USER:-chatbot}"
DB_PASSWORD="${DB_PASSWORD:?Please set DB_PASSWORD}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:?Please set OPENROUTER_API_KEY}"

gcloud config set project "$PROJECT_ID"

# ── Enable required APIs ──────────────────────────────────────────────────────
echo "==> Enabling APIs..."
gcloud services enable \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  oslogin.googleapis.com

# ── Artifact Registry ─────────────────────────────────────────────────────────
echo "==> Artifact Registry..."
gcloud artifacts repositories create "$ARTIFACT_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Chatbot backend Docker images" 2>/dev/null \
  || echo "    (already exists, skipping)"

# ── VM service account ────────────────────────────────────────────────────────
echo "==> VM service account..."
VM_SA_NAME="chatbot-vm"
VM_SA_EMAIL="${VM_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$VM_SA_NAME" \
  --display-name="Chatbot GCE VM" 2>/dev/null \
  || echo "    (already exists, skipping)"

for role in \
  roles/artifactregistry.reader \
  roles/secretmanager.secretAccessor \
  roles/storage.objectAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${VM_SA_EMAIL}" \
    --role="$role" --quiet
done

# ── GCE VM ────────────────────────────────────────────────────────────────────
echo "==> GCE VM (${INSTANCE_NAME}, ${MACHINE_TYPE})..."
gcloud compute instances create "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_TYPE" \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --service-account="$VM_SA_EMAIL" \
  --scopes=cloud-platform \
  --tags=chatbot-backend \
  --metadata=enable-oslogin=TRUE \
  --boot-disk-size=20GB 2>/dev/null \
  || echo "    (already exists, skipping)"

# Allow inbound traffic on port 3000 from the internet.
# Restrict to a load-balancer IP range in production.
gcloud compute firewall-rules create allow-chatbot-backend \
  --allow=tcp:3000 \
  --target-tags=chatbot-backend \
  --description="Chatbot backend port" 2>/dev/null \
  || echo "    (firewall rule already exists, skipping)"

# ── GCS buckets (frontend + storybook) ───────────────────────────────────────
echo "==> GCS buckets..."
for BUCKET in "$FRONTEND_BUCKET" "$STORYBOOK_BUCKET"; do
  gcloud storage buckets create "gs://${BUCKET}" \
    --location="$REGION" \
    --uniform-bucket-level-access 2>/dev/null \
    || echo "    gs://${BUCKET} already exists, skipping creation"

  # Public read access
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member=allUsers \
    --role=roles/storage.objectViewer --quiet

  # Static website config: 404 falls back to index.html for Angular SPA routing
  gcloud storage buckets update "gs://${BUCKET}" \
    --web-main-page-suffix=index.html \
    --web-error-page=index.html
done

# ── GCS avatars bucket (Phase 42-02) ─────────────────────────────────────────
# Public-read, uniform-bucket-level-access — avatars are NOT an SPA, so no
# static-website config is applied.  The VM SA is granted objectAdmin above so
# the running backend can upload objects via ADC (no key file needed).
echo "==> Avatars bucket..."
gcloud storage buckets create "gs://${AVATAR_BUCKET}" \
  --location="$REGION" \
  --uniform-bucket-level-access 2>/dev/null \
  || echo "    gs://${AVATAR_BUCKET} already exists, skipping creation"

# Public read access — anyone can fetch avatar images via their public URL
gcloud storage buckets add-iam-policy-binding "gs://${AVATAR_BUCKET}" \
  --member=allUsers \
  --role=roles/storage.objectViewer --quiet

# ── Cloud SQL (PostgreSQL 16) ─────────────────────────────────────────────────
echo "==> Cloud SQL instance (this takes ~5 minutes)..."
gcloud sql instances create "$CLOUD_SQL_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-auto-increase \
  --storage-size=10GB 2>/dev/null \
  || echo "    (already exists, skipping)"

gcloud sql databases create "$DB_NAME" \
  --instance="$CLOUD_SQL_INSTANCE" 2>/dev/null \
  || echo "    (database already exists, skipping)"

gcloud sql users create "$DB_USER" \
  --instance="$CLOUD_SQL_INSTANCE" \
  --password="$DB_PASSWORD" 2>/dev/null \
  || gcloud sql users set-password "$DB_USER" \
       --instance="$CLOUD_SQL_INSTANCE" \
       --password="$DB_PASSWORD"

SQL_IP=$(gcloud sql instances describe "$CLOUD_SQL_INSTANCE" \
  --format='value(ipAddresses[0].ipAddress)')
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${SQL_IP}:5432/${DB_NAME}"

# ── Secret Manager ────────────────────────────────────────────────────────────
echo "==> Secret Manager..."
store_secret() {
  local NAME="$1"
  local VALUE="$2"
  if gcloud secrets describe "$NAME" &>/dev/null; then
    echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=-
    echo "    Updated secret: $NAME"
  else
    echo -n "$VALUE" | gcloud secrets create "$NAME" --data-file=-
    echo "    Created secret: $NAME"
  fi
}

store_secret "openrouter-api-key" "$OPENROUTER_API_KEY"
store_secret "database-url"       "$DATABASE_URL"

# ── CI service account (used by GitHub Actions via WIF) ──────────────────────
echo "==> CI service account..."
CI_SA_NAME="chatbot-ci"
CI_SA_EMAIL="${CI_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$CI_SA_NAME" \
  --display-name="Chatbot GitHub Actions CI" 2>/dev/null \
  || echo "    (already exists, skipping)"

for role in \
  roles/artifactregistry.writer \
  roles/storage.objectAdmin \
  roles/compute.osLogin \
  roles/compute.instanceAdmin.v1 \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${CI_SA_EMAIL}" \
    --role="$role" --quiet
done

# ── Summary ───────────────────────────────────────────────────────────────────
VM_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
  --zone="$ZONE" --format='value(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null || echo "pending")

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Provisioning complete."
echo ""
echo "Next steps:"
echo "  1. Bootstrap the VM:"
echo "     gcloud compute scp infrastructure/setup-gce.sh ${INSTANCE_NAME}:/tmp/ --zone=${ZONE}"
echo "     gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command='sudo bash /tmp/setup-gce.sh'"
echo ""
echo "  2. Set up Workload Identity Federation for GitHub Actions:"
echo "     https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account"
echo "     Service account to bind: ${CI_SA_EMAIL}"
echo ""
echo "  3. Add these variables in GitHub → Settings → Secrets and variables → Actions:"
echo ""
echo "     Variables (vars.*):"
echo "       GCP_PROJECT_ID     = ${PROJECT_ID}"
echo "       GCP_REGION         = ${REGION}"
echo "       GCP_ARTIFACT_REPO  = ${ARTIFACT_REPO}"
echo "       GCE_INSTANCE       = ${INSTANCE_NAME}"
echo "       GCE_ZONE           = ${ZONE}"
echo "       FRONTEND_BUCKET    = ${FRONTEND_BUCKET}"
echo "       STORYBOOK_BUCKET   = ${STORYBOOK_BUCKET}"
echo "       AVATAR_BUCKET      = ${AVATAR_BUCKET}"
echo "       FRONTEND_URL       = https://storage.googleapis.com/${FRONTEND_BUCKET}"
echo "       GCP_WIF_PROVIDER   = (from WIF setup above)"
echo "       GCP_WIF_SERVICE_ACCOUNT = ${CI_SA_EMAIL}"
echo ""
echo "     Secrets (secrets.*):"
echo "       OPENROUTER_API_KEY = (for e2e tests)"
echo ""
echo "     Remove old variables: CLOUD_RUN_SERVICE, FIREBASE_HOSTING_URL, FIREBASE_PROJECT_ID"
echo ""
echo "  VM public IP: ${VM_IP}:3000"
echo "  Frontend:     https://storage.googleapis.com/${FRONTEND_BUCKET}/index.html"
echo "  Storybook:    https://storage.googleapis.com/${STORYBOOK_BUCKET}/index.html"
echo "════════════════════════════════════════════════════════════════"
