# Phase 1 — What You Still Have To Do

> Audience: you (Franek), picking this up cold.
> Status as of 2026-05-18: all code is written and all static gates pass. Everything below is one-time human setup + verification.
> Estimated time: ~1 hour total, mostly waiting on GCP API enables and CI runs.

---

## ✅ Already done (no action needed)

- Backend rewritten to OpenRouter (`ChatOpenAI` → `openai/gpt-4o-mini`), graph simplified to `START → agent → END`, `MemorySaver` retained
- `@langchain/openai ^1.4.0` added as explicit backend dependency
- Dockerfile fixed to copy `libs/` in both builder and runner stages
- Angular chat UI built: `App` → `ChatComponent` → `MessageBubble`; old `NxWelcome` deleted
- `ChatService` with `crypto.randomUUID()` per-session threadId, POSTing to `${environment.apiUrl}/api/agents/chat`
- `firebase.json` + `.firebaserc` checked in (project ID is placeholder)
- Playwright E2E happy-path spec (`apps/frontend-e2e/src/chat.spec.ts`) + dual webServer config
- CI workflow rewritten: `lint-test-build` → `e2e` → `deploy-backend` (Cloud Run / WIF) + `deploy-frontend` (Firebase)
- Unit tests: 8 passing (App, ChatService×3, MessageBubble×4)
- `.gitignore` updated to block accidental commit of Firebase service account JSON
- README `## Deployment` section documents every var/secret
- gcloud setup scripts: [scripts/setup-gcp.sh](../../../scripts/setup-gcp.sh) and [scripts/setup-gcp.ps1](../../../scripts/setup-gcp.ps1)
- SUMMARY.md files for plans 01, 02, 03

**Static gates currently green:** `nx lint backend`, `nx lint frontend`, `nx lint frontend-e2e`, `nx test frontend`, `nx build backend`, `nx build frontend --configuration=production` (274 kB bundle, well under budget).

---

## 🟡 Step 1 — Local smoke test (15 min)

Catch bugs before they cost you a Cloud Run deploy.

