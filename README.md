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

**Architecture:** A single **Compute Engine VM** (`spinochat-backend`, running **Container-Optimized OS**) runs the backend as a Docker container named `spinochat`, listening on port `3000`. The backend serves both the `/api/*` routes and the baked-in Angular SPA from the same origin. A **Caddy** container sits in front on ports `80`/`443` as a reverse proxy and **automatically obtains + renews** the Let's Encrypt certificate (no certbot, no cron). Caddy reaches the backend over a private Docker network (`web`); the backend is **not** published to the host. The committed Caddy config lives at [`infra/caddy/Caddyfile`](infra/caddy/Caddyfile).

> **Note:** COS is Docker-only (no `apt`), so host-level nginx + certbot is **not** possible — that's why HTTPS is done with a Caddy container. The older `infra/nginx/dinoagents.conf` is retained for reference only and does **not** apply to this VM.

### Prerequisites

- A domain with an **A record pointing at the VM's public IP** (DuckDNS works fine).
- The backend container running on the `web` network as `spinochat` (port `3000`, internal only).
- Ports **80 and 443 open** in the VM firewall. Port `3000` must **not** be exposed publicly.

### Runbook (on the VM)

1. **Create the shared network and copy the backend's env** (preserves the baked-in secrets):
   ```sh
   sudo docker network create web
   sudo docker inspect spinochat --format '{{range .Config.Env}}{{println .}}{{end}}' | sudo tee /var/lib/spinochat.env >/dev/null
   ```
2. **Move the backend onto the network** (internal-only, HTTPS origin for CORS):
   ```sh
   sudo docker rm -f spinochat
   sudo docker run -d --name spinochat --restart always --network web \
     --env-file /var/lib/spinochat.env -e CORS_ORIGIN=https://{DOMAIN} <backend-image>
   ```
3. **Write the Caddyfile** — copy `infra/caddy/Caddyfile` to `/var/lib/caddy/Caddyfile`, replacing `{DOMAIN}` with your hostname.
4. **Start Caddy** (publishes 80/443, persists certs in a volume):
   ```sh
   sudo docker run -d --name caddy --restart always --network web \
     -p 80:80 -p 443:443 \
     -v /var/lib/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
     -v caddy_data:/data -v caddy_config:/config caddy:2
   ```
   Caddy obtains the cert on first start and adds the `80 → 443` redirect automatically.
5. **Verify:**
   - `https://{DOMAIN}` loads with a valid Let's Encrypt certificate (padlock); `http://{DOMAIN}` redirects to it.
   - A chat message streams token-by-token over HTTPS (SSE works through Caddy) and an image paste/upload succeeds, with **no mixed-content errors**.
   - Cert acquisition is confirmed in the log: `sudo docker logs caddy` shows `certificate obtained successfully`. Renewal is automatic (Caddy), persisted in the `caddy_data` volume.

### Running E2E locally

```sh
# Terminal A
OPENROUTER_API_KEY=<your-key> npx nx serve backend

# Terminal B
npx nx serve frontend

# Terminal C — run the Playwright happy-path test
OPENROUTER_API_KEY=<your-key> npx nx e2e frontend-e2e
```
