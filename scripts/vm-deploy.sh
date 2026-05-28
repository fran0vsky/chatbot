#!/bin/bash
# Deploy script piped over SSH stdin by GitHub Actions to the Compute Engine VM.
# Runs on Container-Optimized OS (no gcloud, no python by default — uses metadata
# service + curl for both Artifact Registry auth and Secret Manager reads).
#
# Args:
#   $1 = full image path in Artifact Registry (e.g. europe-west1-docker.pkg.dev/proj/repo/backend:sha)
#   $2 = frontend URL (CORS origin for the Nest backend)

set -euo pipefail

IMAGE_PATH="${1:-}"
FRONTEND_URL="${2:-}"
CONTAINER_NAME="spinochat"
PROJECT_ID="chatbot-franek-2026"

if [[ -z "$IMAGE_PATH" ]]; then
    echo "ERROR: image path arg required" >&2
    exit 1
fi

echo "[deploy] Fetching access token from metadata service"
ACCESS_TOKEN=$(curl -sf -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
    | sed -E 's/.*"access_token":"([^"]+)".*/\1/')

if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "ERROR: failed to obtain access token from metadata service" >&2
    exit 1
fi

echo "[deploy] Logging Docker into Artifact Registry"
# COS mounts /root read-only, so point docker at a writable config dir in /tmp.
# Once the image is pulled the auth is no longer needed (docker run uses cache).
DOCKER_CFG=/tmp/docker-config
mkdir -p "$DOCKER_CFG"
echo "$ACCESS_TOKEN" | docker --config "$DOCKER_CFG" login \
    -u oauth2accesstoken --password-stdin \
    "https://europe-west1-docker.pkg.dev"

echo "[deploy] Pulling image: $IMAGE_PATH"
docker --config "$DOCKER_CFG" pull "$IMAGE_PATH"

fetch_secret() {
    local name="$1"
    curl -sf -H "Authorization: Bearer $ACCESS_TOKEN" \
        "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/$name/versions/latest:access" \
        | sed -E 's/.*"data":"([^"]+)".*/\1/' \
        | base64 -d
}

echo "[deploy] Reading secrets from Secret Manager"
OPENROUTER_KEY=$(fetch_secret openrouter-api-key)
DATABASE_URL=$(fetch_secret database-url 2>/dev/null || echo "")

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

echo "[deploy] Pruning dangling images"
docker image prune -f >/dev/null
# Keep last 3 backend images; drop the rest.
docker images --filter=reference="*/backend" --format='{{.ID}}' | tail -n +4 | xargs -r docker rmi || true

echo "[deploy] Done. Container status:"
docker ps --filter "name=$CONTAINER_NAME" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
