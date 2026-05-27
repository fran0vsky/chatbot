#!/bin/bash
# Deploy script invoked by GitHub Actions over SSH on the Compute Engine VM.
# Installed at /opt/chatbot/deploy.sh by setup-compute.ps1.
#
# Args:
#   $1 = full image path in Artifact Registry (e.g. europe-west1-docker.pkg.dev/proj/repo/backend:sha)
#   $2 = frontend URL (for CORS_ORIGIN env var)

set -euo pipefail

IMAGE_PATH="${1:-}"
FRONTEND_URL="${2:-}"
CONTAINER_NAME="spinochat"

if [[ -z "$IMAGE_PATH" ]]; then
    echo "ERROR: image path arg required" >&2
    exit 1
fi

echo "[deploy] Pulling image: $IMAGE_PATH"
docker pull "$IMAGE_PATH"

echo "[deploy] Reading secrets from Secret Manager"
OPENROUTER_KEY=$(gcloud secrets versions access latest --secret=openrouter-api-key)
DATABASE_URL=$(gcloud secrets versions access latest --secret=database-url 2>/dev/null || echo "")

echo "[deploy] Stopping previous container (if running)"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "[deploy] Starting new container"
docker run -d \
    --name="$CONTAINER_NAME" \
    --restart=always \
    -p 80:3000 \
    -e PORT=3000 \
    -e NODE_ENV=production \
    -e OPENROUTER_API_KEY="$OPENROUTER_KEY" \
    -e DATABASE_URL="$DATABASE_URL" \
    -e CORS_ORIGIN="$FRONTEND_URL" \
    "$IMAGE_PATH"

echo "[deploy] Cleaning up old images (keep last 3)"
docker image prune -f
# Keep image history short — get image IDs from oldest to newest, remove all but last 3
docker images --filter=reference="*/backend" --format='{{.ID}}' | tail -n +4 | xargs -r docker rmi || true

echo "[deploy] Done. Container status:"
docker ps --filter "name=$CONTAINER_NAME" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
