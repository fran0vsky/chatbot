#!/usr/bin/env bash
#
# One-time GCP setup for Plan 03 Task 2 (sections A + B).
# Automates: enable APIs, create Artifact Registry repo, create Secret Manager
# secret, create Cloud Run service, create WIF pool/provider, create deploy
# service account, grant roles, bind WIF principal.
#
# What this does NOT do (still needs the human + a browser):
#   - Firebase project creation + Hosting enable (Firebase Console)
#   - Firebase service account JSON download (Firebase Console)
#   - GitHub Actions repository variables + secrets (GitHub repo settings UI)
#
# Prerequisites:
#   - gcloud CLI installed and `gcloud auth login` already done
#   - GCP project already created (or pass your project ID below)
#   - OpenRouter API key in hand (https://openrouter.ai/keys)
#
# Usage:
#   1. Fill in the CONFIG block below.
#   2. chmod +x scripts/setup-gcp.sh
#   3. ./scripts/setup-gcp.sh
#   (PowerShell users: run inside Git Bash or WSL.)
#
# The script is idempotent — re-running skips anything that already exists.

set -euo pipefail

# ─── CONFIG — EDIT THESE ──────────────────────────────────────────────────────
PROJECT_ID=""              # e.g. chatbot-prod-12345
REGION="europe-west1"      # e.g. europe-west1, us-central1
GITHUB_REPO=""             # e.g. franek/chatbot — "org/repo" form
OPENROUTER_API_KEY=""      # paste your OpenRouter key here (consumed once, not stored)

# These are fine to leave as-is unless you want different names:
ARTIFACT_REPO="chatbot"
CLOUD_RUN_SERVICE="chatbot-backend"
SECRET_NAME="openrouter-api-key"
WIF_POOL="github-pool"
WIF_PROVIDER="github-provider"
DEPLOY_SA="github-deployer"
# ──────────────────────────────────────────────────────────────────────────────

# Validate config
for var in PROJECT_ID GITHUB_REPO OPENROUTER_API_KEY; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is empty — edit the CONFIG block at the top of this script." >&2
    exit 1
  fi
done

echo "▶ Setting active project to ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
echo "  project number = ${PROJECT_NUMBER}"

# ─── A2. Enable APIs ──────────────────────────────────────────────────────────
echo "▶ Enabling APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  iam.googleapis.com

# ─── A3. Artifact Registry Docker repo ────────────────────────────────────────
echo "▶ Creating Artifact Registry repo '${ARTIFACT_REPO}' in ${REGION}"
if gcloud artifacts repositories describe "${ARTIFACT_REPO}" --location="${REGION}" >/dev/null 2>&1; then
  echo "  already exists, skipping"
else
  gcloud artifacts repositories create "${ARTIFACT_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Chatbot backend images"
fi

# ─── A4. Secret Manager secret 'openrouter-api-key' ───────────────────────────
echo "▶ Creating Secret Manager secret '${SECRET_NAME}'"
if gcloud secrets describe "${SECRET_NAME}" >/dev/null 2>&1; then
  echo "  secret already exists — adding a new version"
  printf '%s' "${OPENROUTER_API_KEY}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=-
else
  printf '%s' "${OPENROUTER_API_KEY}" | gcloud secrets create "${SECRET_NAME}" \
    --replication-policy=automatic \
    --data-file=-
fi

# ─── A6. Grant secretAccessor to Cloud Run runtime service account ────────────
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "▶ Granting roles/secretmanager.secretAccessor on '${SECRET_NAME}' to ${RUNTIME_SA}"
gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role=roles/secretmanager.secretAccessor \
  --condition=None

# ─── A5. Cloud Run service (placeholder image; CI overwrites on first deploy) ─
echo "▶ Creating Cloud Run service '${CLOUD_RUN_SERVICE}' in ${REGION}"
if gcloud run services describe "${CLOUD_RUN_SERVICE}" --region="${REGION}" >/dev/null 2>&1; then
  echo "  already exists, skipping initial create"
else
  gcloud run deploy "${CLOUD_RUN_SERVICE}" \
    --image=gcr.io/cloudrun/hello \
    --region="${REGION}" \
    --allow-unauthenticated \
    --port=3000
fi

CLOUD_RUN_URL=$(gcloud run services describe "${CLOUD_RUN_SERVICE}" --region="${REGION}" --format='value(status.url)')
echo "  Cloud Run URL = ${CLOUD_RUN_URL}"

