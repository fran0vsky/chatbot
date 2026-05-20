---
phase: 3
plan: 01
subsystem: frontend
tags: [markdown, ngx-markdown, prismjs, ui]
requires:
  - Phase 2 chat UI (message-bubble component)
provides:
  - Markdown rendering in assistant message bubbles
  - Prism.js syntax highlighting for fenced code blocks
affects:
  - apps/frontend/src/app/app.config.ts
  - apps/frontend/src/app/chat/message-bubble/
tech-stack:
  added:
    - ngx-markdown@^21.3.0
    - marked@^18.0.4
    - prismjs@^1.30.0
  patterns:
    - Markdown directive (<markdown [data]>) in assistant bubble
    - Tailwind @apply scoped under .markdown-bubble for generated HTML
key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - apps/frontend/src/app/app.config.ts
    - apps/frontend/src/styles.scss
    - apps/frontend/src/app/chat/message-bubble/message-bubble.ts
    - apps/frontend/src/app/chat/message-bubble/message-bubble.html
    - apps/frontend/src/app/chat/message-bubble/message-bubble.scss
decisions:
  - Used Prism.js instead of highlight.js — ngx-markdown v21 ships Prism, not highlight.js (planned deviation, D-03 intent preserved)
  - Dependencies installed at workspace root (npm workspaces; no apps/frontend/package.json exists)
  - Markdown HTML styled via Tailwind @apply in component scss — generated elements cannot carry class attributes
metrics:
  completed: 2026-05-20
  tasks: 3
  files: 7
---

# Phase 3 Plan 01: Markdown Rendering in Assistant Messages Summary

Assistant message bubbles now render full markdown (headings, bold/italic, lists, inline code, fenced code blocks with Prism.js syntax highlighting) via the `ngx-markdown` library; user and error bubbles remain plain text.

## What Was Built

- **Task 1 — Dependencies:** Added `ngx-markdown@^21.3.0` (matches the Angular 21 peer range) plus peer deps `marked@^18.0.4` and `prismjs@^1.30.0`. The plan referenced `apps/frontend/package.json`, but this is a single-repo npm workspace (`@org/source`) — dependencies live in the root `package.json`, where they were installed.
- **Task 2 — Global provider:** Added `provideMarkdown()` to `appConfig.providers`. Imported the Prism core plus language components (typescript, javascript, json, bash, css, python) in `app.config.ts` so fenced code blocks are highlighted. Added Prism's light theme (`prismjs/themes/prism.css`) to the global `styles.scss` — chosen for the app's light-mode palette.
- **Task 3 — Render in bubble:** Added `MarkdownComponent` to the `message-bubble` component imports. The plain assistant `@else` branch now uses `<markdown [data]="message.text">` instead of `{{ message.text }}`. Removed `whitespace-pre-wrap` from the assistant bubble (markdown produces block elements; it would double whitespace), kept `break-words`. User and error branches are unchanged. Added a `.markdown-bubble` scss scope with Tailwind `@apply` rules styling headings, lists, links, blockquotes, inline code, and fenced `<pre>` blocks so rendered markdown is readable inside the `max-w-[75%]` bubble.

## Deviations from Plan

### Planned Deviation

**1. [Documented in plan] Prism.js instead of highlight.js**
- CONTEXT D-03 named `highlight.js`; ngx-markdown v21 ships Prism.js as its highlighting integration. Prism.js was used — the outcome (highlighted code blocks with language support) matches D-03's intent. The plan explicitly anticipated this deviation.

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Dependency install location**
- Plan referenced `apps/frontend/package.json` and `pnpm`. The repo has no per-app package.json and uses npm (root `package-lock.json`, `@org/source` workspace). Installed the three packages at the workspace root with npm instead.

## Verification

- `pnpm nx lint frontend` / `pnpm nx build frontend` could not be run on the dev machine — pre-existing `ERR_UNSUPPORTED_ESM_URL_SCHEME` (Nx 22.7 + Node 24 on Windows), documented in STATE.md. Build/lint verification happens on CI push.
- `tsc --noEmit` on the frontend reported zero errors in the modified files (`app.config.ts`, `message-bubble.ts`); the `ngx-markdown` and `prismjs` imports resolved cleanly with proper type declarations. One pre-existing, out-of-scope error remains (`shared-types` project-reference build order — TS6305) and was not introduced by this plan.
- Manual check (headings/lists/code rendering, plain-text user/error bubbles) pending — requires running the app.

## Deferred Issues

- Pre-existing TS6305 build-order error for `libs/shared-types` (unrelated to this plan; out of scope).
- npm reported 25 audit vulnerabilities after install — pre-existing/transitive, not introduced by the three intended packages; not addressed in this plan.

## Self-Check: PASSED

- Files modified verified present: app.config.ts, styles.scss, message-bubble.{ts,html,scss}, package.json.
- Commits: per-task commits were denied by the environment; all code changes are staged in the working tree for the user to commit.