1. Get an OpenRouter API key from https://openrouter.ai/keys (free tier works).
2. Create `.env` at repo root (it's already in `.gitignore`):
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
3. PowerShell — start the backend in one terminal:
   ```powershell
   $env:OPENROUTER_API_KEY = '<your key>'
   npx nx serve backend
   ```
4. In a second terminal, start the frontend:
   ```powershell
   npx nx serve frontend
   ```
5. Open `http://localhost:4200`. You should see:
   - "Chatbot" header at top
   - Empty messages area
   - Textarea + send button at bottom
6. Run the **memory test**:
   - Type "Hello, my name is Franek." → press Enter. Wait for assistant bubble.
   - Type "What is my name?" → assistant should reference "Franek".
   - Refresh the page → ask "What is my name?" again → assistant should NOT know it (proves `CONV-02`: fresh threadId per session).
7. Run the **error-path test**:
   - Stop the backend (Ctrl+C in terminal 1).
   - Send a message in the UI → red-tinted error bubble should appear with "Something went wrong. Please try again." and the input should re-enable immediately.

> **If anything fails here, STOP** — no point deploying broken code. Tell me what you see.

---

## 🟡 Step 2 — Local Playwright E2E (5 min)

With the backend still running, in a third terminal:

```powershell
$env:OPENROUTER_API_KEY = '<your key>'
$env:CI = 'true'   # forces chromium-only, matches CI behavior
npx nx e2e frontend-e2e
```

Expected: 1 test passes (`user can send a message and receive an assistant reply`).

If the E2E fails locally, it will fail in CI too — fix it here first.

---

## 🟡 Step 3 — GCP automated setup (10 min, mostly waiting on API enables)

1. Install gcloud CLI if you don't have it: https://cloud.google.com/sdk/docs/install
2. `gcloud auth login` (browser flow)
3. Create or pick a GCP project. Note its **Project ID** (lowercase, e.g. `chatbot-prod-abc123`).
   - GCP Console → top-left project picker → New Project.
4. Open [scripts/setup-gcp.ps1](../../../scripts/setup-gcp.ps1) and fill in the four values at the top:
   ```powershell
   $ProjectId        = 'chatbot-prod-abc123'
   $Region           = 'europe-west1'
   $GithubRepo       = 'YOUR_GH_USERNAME/Chatbot'    # exact GitHub repo path
   $OpenRouterApiKey = 'sk-or-v1-...'                # same key as Step 1
   ```
5. Run it:
   ```powershell
   .\scripts\setup-gcp.ps1
   ```
6. When it finishes, **copy the printed values somewhere** — you need them for Step 5.

---

## 🟡 Step 4 — Firebase setup (10 min — Console only, can't be scripted)

1. https://console.firebase.google.com → Add project.
   - Recommended: tick "Use existing Google Cloud project" and attach to the GCP project you just set up. One billing/IAM surface.
2. Sidebar → Build → Hosting → Get Started → click through the wizard. **Don't** run `firebase init` locally — `firebase.json` + `.firebaserc` are already checked in.
3. Sidebar → ⚙ Project Settings → Service accounts → Generate new private key. A JSON file downloads. **Do not commit this file** (`.gitignore` blocks the obvious names; just to be safe, save it outside the repo).
4. Note your **Firebase Hosting URL** — shape: `https://<project-id>.web.app`. You'll see it on the Hosting dashboard.

---

## 🟡 Step 5 — Update placeholder values in the repo (2 min)

Two files have `REPLACE_WITH_*` / `YOUR_*` placeholders:

1. [.firebaserc](../../../.firebaserc) — replace `REPLACE_WITH_FIREBASE_PROJECT_ID` with your Firebase project ID.
2. [apps/frontend/src/environments/environment.prod.ts](../../../apps/frontend/src/environments/environment.prod.ts) — replace `https://YOUR_CLOUD_RUN_URL` with the Cloud Run URL printed by the setup script (it has the shape `https://chatbot-backend-<hash>-<region>.a.run.app`).

---

## 🟡 Step 6 — GitHub Actions repository variables + secrets (5 min)

GitHub → your repo → Settings → Secrets and variables → Actions.

**Variables tab** — add these 8 (use the values printed by `setup-gcp.ps1`):

| Name | Source |
|------|--------|
| `GCP_PROJECT_ID` | from setup script output |
| `GCP_REGION` | from setup script output |
| `GCP_ARTIFACT_REPO` | `chatbot` (or whatever you customized) |
| `GCP_WIF_PROVIDER` | full `projects/.../providers/...` resource path from setup script |
| `GCP_WIF_SERVICE_ACCOUNT` | `github-deployer@<project>.iam.gserviceaccount.com` |
| `CLOUD_RUN_SERVICE` | `chatbot-backend` |
| `FIREBASE_PROJECT_ID` | your Firebase project ID |
| `FIREBASE_HOSTING_URL` | `https://<project-id>.web.app` |

**Secrets tab** — add these 2:

| Name | Source |
|------|--------|
| `FIREBASE_SERVICE_ACCOUNT` | paste the **entire JSON file contents** from Step 4.3 |
| `OPENROUTER_API_KEY` | the same OpenRouter key from Step 1 (needed by the CI E2E job) |

---

## 🟡 Step 7 — Commit and push (2 min)

All Phase 1 work is still uncommitted on `main`. Use this commit message:

```
feat: implement Phase 1 — working chat end-to-end

- Backend: switch Gemini → OpenRouter (ChatOpenAI), simplify LangGraph to
  START → agent → END, declare @langchain/openai, fix Dockerfile libs/ copy
- Frontend: new Angular chat UI (ChatService, ChatComponent, MessageBubble),
  per-session UUID threadId, typing dots, auto-scroll, inline error bubble;
  delete NxWelcome
- Deployment: firebase.json + .firebaserc, Playwright happy-path E2E spec,
  rewrite CI to lint-test-build → e2e → Cloud Run (WIF) + Firebase Hosting;
  remove GHCR push
- Docs: Phase 1 plan summaries, STATE.md progress, README deployment guide
```

> **Pre-push check**: `git status` should show no `.env` and no Firebase JSON. If either appears, do NOT push — they're in `.gitignore` but verify.

Push directly to `main` (or PR + merge, your choice). The push triggers all four CI jobs.

---

## 🟡 Step 8 — Watch the CI run (~5–10 min) and verify deploys

GitHub → Actions tab → click the latest run.

Expected job order and timing:

| Job | Should | If it fails |
|-----|--------|-------------|
| `lint-test-build` | ✅ green in ~2 min | Run `nx affected --target=lint,test,build` locally first |
| `e2e` | ✅ green in ~2–4 min (downloads chromium + runs 1 test) | Check `playwright-report` artifact uploaded on failure |
| `deploy-backend` | ✅ green in ~3–5 min (builds Docker image, pushes to Artifact Registry, deploys to Cloud Run) | Most likely: WIF binding wrong → check vars match script output exactly |
| `deploy-frontend` | ✅ green in ~1–2 min (builds Angular prod, deploys to Firebase) | Most likely: `FIREBASE_SERVICE_ACCOUNT` JSON malformed |

---

## 🟢 Step 9 — Post-deploy smoke test (5 min)

This is the acceptance test for the whole phase.

1. Open `https://<your-firebase-project>.web.app` in a browser.
2. Type "Hello, what's 2+2?" → assistant should reply with real LLM output within a few seconds.
3. DevTools → Network tab → confirm the POST goes to `https://chatbot-backend-<hash>-<region>.a.run.app/api/agents/chat` and returns HTTP 200.
4. Run the memory test again ("My name is X." → "What is my name?").
5. Refresh → memory should be gone.
6. Optional CORS sanity: from a terminal,
   ```powershell
   curl https://chatbot-backend-<hash>-<region>.a.run.app/api -i
   ```
   Should return 200 with `Hello API`. From a different browser origin (e.g. open `https://example.com`, paste a fetch into devtools targeting your Cloud Run URL) — should be CORS-blocked, proving `CORS_ORIGIN` is set correctly.

---

## 🛑 Common failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `deploy-backend` errors with `Permission denied` | WIF principal binding doesn't match your repo | Re-run `setup-gcp.ps1` with the exact `org/repo` form, then re-trigger CI |
| `deploy-backend` errors with `Cannot find module '@org/shared-types'` | Dockerfile `COPY libs/` order issue | This is what Plan 01 Task 3 fixed; if it still happens, check `apps/backend/Dockerfile` against the committed version |
| Cloud Run returns 500 in browser, console shows CORS error | `CORS_ORIGIN` doesn't exactly match the Firebase URL (trailing slash, http vs https) | Update `FIREBASE_HOSTING_URL` GitHub variable, push any commit to redeploy |
| Frontend loads but POST returns 404 | `environment.prod.ts` still has placeholder | Update it, commit, push |
| Assistant always returns "Something went wrong" | Backend can't reach OpenRouter — bad API key | Check Cloud Run logs in GCP Console; verify the Secret Manager value matches a real key |
| `deploy-frontend` errors with `Could not load credential` | `FIREBASE_SERVICE_ACCOUNT` not pasted as raw JSON (got escaped) | Re-paste the entire `{...}` blob from the JSON file, no quotes around it |

---

## 🎯 You're done when

- The Firebase URL loads the chat UI
- A real conversation works (send → receive → memory works in one session → fresh on refresh)
- All four CI jobs are green on `main`
- DevTools confirms the frontend calls your Cloud Run URL

When that's true, mark Phase 1 complete in `.planning/STATE.md` and the project's first milestone is shipped.
