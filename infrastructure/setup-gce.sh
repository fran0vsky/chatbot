#!/usr/bin/env bash
# Bootstrap a fresh GCE Debian/Ubuntu VM for Docker-based backend deployments.
# Run as root (or with sudo) on the instance after creation.
#
# Usage:
#   gcloud compute scp infrastructure/setup-gce.sh INSTANCE:/tmp/ --zone=ZONE
#   gcloud compute ssh INSTANCE --zone=ZONE --command="sudo bash /tmp/setup-gce.sh"
set -euo pipefail

# ── Install Docker ────────────────────────────────────────────────────────────
apt-get update -q
apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -q
apt-get install -y docker-ce docker-ce-cli containerd.io

# Allow the OS Login user to run Docker without sudo
# $SUDO_USER is set when invoking with sudo; skip silently if empty
if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "$SUDO_USER"
fi

# ── Install deploy script ─────────────────────────────────────────────────────
mkdir -p /opt/chatbot

cat > /opt/chatbot/deploy.sh << 'DEPLOY_SCRIPT'
#!/usr/bin/env bash
# Called by GitHub Actions: /opt/chatbot/deploy.sh <image> <cors_origin>
# The VM's service account must have roles/secretmanager.secretAccessor.
set -euo pipefail

IMAGE="$1"
CORS_ORIGIN="$2"

echo "[deploy] Pulling $IMAGE ..."
docker pull "$IMAGE"

echo "[deploy] Replacing chatbot-backend container ..."
docker stop chatbot-backend 2>/dev/null || true
docker rm   chatbot-backend 2>/dev/null || true

OPENROUTER_KEY=$(gcloud secrets versions access latest --secret=openrouter-api-key)
DATABASE_URL=$(gcloud secrets versions access latest --secret=database-url)

docker run -d \
  --name chatbot-backend \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e OPENROUTER_API_KEY="$OPENROUTER_KEY" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e CORS_ORIGIN="$CORS_ORIGIN" \
  "$IMAGE"

# Remove dangling images to reclaim disk space
docker image prune -f

echo "[deploy] Done. Container status:"
docker ps --filter name=chatbot-backend --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
DEPLOY_SCRIPT

chmod +x /opt/chatbot/deploy.sh

echo ""
echo "GCE setup complete."
echo "Reboot or log out/in for the Docker group change to take effect."
