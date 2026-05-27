# One-time Compute Engine setup for SpinoChat backend.
# Replaces Cloud Run per mentor's "Cloud Compute" guidance.
#
# Variable names align with .github/workflows/ci.yml expectations:
#   GCE_INSTANCE, GCE_ZONE, GCP_PROJECT_ID, GCP_REGION
#
# Provisions:
#   - e2-micro VM 'spinochat-backend' (free tier: 1 instance/month in US regions)
#   - Container-Optimized OS image (Docker pre-installed)
#   - Static external IP reservation
#   - Firewall rule to allow HTTP traffic
#   - VM service account with secret/registry/logging access
#   - /opt/chatbot/deploy.sh on the VM (CI invokes it over SSH)
#
# Free tier note:
#   - e2-micro is free ONLY in us-west1 / us-central1 / us-east1
#   - For europe-west1 we'd use e2-small at ~$13/month
#   - Switch $UseFreeRegion below if you want EU latency
#
# Prerequisites:
#   - gcloud authenticated
#   - scripts/setup-gcp.ps1 already ran (Artifact Registry, secrets, WIF)
#   - scripts/setup-postgres.ps1 already ran (database-url secret)
#
# Usage:
#   .\scripts\setup-compute.ps1

$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false

# --- CONFIG ------------------------------------------------------------------
$ProjectId      = 'chatbot-franek-2026'
$UseFreeRegion  = $true  # $true = us-central1 (free), $false = europe-west1 (paid, low EU latency)
$VmName         = 'spinochat-backend'
$VmServiceAcct  = 'compute-runtime'
$FirewallTag    = 'spinochat-backend'
# -----------------------------------------------------------------------------

$Region = if ($UseFreeRegion) { 'us-central1' } else { 'europe-west1' }
$Zone   = if ($UseFreeRegion) { 'us-central1-a' } else { 'europe-west1-b' }
$Tier   = if ($UseFreeRegion) { 'e2-micro' } else { 'e2-small' }

gcloud config set project $ProjectId | Out-Null

Write-Host '> Enabling Compute Engine API'
gcloud services enable compute.googleapis.com