# ─── B1. Create github-deployer service account ───────────────────────────────
DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "▶ Creating service account ${DEPLOY_SA_EMAIL}"
if gcloud iam service-accounts describe "${DEPLOY_SA_EMAIL}" >/dev/null 2>&1; then
  echo "  already exists, skipping"
else
  gcloud iam service-accounts create "${DEPLOY_SA}" \
    --display-name="GitHub Actions deployer"
fi

# ─── B2. Grant roles to github-deployer ───────────────────────────────────────
echo "▶ Granting deploy roles to ${DEPLOY_SA_EMAIL}"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="${role}" \
    --condition=None >/dev/null
  echo "  granted ${role}"
done

# Allow github-deployer to act as the Cloud Run runtime SA (needed by deploy-cloudrun)
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role=roles/iam.serviceAccountUser \
  --condition=None >/dev/null

# ─── B3. Workload Identity Federation pool + OIDC provider ────────────────────
echo "▶ Creating WIF pool '${WIF_POOL}'"
if gcloud iam workload-identity-pools describe "${WIF_POOL}" --location=global >/dev/null 2>&1; then
  echo "  already exists, skipping"
else
  gcloud iam workload-identity-pools create "${WIF_POOL}" \
    --location=global \
    --display-name="GitHub Actions pool"
fi

echo "▶ Creating WIF OIDC provider '${WIF_PROVIDER}' (restricted to repo ${GITHUB_REPO})"
if gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER}" \
    --workload-identity-pool="${WIF_POOL}" --location=global >/dev/null 2>&1; then
  echo "  already exists, skipping"
else
  gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER}" \
    --workload-identity-pool="${WIF_POOL}" \
    --location=global \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.ref=assertion.ref" \
    --attribute-condition="attribute.repository == '${GITHUB_REPO}'"
fi

WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"

# ─── B4. Bind WIF principal to github-deployer ────────────────────────────────
WIF_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}"
echo "▶ Binding ${WIF_PRINCIPAL} as workloadIdentityUser on ${DEPLOY_SA_EMAIL}"
gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA_EMAIL}" \
  --member="${WIF_PRINCIPAL}" \
  --role=roles/iam.workloadIdentityUser \
  --condition=None >/dev/null

# ─── F. Final summary — copy these into GitHub Actions ────────────────────────
cat <<EOF

═══════════════════════════════════════════════════════════════════════════════
  GCP SETUP COMPLETE
═══════════════════════════════════════════════════════════════════════════════

Add these as REPOSITORY VARIABLES in GitHub
(Settings → Secrets and variables → Actions → Variables tab):

  GCP_PROJECT_ID          = ${PROJECT_ID}
  GCP_REGION              = ${REGION}
  GCP_ARTIFACT_REPO       = ${ARTIFACT_REPO}
  GCP_WIF_PROVIDER        = ${WIF_PROVIDER_RESOURCE}
  GCP_WIF_SERVICE_ACCOUNT = ${DEPLOY_SA_EMAIL}
  CLOUD_RUN_SERVICE       = ${CLOUD_RUN_SERVICE}

Add as REPOSITORY SECRETS (Secrets tab):

  OPENROUTER_API_KEY      = <your OpenRouter key — same value as the secret you just stored>

──────────────────────────────────────────────────────────────────────────────
  STILL TO DO MANUALLY (Firebase Console — sections C–E of Task 2):
──────────────────────────────────────────────────────────────────────────────

  1. https://console.firebase.google.com → Add project (attach to GCP project '${PROJECT_ID}' is recommended).
  2. Hosting → Get started → finish wizard (enable Hosting).
  3. Project settings → Service accounts → Generate new private key → save the JSON.
  4. Note your Firebase Hosting URL (https://<firebase-project-id>.web.app).
  5. Update local repo files:
       - .firebaserc        → replace REPLACE_WITH_FIREBASE_PROJECT_ID
       - apps/frontend/src/environments/environment.prod.ts
                            → replace YOUR_CLOUD_RUN_URL with: ${CLOUD_RUN_URL}
  6. Add to GitHub VARIABLES:
       FIREBASE_PROJECT_ID  = <your firebase project id>
       FIREBASE_HOSTING_URL = https://<firebase-project-id>.web.app
  7. Add to GitHub SECRETS:
       FIREBASE_SERVICE_ACCOUNT = <paste the entire JSON blob from step 3>

══════════════════════════════════════════════════════════════════════════════
EOF
