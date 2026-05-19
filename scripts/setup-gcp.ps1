# One-time GCP setup for Plan 03 Task 2 (sections A + B).
# PowerShell version — run from Windows PowerShell or pwsh.
#
# What this does NOT do (still needs the human + a browser):
#   - Firebase project creation + Hosting enable (Firebase Console)
#   - Firebase service account JSON download (Firebase Console)
#   - GitHub Actions repository variables + secrets (GitHub repo settings UI)
#
# Prerequisites:
#   - gcloud CLI installed and `gcloud auth login` already done
#   - GCP project already created
#   - OpenRouter API key in hand (https://openrouter.ai/keys)
#
# Usage:
#   1. Fill in the CONFIG block below.
#   2. .\scripts\setup-gcp.ps1
#
# Idempotent — re-running skips anything that already exists.

$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false

# --- CONFIG - EDIT THESE -----------------------------------------------------
$ProjectId        = 'chatbot-franek-2026'               # e.g. chatbot-prod-12345
$Region           = 'europe-west1'   # e.g. europe-west1, us-central1
$GithubRepo       = 'fran0vsky/chatbot'               # e.g. franek/chatbot - "org/repo" form
$OpenRouterApiKey = ''               # leave empty - auto-loaded from the git-ignored .env file below

# Fine to leave as-is:
$ArtifactRepo    = 'chatbot'
$CloudRunService = 'chatbot-backend'
$SecretName      = 'openrouter-api-key'
$WifPool         = 'github-pool'
$WifProvider     = 'github-provider'
$DeploySa        = 'github-deployer'
# -----------------------------------------------------------------------------

# Load OpenRouter key from the git-ignored .env file (never hardcode it here).
if ([string]::IsNullOrWhiteSpace($OpenRouterApiKey)) {
    $envFile = Join-Path $PSScriptRoot '..\.env'
    if (Test-Path $envFile) {
        $line = Get-Content $envFile | Where-Object { $_ -match '^\s*OPENROUTER_API_KEY\s*=' } | Select-Object -First 1
        if ($line) { $OpenRouterApiKey = ($line -split '=', 2)[1].Trim() }
    }
}

foreach ($pair in @(
    @{ Name = 'ProjectId'; Value = $ProjectId },
    @{ Name = 'GithubRepo'; Value = $GithubRepo },
    @{ Name = 'OpenRouterApiKey'; Value = $OpenRouterApiKey }
)) {
    if ([string]::IsNullOrWhiteSpace($pair.Value)) {
        Write-Error "$($pair.Name) is empty - edit the CONFIG block at the top of this script."
        exit 1
    }
}

Write-Host "> Setting active project to $ProjectId"
gcloud config set project $ProjectId | Out-Null

$ProjectNumber = (gcloud projects describe $ProjectId --format='value(projectNumber)').Trim()
Write-Host "  project number = $ProjectNumber"

# --- A2. Enable APIs ---------------------------------------------------------
Write-Host '> Enabling APIs'
gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    secretmanager.googleapis.com `
    iamcredentials.googleapis.com `
    iam.googleapis.com

# --- A3. Artifact Registry Docker repo ---------------------------------------
Write-Host "> Creating Artifact Registry repo '$ArtifactRepo' in $Region"
gcloud artifacts repositories describe $ArtifactRepo --location=$Region 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  already exists, skipping'
} else {
    gcloud artifacts repositories create $ArtifactRepo `
        --repository-format=docker `
        --location=$Region `
        --description='Chatbot backend images'
}

# --- A4. Secret Manager secret 'openrouter-api-key' --------------------------
Write-Host "> Creating Secret Manager secret '$SecretName'"
gcloud secrets describe $SecretName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  secret already exists - adding a new version'
    $tmp = New-TemporaryFile
    Set-Content -Path $tmp -Value $OpenRouterApiKey -NoNewline
    gcloud secrets versions add $SecretName --data-file=$tmp
    Remove-Item $tmp
} else {
    $tmp = New-TemporaryFile
    Set-Content -Path $tmp -Value $OpenRouterApiKey -NoNewline
    gcloud secrets create $SecretName `
        --replication-policy=automatic `
        --data-file=$tmp
    Remove-Item $tmp
}

# --- A6. Grant secretAccessor to Cloud Run runtime service account -----------
$RuntimeSa = "$ProjectNumber-compute@developer.gserviceaccount.com"
Write-Host "> Granting roles/secretmanager.secretAccessor on '$SecretName' to $RuntimeSa"
gcloud secrets add-iam-policy-binding $SecretName `
    --member="serviceAccount:$RuntimeSa" `
    --role=roles/secretmanager.secretAccessor `
    --condition=None | Out-Null

# --- A5. Cloud Run service (placeholder image; CI overwrites on first deploy) -
Write-Host "> Creating Cloud Run service '$CloudRunService' in $Region"
gcloud run services describe $CloudRunService --region=$Region 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  already exists, skipping initial create'
} else {
    gcloud run deploy $CloudRunService `
        --image=gcr.io/cloudrun/hello `
        --region=$Region `
        --allow-unauthenticated `
        --port=3000
}

$CloudRunUrl = (gcloud run services describe $CloudRunService --region=$Region --format='value(status.url)').Trim()
Write-Host "  Cloud Run URL = $CloudRunUrl"