# --- VM service account ------------------------------------------------------
$VmSaEmail = "$VmServiceAcct@$ProjectId.iam.gserviceaccount.com"
Write-Host "> Creating service account $VmSaEmail"
gcloud iam service-accounts describe $VmSaEmail 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  already exists, skipping'
} else {
    gcloud iam service-accounts create $VmServiceAcct `
        --display-name='Compute Engine runtime for SpinoChat backend'
}

Write-Host '> Granting Secret Manager + Artifact Registry + Logging roles to VM SA'
foreach ($role in @('roles/secretmanager.secretAccessor', 'roles/artifactregistry.reader', 'roles/logging.logWriter')) {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$VmSaEmail" `
        --role=$role `
        --condition=None | Out-Null
}

# --- Static external IP ------------------------------------------------------
Write-Host '> Reserving static external IP'
gcloud compute addresses describe spinochat-backend-ip --region=$Region 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  IP already reserved, skipping'
} else {
    gcloud compute addresses create spinochat-backend-ip --region=$Region
}
$ExternalIp = (gcloud compute addresses describe spinochat-backend-ip --region=$Region --format='value(address)').Trim()
Write-Host "  static IP = $ExternalIp"

# --- Firewall rule -----------------------------------------------------------
Write-Host '> Creating firewall rule for HTTP'
gcloud compute firewall-rules describe spinochat-allow-web 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  rule exists, skipping'
} else {
    gcloud compute firewall-rules create spinochat-allow-web `
        --allow='tcp:80,tcp:443' `
        --target-tags=$FirewallTag `
        --source-ranges=0.0.0.0/0 `
        --description='Allow HTTP/HTTPS to SpinoChat backend'
    if ($LASTEXITCODE -ne 0) { Write-Host 'FATAL: firewall rule failed' -ForegroundColor Red; exit 1 }
}

# --- Startup script (installs deploy.sh + grants github-deployer SSH access) -
# vm-deploy.sh is shipped from the local repo; embed it as base64 to avoid file
# upload complexity. The startup-script writes it to /opt/chatbot/deploy.sh
# every boot, so updates to vm-deploy.sh take effect after a VM restart OR
# you can rsync the file manually for hotfixes.

$DeployScriptPath = Join-Path $PSScriptRoot 'vm-deploy.sh'
if (-not (Test-Path $DeployScriptPath)) {
    Write-Error "vm-deploy.sh not found at $DeployScriptPath"
    exit 1
}
$DeployScriptBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($DeployScriptPath))

$StartupScript = @"
#!/bin/bash
set -e

# Install deploy.sh at /opt/chatbot/deploy.sh
mkdir -p /opt/chatbot
echo '$DeployScriptBase64' | base64 -d > /opt/chatbot/deploy.sh
chmod +x /opt/chatbot/deploy.sh

# Configure Docker to authenticate to Artifact Registry on this VM
docker-credential-gcr configure-docker --registries=$Region-docker.pkg.dev || true

echo 'SpinoChat VM ready. Deploy script installed at /opt/chatbot/deploy.sh'
"@

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $StartupScript -Encoding UTF8
$StartupPath = $tmp.FullName

# --- Create VM --------------------------------------------------------------
Write-Host "> Creating VM '$VmName' ($Tier in $Zone, Container-Optimized OS)"
gcloud compute instances describe $VmName --zone=$Zone 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  VM exists, updating startup script + resetting to reinstall deploy.sh'
    gcloud compute instances add-metadata $VmName --zone=$Zone --metadata-from-file="startup-script=$StartupPath" | Out-Null
    gcloud compute instances reset $VmName --zone=$Zone | Out-Null
} else {
    gcloud compute instances create $VmName `
        --zone=$Zone `
        --machine-type=$Tier `
        --image-family=cos-stable `
        --image-project=cos-cloud `
        --boot-disk-size=30GB `
        --boot-disk-type=pd-standard `
        --service-account=$VmSaEmail `
        --scopes=cloud-platform `
        --tags=$FirewallTag `
        --address=$ExternalIp `
        --metadata-from-file="startup-script=$StartupPath"
    if ($LASTEXITCODE -ne 0) { Write-Host 'FATAL: VM create failed' -ForegroundColor Red; Remove-Item $tmp; exit 1 }
}

Remove-Item $tmp

# --- Allow github-deployer SA to SSH into the VM ----------------------------
$DeploySa = "github-deployer@$ProjectId.iam.gserviceaccount.com"
Write-Host "> Granting compute.osLogin to $DeploySa (for SSH from GitHub Actions)"
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$DeploySa" `
    --role=roles/compute.osAdminLogin `
    --condition=None | Out-Null
# Allow github-deployer to act as the VM service account (required for SSH-as-SA)
gcloud iam service-accounts add-iam-policy-binding $VmSaEmail `
    --member="serviceAccount:$DeploySa" `
    --role=roles/iam.serviceAccountUser `
    --condition=None | Out-Null

# Enable OS Login on the project (recommended over SSH key management)
gcloud compute project-info add-metadata --metadata=enable-oslogin=TRUE | Out-Null

# --- Summary -----------------------------------------------------------------
Write-Host ''
Write-Host '==============================================================================='
Write-Host '  COMPUTE ENGINE SETUP COMPLETE'
Write-Host '==============================================================================='
Write-Host ''
Write-Host "  VM:              $VmName ($Tier in $Zone)"
Write-Host "  External IP:     $ExternalIp"
Write-Host "  Backend URL:     http://$ExternalIp"
Write-Host "  Service account: $VmSaEmail"
Write-Host ''
Write-Host '  --- ADD TO GITHUB ACTIONS REPOSITORY VARIABLES ---'
Write-Host "  GCE_INSTANCE  = $VmName"
Write-Host "  GCE_ZONE      = $Zone"
Write-Host ''
Write-Host '  These variable names match what .github/workflows/ci.yml already expects.'
Write-Host ''
Write-Host '  NEXT STEPS:'
Write-Host '   1. Push a commit to main; the deploy-backend job will SSH in and run deploy.sh'
Write-Host '   2. Once running, point frontend env.prod to http://' + $ExternalIp
Write-Host '   3. For HTTPS, add an HTTPS Load Balancer with managed SSL cert (separate step)'
Write-Host ''
Write-Host '==============================================================================='
