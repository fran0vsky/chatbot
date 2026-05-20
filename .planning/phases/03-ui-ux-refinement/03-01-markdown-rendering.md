# Plan 03-01: Markdown Rendering in Assistant Messages

**Phase:** 3 — UI/UX Refinement
**Wave:** 1 (parallel with 03-03; no file overlap)
**Requirements:** D-01, D-02, D-03, D-04
**Files touched:** `apps/frontend/package.json`, `apps/frontend/src/app/app.config.ts`, `apps/frontend/src/app/chat/message-bubble/message-bubble.ts`, `apps/frontend/src/app/chat/message-bubble/message-bubble.html`, root `package.json` (dependency)

## Objective

Assistant message bubbles render full markdown — headings, bold/italic, fenced code blocks with syntax highlighting, inline code, bullet and numbered lists. User and error bubbles are unchanged (stay plain text with `whitespace-pre-wrap`).

## Required reading before starting

- `.planning/phases/03-ui-ux-refinement/03-CONTEXT.md` — decisions D-01..D-04, code context
- `apps/frontend/CLAUDE.md` — standalone, OnPush, Tailwind-only, no `any`

## Known deviation from CONTEXT

D-03 names `highlight.js`. `ngx-markdown` v21 ships **Prism.js** as its highlighting integration, not highlight.js. Use Prism.js — the outcome (highlighted code blocks with language tags) matches the decision's intent. Record this as a deviation in the commit body.

## Tasks

### Task 1 — Install ngx-markdown and its peer deps
- Run from repo root: `pnpm add ngx-markdown marked prismjs --filter frontend` (verify the package manager — repo uses pnpm per `pnpm-lock.yaml`/Nx; if npm, use `npm install ngx-markdown marked prismjs` in `apps/frontend`).
- `ngx-markdown` major version must match Angular 21 — install the version whose peer range includes `@angular/core@21`.
- **Commit:** `chore(frontend): add ngx-markdown for assistant message rendering`

### Task 2 — Provide markdown globally
- In `apps/frontend/src/app/app.config.ts`, add `provideMarkdown()` to the `providers` array (import from `ngx-markdown`).
- `provideMarkdown()` with no args is sufficient for default rendering. Prism.js highlighting activates by importing Prism in `app.config.ts` or `main.ts` — follow ngx-markdown's current docs for the v21 setup (typically `import 'prismjs'` plus the language components you want, e.g. `prismjs/components/prism-typescript`).
- Add Prism's stylesheet (e.g. `prismjs/themes/prism.css`) to `apps/frontend` global styles (`styles` array in `project.json` / `angular.json`, or an `@import` in the global `styles.scss`/`styles.css`). Pick a light theme — the app is light-mode (`bg-white`, `bg-gray-100` bubbles).
- **Commit:** `feat(frontend): register ngx-markdown provider and Prism highlighting`

### Task 3 — Render markdown in the assistant bubble
- In `message-bubble.ts`: add `MarkdownComponent` (from `ngx-markdown`) to the component `imports` array.
- In `message-bubble.html`, the final `@else` branch (lines 24-29, the plain assistant bubble): replace the `{{ message.text }}` interpolation with `<markdown [data]="message.text"></markdown>`.
- Keep the user branch (line 1-6) and error branch (line 7-15) exactly as-is — plain text with `whitespace-pre-wrap`.
- Remove `whitespace-pre-wrap` from the **assistant** bubble's inner `<div>` only — markdown produces block elements; keeping it would double whitespace. Keep `break-words`.
- Add Tailwind typography to the assistant bubble div so rendered markdown (headings, lists, code) is readable inside a `max-w-[75%]` bubble. Use utility classes only (no inline styles) — e.g. spacing/`text-sm` and a wrapper class for `<pre>`/`<code>` styling. If the executor finds `@tailwindcss/typography` is already a dependency, `prose prose-sm` is acceptable; otherwise style with plain Tailwind utilities — do **not** add the typography plugin as part of this plan.
- **Commit:** `feat(frontend): render markdown in assistant message bubbles`

## Verification

- `pnpm nx build frontend` succeeds.
- `pnpm nx lint frontend` passes — no `any`, no unused imports.
- Manual: send a message that returns markdown (ask the model for a code example + a list). Confirm:
  - Headings, bold, lists render as HTML, not literal `#`/`*`.
  - Fenced code blocks show monospace + background + syntax colors.
  - User bubble and error bubble still render plain text with line breaks preserved.

## Done when

All three commits landed, build + lint green, manual check above passes.
