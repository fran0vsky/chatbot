---
phase: 01-working-chat
plan: 03
status: code-complete-pending-human-setup
completed: 2026-05-18
requirements: [DEPLOY-01, DEPLOY-02, DEPLOY-03, E2E-01]
---

# Plan 01-03 Summary — Deployment + CI/CD

## What shipped (code side)

- `firebase.json` + `.firebaserc` at repo root (Firebase Hosting config with SPA rewrite and immutable cache for hashed assets; `.firebaserc` holds placeholder `REPLACE_WITH_FIREBASE_PROJECT_ID`).
- `apps/frontend-e2e/src/example.spec.ts` deleted; `apps/frontend-e2e/src/chat.spec.ts` added (Playwright happy-path: textarea → Enter → wait up to 60s for an assistant bubble with `bg-gray-100`).
- `apps/frontend-e2e/playwright.config.ts` runs a `webServer` array (frontend on 4200, backend on 3000); `projects` is gated on `process.env['CI']` — chromium-only in CI per D-26.
- `.github/workflows/ci.yml` rewritten as a four-job pipeline: `lint-test-build` → `e2e` → `deploy-backend` (Cloud Run via WIF, image to Artifact Registry, secret from Secret Manager, CORS pinned to `FIREBASE_HOSTING_URL`) + `deploy-frontend` (Firebase Hosting). GHCR push removed (D-25).
- `README.md` appended with a `## Deployment` section: architecture, one-time GCP setup, WIF setup, Firebase setup, repo edits, and the full GitHub Actions variables/secrets tables.

## Blocking before first `main` deploy — Task 2 human setup

This plan's Task 2 (`type="checkpoint:human-action"`) was not auto-executable. Until it is done, `deploy-backend` and `deploy-frontend` will fail on first push to `main`. The checklist is mirrored in [README.md](../../../README.md) `## Deployment`. Summary:

1. **GCP project:** enable APIs (Cloud Run, Artifact Registry, Secret Manager, IAM Service Account Credentials); create `chatbot` Artifact Registry Docker repo; create Secret Manager secret `openrouter-api-key`; create Cloud Run service `chatbot-backend`; grant runtime service account `roles/secretmanager.secretAccessor` on the secret.
2. **Workload Identity Federation:** create `github-deployer` service account (`roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`); create WIF pool + OIDC provider for `token.actions.githubusercontent.com`, restricted to your repo via attribute condition; bind WIF principal as `roles/iam.workloadIdentityUser`.
3. **Firebase:** create / attach project; enable Hosting; generate a service account JSON.
4. **Repo edits:** replace `REPLACE_WITH_FIREBASE_PROJECT_ID` in `.firebaserc`; replace `YOUR_CLOUD_RUN_URL` in `apps/frontend/src/environments/environment.prod.ts` with the real Cloud Run URL.
5. **GitHub Actions:** add 8 repository variables (`GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ARTIFACT_REPO`, `GCP_WIF_PROVIDER`, `GCP_WIF_SERVICE_ACCOUNT`, `CLOUD_RUN_SERVICE`, `FIREBASE_PROJECT_ID`, `FIREBASE_HOSTING_URL`) and 2 secrets (`FIREBASE_SERVICE_ACCOUNT`, `OPENROUTER_API_KEY`).

## Static gates

- `npx nx lint frontend-e2e` → exit 0

## Not run in this session

- `npx nx e2e frontend-e2e --project=chromium` — requires `OPENROUTER_API_KEY` exported. Documented as the local dry-run in [README.md](../../../README.md).
- `docker build -f apps/backend/Dockerfile .` — Docker is not installed on the dev machine. The Dockerfile fix from Plan 01-01 will be exercised for the first time by the CI `deploy-backend` job. If it fails, the most likely cause is the `COPY libs/` lines being out of order with `npm ci`.

## CI job IDs and gates

| Job | needs | if | Notes |
|-----|-------|----|-------|
| `lint-test-build` | — | (always) | Nx affected for lint/test/build |
| `e2e` | `lint-test-build` | (always) | `playwright install --with-deps chromium`, then `nx e2e frontend-e2e`. Env: `CI=true`, `OPENROUTER_API_KEY=<secret>`. Uploads `playwright-report/` on failure. |
| `deploy-backend` | `e2e` | `github.ref == 'refs/heads/main'` | WIF auth, push to Artifact Registry, `deploy-cloudrun@v2` with `--set-secrets OPENROUTER_API_KEY=openrouter-api-key:latest` and `--set-env-vars CORS_ORIGIN=${{ vars.FIREBASE_HOSTING_URL }}` |
| `deploy-frontend` | `e2e` | `github.ref == 'refs/heads/main'` | `nx build frontend --configuration=production` → `FirebaseExtended/action-hosting-deploy@v0` |

## Deferred to first `main` push (cannot be verified pre-setup)

- Production Cloud Run URL written into `environment.prod.ts`
- Firebase Hosting URL acting as `CORS_ORIGIN`
- All four CI jobs green on the first push
- Browser DevTools showing POST to `https://chatbot-backend-<hash>-<region>.a.run.app/api/agents/chat` returning 200
