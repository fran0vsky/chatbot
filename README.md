# DinoAgents — The AI that survived

DinoAgents is a general-purpose AI chat app built as an Nx monorepo (Angular frontend + NestJS backend, LangGraph orchestration over OpenRouter). Ask anything, keep the conversation going. The mascot is a Spinosaurus — the AI that survived.

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Powered by an [Nx workspace](https://nx.dev) ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/js?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!
## Finish your Nx platform setup

🚀 [Finish setting up your workspace](https://cloud.nx.app/connect/Qg6bVN6x0w) to get faster builds with remote caching, distributed task execution, and self-healing CI. [Learn more about Nx Cloud](https://nx.dev/ci/intro/why-nx-cloud).

## Generate a library

```sh
npx nx g @nx/js:lib packages/pkg1 --publishable --importPath=@my-org/pkg1
```

## Run tasks

To build the library use:

```sh
npx nx build pkg1
```

To run any task with Nx use:

```sh
npx nx <target> <project-name>
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Versioning and releasing

To version and release the library use

```
npx nx release
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Keep TypeScript project references up to date

Nx automatically updates TypeScript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files to ensure they remain accurate based on your project dependencies (`import` or `require` statements). This sync is automatically done when running tasks such as `build` or `typecheck`, which require updated references to function correctly.

To manually trigger the process to sync the project graph dependencies information to the TypeScript project references, run the following command:

```sh
npx nx sync
```

You can enforce that the TypeScript project references are always in the correct state when running in CI by adding a step to your CI job configuration that runs the following command:

```sh
npx nx sync:check
```

[Learn more about nx sync](https://nx.dev/reference/nx-commands#sync)

## Nx Cloud

Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Set up CI (non-Github Actions CI)

**Note:** This is only required if your CI provider is not GitHub Actions.

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/js?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Deployment

**Architecture:** Cloud Run hosts the NestJS backend (image stored in GCP Artifact Registry); Firebase Hosting serves the Angular SPA. CI/CD runs on GitHub Actions and deploys automatically on every push to `main`.

### One-time GCP setup

1. Create or select a GCP project. Note its **Project ID** and choose a **region** (e.g. `europe-west1`).
2. Enable APIs: Cloud Run Admin, Artifact Registry, Secret Manager, IAM Service Account Credentials.
3. Create an Artifact Registry Docker repository named `chatbot` in your chosen region.
4. In Secret Manager, create a secret named `openrouter-api-key` with your OpenRouter key value.
5. In Cloud Run, create a service named `chatbot-backend` (initial image can be any placeholder). Enable "Allow unauthenticated invocations". Note the service URL.
6. Grant the Cloud Run runtime service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) the role `roles/secretmanager.secretAccessor` on the `openrouter-api-key` secret.

### One-time Workload Identity Federation setup (for GitHub Actions → GCP, no long-lived keys)

1. Create a service account `github-deployer@PROJECT_ID.iam.gserviceaccount.com`.
2. Grant it: `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`.
3. In IAM → Workload Identity Federation, create a pool (e.g. `github-pool`) with an OIDC provider for `https://token.actions.githubusercontent.com`. Restrict to your repo via attribute condition: `attribute.repository == 'YOUR_ORG/YOUR_REPO'`.
4. Bind the WIF principal to the service account as `roles/iam.workloadIdentityUser`.
5. Note the full WIF provider resource path: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/PROVIDER_NAME`.

### One-time Firebase setup

1. Go to https://console.firebase.google.com and create a project (or attach to the same GCP project).
2. Enable Firebase Hosting. Note the Hosting URL (`https://PROJECT_ID.web.app`).
3. In Project Settings → Service accounts → Generate new private key. Save the JSON (do **not** commit it).

### One-time repo edits

- In `.firebaserc`, replace `REPLACE_WITH_FIREBASE_PROJECT_ID` with your Firebase project ID.
- In `apps/frontend/src/environments/environment.prod.ts`, replace `YOUR_CLOUD_RUN_URL` with the Cloud Run service URL from step 5 above.

### GitHub Actions repository variables and secrets

Go to **Settings → Secrets and variables → Actions**.

**Repository Variables** (Vars tab — visible in logs):

| Variable | Value |
|----------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_REGION` | e.g. `europe-west1` |
| `GCP_ARTIFACT_REPO` | `chatbot` |
| `GCP_WIF_PROVIDER` | Full WIF provider resource path |
| `GCP_WIF_SERVICE_ACCOUNT` | `github-deployer@PROJECT_ID.iam.gserviceaccount.com` |
| `CLOUD_RUN_SERVICE` | `chatbot-backend` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_HOSTING_URL` | `https://PROJECT_ID.web.app` (used as `CORS_ORIGIN` on Cloud Run) |

**Repository Secrets** (Secrets tab — masked):

| Secret | Value |
|--------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Full contents of the Firebase service account JSON |
| `OPENROUTER_API_KEY` | Your OpenRouter API key (needed by the CI E2E job) |

> **Note:** The E2E job starts a real local backend and calls OpenRouter — `OPENROUTER_API_KEY` must be set as a secret or the E2E job will fail with a 500 error.

### Running E2E locally

```sh
# Terminal A
OPENROUTER_API_KEY=<your-key> npx nx serve backend

# Terminal B
npx nx serve frontend

# Terminal C — run the Playwright happy-path test
OPENROUTER_API_KEY=<your-key> npx nx e2e frontend-e2e
```
