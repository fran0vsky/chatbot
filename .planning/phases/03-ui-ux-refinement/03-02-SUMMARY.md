---
phase: "03"
plan: "02"
subsystem: frontend
tags: [copy-button, clipboard, message-bubble, ux, tailwind]
dependency_graph:
  requires: [03-01]
  provides: []
  affects: [message-bubble]
tech_stack:
  added: []
  patterns: [navigator.clipboard, ChangeDetectorRef.markForCheck, Tailwind group-hover]
key_files:
  modified:
    - apps/frontend/src/app/chat/message-bubble/message-bubble.ts
    - apps/frontend/src/app/chat/message-bubble/message-bubble.html
decisions:
  - "Copy button positioned absolute top-right (top-1 right-1) inside group-relative wrapper, opacity-0 group-hover:opacity-100 fade on hover"
  - "Icon swaps copy→check SVG for 1500ms on success, then reverts — driven by copied boolean + markForCheck"
  - "Clipboard rejection handled silently (empty rejection callback, no console.log)"
  - "pr-8 added to bubble so markdown text does not run under the button"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  files_modified: 2
---

# Phase 3 Plan 02: Copy Button on Assistant Bubbles Summary

**One-liner:** Clipboard copy button with icon-swap feedback wired to assistant message bubbles only via Tailwind group-hover and OnPush-safe ChangeDetectorRef.

## What Was Built

A hover-revealed copy button sits in the top-right corner of every assistant message bubble. Clicking it copies the raw markdown text (`message.text`) to the clipboard via `navigator.clipboard.writeText`. On success the copy icon swaps to a check icon for 1500 ms then reverts. No copy button appears on user, error, or typing bubbles.

## Tasks Completed

| # | Task | Files | Commit |
|---|------|-------|--------|
| 1 | copyMessage handler + copied field in MessageBubble | message-bubble.ts | pending user commit |
| 2 | Copy button in assistant bubble template only | message-bubble.html | pending user commit |

## Implementation Details

### Task 1 — message-bubble.ts

- Added `copied = false` field.
- Injected `ChangeDetectorRef` via `inject()`.
- `copyMessage()` calls `navigator.clipboard.writeText(this.message.text)`.
  - On resolve: sets `copied = true`, calls `cdr.markForCheck()`, sets a 1500 ms timeout to reset `copied` to `false` and call `markForCheck()` again.
  - On reject: empty callback — no `console.log`, `copied` stays `false`.

### Task 2 — message-bubble.html

- Assistant (`@else`) branch outer div: added `group relative` classes and changed `px-4 py-2` to `px-4 pt-2 pb-2 pr-8` so markdown text does not run under the button.
- Added `<button>` inside that div:
  - `absolute top-1 right-1 p-1 rounded`
  - `opacity-0 group-hover:opacity-100 transition-opacity` — fades in on bubble hover
  - `hover:bg-gray-200 text-gray-500 hover:text-gray-700` — subtle highlight on the `bg-gray-100` bubble
  - `(click)="copyMessage()"`
  - `[attr.aria-label]` updates between "Copy message" and "Copied"
  - `@if (copied)` shows check SVG; `@else` shows copy SVG
  - `<span class="sr-only">` for screen reader label
- No button added to user, error, or typing branches.

## Verification

Build and lint must be run manually:

```
pnpm nx build frontend
pnpm nx lint frontend
```

Expected: no errors, no `any`, no `console.log`.

Manual checks:
- Hover over an assistant bubble → copy icon fades in top-right.
- Mouse-leave → icon fades out.
- Click → icon swaps to check mark for ~1.5 s, then reverts.
- Paste result in text editor → raw markdown (`#`, `*`, fenced code, etc.).
- User, error, and typing bubbles show no copy button.

## Deviations from Plan

None — plan executed exactly as written. The only minor discretionary choice was adding `pr-8` to the bubble padding (plan suggested `px-4 py-2`; the extra right padding keeps markdown text clear of the button) — this is within the "adjust padding/position so the icon clears the first line of content" guidance in the plan.

## Self-Check

- [x] `apps/frontend/src/app/chat/message-bubble/message-bubble.ts` — modified, contains `copyMessage`, `copied`, `inject(ChangeDetectorRef)`
- [x] `apps/frontend/src/app/chat/message-bubble/message-bubble.html` — modified, assistant branch has `group relative` wrapper and `<button>` with copy/check SVG swap
- [x] No copy button in user, error, or typing branches
- [ ] Build/lint — cannot run in this environment; user must verify manually
