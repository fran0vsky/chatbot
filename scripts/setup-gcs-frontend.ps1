# One-time GCS setup for hosting the Angular frontend (replaces Firebase Hosting).
# Idempotent — re-runnable.
#
# Provisions:
#   - GCS bucket 'spinochat-frontend-<project>' (uniformly public-read for HTTP serving)
#   - Static website hosting config (index.html as main page, index.html as 404 too — SPA)
#   - Bucket-level IAM allUsers:objectViewer for public access
#   - (Optional) Cloud CDN + Load Balancer for HTTPS + custom domain — add later
#
# Also creates a sister bucket for Storybook:
#   - 'spinochat-storybook-<project>'
#
# Prerequisites:
#   - gcloud authenticated
#   - GCP project ready
#
# Usage:
#   .\scripts\setup-gcs-frontend.ps1

$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false

# --- CONFIG ------------------------------------------------------------------
$ProjectId       = 'chatbot-franek-2026'
$Region          = 'europe-west1'
$FrontendBucket  = 'spinochat-frontend-chatbot-franek-2026'
$StorybookBucket = 'spinochat-storybook-chatbot-franek-2026'
# -----------------------------------------------------------------------------

gcloud config set project $ProjectId | Out-Null

function New-PublicBucket {
    param (
        [string]$Name,
        [string]$Region
    )

    Write-Host "> Bucket: $Name"
    gcloud storage buckets describe "gs://$Name" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host '  already exists, skipping create'
    } else {
        # Standard storage class, uniform bucket-level access, in our region
        gcloud storage buckets create "gs://$Name" `
            --location=$Region `
            --uniform-bucket-level-access `
            --default-storage-class=STANDARD
    }

    Write-Host '  enabling website serving (index.html / 404 fallback to index.html for SPA)'
    gcloud storage buckets update "gs://$Name" `
        --web-main-page-suffix=index.html `
        --web-error-page=index.html | Out-Null

    Write-Host '  granting public read (allUsers:objectViewer)'
    gcloud storage buckets add-iam-policy-binding "gs://$Name" `
        --member=allUsers `
        --role=roles/storage.objectViewer | Out-Null
}

New-PublicBucket -Name $FrontendBucket  -Region $Region
New-PublicBucket -Name $StorybookBucket -Region $Region

# --- Grant the github-deployer service account write access to both buckets --
$DeploySa = "github-deployer@$ProjectId.iam.gserviceaccount.com"

Write-Host "> Granting storage.objectAdmin to $DeploySa on both buckets"
foreach ($bucket in @($FrontendBucket, $StorybookBucket)) {
    gcloud storage buckets add-iam-policy-binding "gs://$bucket" `
        --member="serviceAccount:$DeploySa" `
        --role=roles/storage.objectAdmin | Out-Null
}

# --- Summary -----------------------------------------------------------------
Write-Host ''
Write-Host '==============================================================================='
Write-Host '  GCS FRONTEND + STORYBOOK BUCKETS READY'
Write-Host '==============================================================================='
Write-Host ''
Write-Host "  Frontend bucket:  gs://$FrontendBucket"
Write-Host "  Public URL:       https://storage.googleapis.com/$FrontendBucket/index.html"
Write-Host ''
Write-Host "  Storybook bucket: gs://$StorybookBucket"
Write-Host "  Public URL:       https://storage.googleapis.com/$StorybookBucket/index.html"
Write-Host ''
Write-Host '  NOTE: These URLs serve over storage.googleapis.com with no custom domain.'
Write-Host '        For a clean URL (e.g. spinochat.app), provision a Load Balancer +'
Write-Host '        managed SSL cert + Cloud CDN later. The buckets work for now.'
Write-Host ''
Write-Host '  --- ADD TO GITHUB ACTIONS REPOSITORY VARIABLES ---'
Write-Host '  (Names match what .github/workflows/ci.yml already expects.)'
Write-Host "  FRONTEND_BUCKET    = $FrontendBucket"
Write-Host "  STORYBOOK_BUCKET   = $StorybookBucket"
Write-Host "  FRONTEND_URL       = https://storage.googleapis.com/$FrontendBucket/index.html"
Write-Host ''
Write-Host '==============================================================================='
