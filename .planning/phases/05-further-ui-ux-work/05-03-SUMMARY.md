---
phase: 05-further-ui-ux-work
plan: 03
status: complete
---

# Summary: 05-03 Code Block Header Bars

## What was built

A persistent header bar above every code block in assistant messages: a
detected-language label on the left and a copy button on the right (D-07..D-10).
Always visible, desert-palette tokens, day/night safe.

## Tasks completed

1. Added `(ready)="onMarkdownReady()"` to the `<markdown>` element.
2. Injected `ElementRef` as `host`; added `onMarkdownReady()` which queries
   `<pre>` elements, guards re-injection via `dataset['headerInjected']`, reads
   the language from the `code` element's `language-*` class (`none`/`text`/empty
   → no label), and builds a desert-palette header `<div>` with a language `<span>`
   and a copy `<button>` inserted as the first child of each `<pre>`.
3. Added `copyCodeBlock(button, code)` — copies `code.textContent` via
   `navigator.clipboard.writeText`, swaps the button to a checkmark SVG for 2000ms,
   toggles `aria-label` `Copy code` ↔ `Copied`. `COPY_ICON_SVG` / `CHECK_ICON_SVG`
   defined once as class constants and reused by Task 2 and Task 3.
4. SCSS: removed `p-3` from `pre`, added `overflow-hidden` so the header clips to
   `rounded-lg`; moved padding to `pre code` (`block p-3 overflow-x-auto`) to keep
   the code body padded and horizontally scrollable.

## Key files

### Modified
- libs/ui/src/lib/message-bubble/message-bubble.ts
- libs/ui/src/lib/message-bubble/message-bubble.html
- libs/ui/src/lib/message-bubble/message-bubble.scss

## Verification

- Plan automated greps pass.
- `tsc --noEmit` on libs/ui passes clean; no `any` types used.
- `pnpm nx build frontend` NOT run — nx fails in this environment with
  `ERR_UNSUPPORTED_ESM_URL_SCHEME` under Node v24.12.0. Build + manual UAT pending.
- T-05-03a mitigation honored: language label set via `textContent`; only the
  hardcoded SVG constants assigned via `innerHTML`.

## Deviations

- Task 4: applied `rounded-lg overflow-hidden` to `pre` and moved
  `overflow-x-auto` to `pre code` (the plan's stated discretion path) so the
  header clips to rounded corners while long lines still scroll.

## Self-Check: PASSED (build verification deferred — see Verification)