# --- B1. Create github-deployer service account ------------------------------
$DeploySaEmail = "$DeploySa@$ProjectId.iam.gserviceaccount.com"
Write-Host "> Creating service account $DeploySaEmail"
gcloud iam service-accounts describe $DeploySaEmail 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  already exists, skipping'
} else {
    gcloud iam service-accounts create $DeploySa `
        --display-name='GitHub Actions deployer'
}

# --- B2. Grant roles to github-deployer --------------------------------------
Write-Host "> Granting deploy roles to $DeploySaEmail"
foreach ($role in @('roles/run.admin', 'roles/artifactregistry.writer', 'roles/iam.serviceAccountUser')) {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$DeploySaEmail" `
        --role=$role `
        --condition=None | Out-Null
    Write-Host "  granted $role"
}

gcloud iam service-accounts add-iam-policy-binding $RuntimeSa `
    --member="serviceAccount:$DeploySaEmail" `
    --role=roles/iam.serviceAccountUser `
    --condition=None | Out-Null

# --- B3. Workload Identity Federation pool + OIDC provider -------------------
Write-Host "> Creating WIF pool '$WifPool'"
gcloud iam workload-identity-pools describe $WifPool --location=global 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  already exists, skipping'
} else {
    gcloud iam workload-identity-pools create $WifPool `
        --location=global `
        --display-name='GitHub Actions pool'
}

Write-Host "> Creating WIF OIDC provider '$WifProvider' (restricted to repo $GithubRepo)"
gcloud iam workload-identity-pools providers describe $WifProvider `
    --workload-identity-pool=$WifPool --location=global 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  already exists, skipping'
} else {
    gcloud iam workload-identity-pools providers create-oidc $WifProvider `
        --workload-identity-pool=$WifPool `
        --location=global `
        --issuer-uri='https://token.actions.githubusercontent.com' `
        --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.ref=assertion.ref' `
        --attribute-condition="attribute.repository == '$GithubRepo'"
}

$WifProviderResource = "projects/$ProjectNumber/locations/global/workloadIdentityPools/$WifPool/providers/$WifProvider"

# --- B4. Bind WIF principal to github-deployer -------------------------------
$WifPrincipal = "principalSet://iam.googleapis.com/projects/$ProjectNumber/locations/global/workloadIdentityPools/$WifPool/attribute.repository/$GithubRepo"
Write-Host "> Binding $WifPrincipal as workloadIdentityUser on $DeploySaEmail"
gcloud iam service-accounts add-iam-policy-binding $DeploySaEmail `
    --member=$WifPrincipal `
    --role=roles/iam.workloadIdentityUser `
    --condition=None | Out-Null

# --- Final summary -----------------------------------------------------------
Write-Host ''
Write-Host '==============================================================================='
Write-Host '  GCP SETUP COMPLETE'
Write-Host '==============================================================================='
Write-Host ''
Write-Host 'Add these as REPOSITORY VARIABLES in GitHub'
Write-Host '(Settings -> Secrets and variables -> Actions -> Variables tab):'
Write-Host ''
Write-Host "  GCP_PROJECT_ID          = $ProjectId"
Write-Host "  GCP_REGION              = $Region"
Write-Host "  GCP_ARTIFACT_REPO       = $ArtifactRepo"
Write-Host "  GCP_WIF_PROVIDER        = $WifProviderResource"
Write-Host "  GCP_WIF_SERVICE_ACCOUNT = $DeploySaEmail"
Write-Host "  CLOUD_RUN_SERVICE       = $CloudRunService"
Write-Host ''
Write-Host 'Add as REPOSITORY SECRETS (Secrets tab):'
Write-Host ''
Write-Host '  OPENROUTER_API_KEY      = <your OpenRouter key>'
Write-Host ''
Write-Host '-------------------------------------------------------------------------------'
Write-Host '  STILL TO DO MANUALLY (Firebase Console - sections C-E of Task 2):'
Write-Host '-------------------------------------------------------------------------------'
Write-Host ''
Write-Host "  1. https://console.firebase.google.com -> Add project (attach to GCP '$ProjectId' is recommended)."
Write-Host '  2. Hosting -> Get started -> finish wizard (enable Hosting).'
Write-Host '  3. Project settings -> Service accounts -> Generate new private key -> save the JSON.'
Write-Host '  4. Note your Firebase Hosting URL (https://<firebase-project-id>.web.app).'
Write-Host '  5. Update local repo files:'
Write-Host '       - .firebaserc        -> replace REPLACE_WITH_FIREBASE_PROJECT_ID'
Write-Host '       - apps/frontend/src/environments/environment.prod.ts'
Write-Host "                            -> replace YOUR_CLOUD_RUN_URL with: $CloudRunUrl"
Write-Host '  6. Add to GitHub VARIABLES:'
Write-Host '       FIREBASE_PROJECT_ID  = <your firebase project id>'
Write-Host '       FIREBASE_HOSTING_URL = https://<firebase-project-id>.web.app'
Write-Host '  7. Add to GitHub SECRETS:'
Write-Host '       FIREBASE_SERVICE_ACCOUNT = <paste the entire JSON blob from step 3>'
Write-Host ''
Write-Host '==============================================================================='
