# One-time Cloud SQL Postgres setup for SpinoChat.
# Idempotent — re-runnable; skips anything that already exists.
#
# What this provisions:
#   - Enables Cloud SQL Admin API + Service Networking API
#   - Cloud SQL Postgres 17 instance (db-f1-micro tier)
#   - Database 'spinochat'
#   - Application user 'spinochat-app' with random 32-byte password
#   - DATABASE_URL stored as Secret Manager secret 'database-url'
#   - Authorizes your current public IP for local dev (so you can connect)
#
# Cost note: db-f1-micro is ~$7/month. First $300 of GCP usage is free (90-day trial).
#
# Prerequisites:
#   - gcloud CLI authenticated (`gcloud auth login`)
#   - GCP project already created (chatbot-franek-2026)
#
# Usage:
#   .\scripts\setup-postgres.ps1

$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false

function Assert-LastExitCode {
    param([string]$Message)
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host "FATAL: $Message" -ForegroundColor Red
        exit 1
    }
}

# --- CONFIG ------------------------------------------------------------------
$ProjectId   = 'chatbot-franek-2026'
$Region      = 'europe-west1'
$InstanceId  = 'spinochat-db'
$DbName      = 'spinochat'
$DbUser      = 'spinochat-app'
$DbTier      = 'db-f1-micro'
$DbVersion   = 'POSTGRES_17'
$SecretName  = 'database-url'
# -----------------------------------------------------------------------------

gcloud config set project $ProjectId | Out-Null

Write-Host '> Enabling Cloud SQL Admin API'
gcloud services enable sqladmin.googleapis.com servicenetworking.googleapis.com

# --- Create Postgres instance ------------------------------------------------
Write-Host "> Creating Cloud SQL instance '$InstanceId' ($DbTier, $DbVersion) in $Region"
Write-Host '  (this takes ~3-5 minutes the first time)'

gcloud sql instances describe $InstanceId 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  instance already exists, skipping create'
} else {
    gcloud sql instances create $InstanceId `
        --database-version=$DbVersion `
        --edition=ENTERPRISE `
        --tier=$DbTier `
        --region=$Region `
        --storage-size=10GB `
        --storage-type=SSD `
        --storage-auto-increase `
        --backup-start-time=03:00 `
        --availability-type=ZONAL `
        --no-deletion-protection
    Assert-LastExitCode 'Cloud SQL instance creation failed; aborting before secret pollution.'
}

# --- Create database ---------------------------------------------------------
Write-Host "> Creating database '$DbName'"
gcloud sql databases describe $DbName --instance=$InstanceId 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  database already exists, skipping'
} else {
    gcloud sql databases create $DbName --instance=$InstanceId
}

# --- Create application user with random password ----------------------------
$DbPassword = -join ((1..40) | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 126) })
# Strip characters that confuse shells / URLs (quotes, backslash, @, /, :)
$DbPassword = $DbPassword -replace '[\"\\@/:` ]', 'x'

Write-Host "> Creating application user '$DbUser' (with auto-generated password)"
gcloud sql users describe $DbUser --instance=$InstanceId 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  user exists — rotating password'
    gcloud sql users set-password $DbUser --instance=$InstanceId --password=$DbPassword
} else {
    gcloud sql users create $DbUser --instance=$InstanceId --password=$DbPassword
}

# --- Authorize current public IP for local dev -------------------------------
$MyIp = (Invoke-RestMethod -Uri 'https://api.ipify.org' -ErrorAction SilentlyContinue)
if ($MyIp) {
    Write-Host "> Authorizing your public IP ($MyIp) for local connections"
    gcloud sql instances patch $InstanceId --authorized-networks="$MyIp/32" --quiet
} else {
    Write-Host '  could not detect public IP; skip authorized-networks (you can add later)'
}

# --- Build DATABASE_URL ------------------------------------------------------
$InstanceIp = (gcloud sql instances describe $InstanceId --format='value(ipAddresses[0].ipAddress)').Trim()
$ConnectionName = (gcloud sql instances describe $InstanceId --format='value(connectionName)').Trim()

if ([string]::IsNullOrWhiteSpace($InstanceIp)) {
    Write-Error 'Could not retrieve instance IP — aborting before writing bad secret.'
    exit 1
}

# Direct TCP URL (for local dev with authorized network + Compute Engine VM):
$DirectUrl = "postgresql://${DbUser}:${DbPassword}@${InstanceIp}:5432/${DbName}?sslmode=require"

Write-Host "> Storing DATABASE_URL in Secret Manager as '$SecretName'"
$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $DirectUrl -NoNewline

gcloud secrets describe $SecretName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '  secret exists — adding a new version'
    gcloud secrets versions add $SecretName --data-file=$tmp
} else {
    gcloud secrets create $SecretName --replication-policy=automatic --data-file=$tmp
}
Remove-Item $tmp

# --- Grant runtime service account access to the secret ----------------------
$RuntimeSa = "chatbot-runtime@$ProjectId.iam.gserviceaccount.com"
gcloud iam service-accounts describe $RuntimeSa 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    gcloud secrets add-iam-policy-binding $SecretName `
        --member="serviceAccount:$RuntimeSa" `
        --role=roles/secretmanager.secretAccessor `
        --condition=None | Out-Null
    Write-Host "  granted secretAccessor on '$SecretName' to $RuntimeSa"
}

# --- Summary -----------------------------------------------------------------
Write-Host ''
Write-Host '==============================================================================='
Write-Host '  POSTGRES SETUP COMPLETE'
Write-Host '==============================================================================='
Write-Host ''
Write-Host "  Instance:        $InstanceId"
Write-Host "  Connection name: $ConnectionName"
Write-Host "  Public IP:       $InstanceIp"
Write-Host "  Database:        $DbName"
Write-Host "  User:            $DbUser"
Write-Host ''
Write-Host '  Secret Manager:  database-url'
Write-Host ''
Write-Host '  --- ADD TO YOUR LOCAL .env (overwrite any old DATABASE_URL) ---'
Write-Host "  DATABASE_URL=$DirectUrl"
Write-Host ''
Write-Host '  --- FOR CLOUD RUN (set as runtime secret reference) ---'
Write-Host '  gcloud run services update chatbot-backend ``'
Write-Host '    --region=' + $Region + ' ``'
Write-Host '    --set-secrets DATABASE_URL=database-url:latest'
Write-Host ''
Write-Host '==============================================================================='
