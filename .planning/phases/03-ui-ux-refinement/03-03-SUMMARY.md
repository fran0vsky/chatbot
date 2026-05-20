---
phase: "03"
plan: "03"
subsystem: frontend
tags: [chat-shell, placeholder, new-chat, send-button, header]
dependency_graph:
  requires: [03-01]
  provides: [rotating-placeholder, new-chat-reset, send-button-states, header-layout]
  affects: [chat.ts, chat.html, chat.service.ts]
tech_stack:
  added: []
  patterns: [OnInit/OnDestroy lifecycle, setInterval/clearInterval, OnPush markForCheck]
key_files:
  created: []
  modified:
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
    - apps/frontend/src/app/chat/chat.service.ts
decisions:
  - "placeholder field typed as `string` (not inferred const-tuple) to satisfy strict TS"
  - "Pencil/compose SVG chosen for New chat icon (cleanest match to existing inline-SVG style)"
  - "3000ms interval for placeholder rotation per D-06 discretion"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-20"
---

# Phase 3 Plan 03: Chat Shell Polish Summary

**One-liner:** Rotating textarea placeholder with stop-on-focus, New Chat button with threadId reset, header right-grouped controls, and send button hover/active states.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | `resetThread()` in ChatService | Done |
| 2 | `newChat()` handler in ChatComponent | Done |
| 3 | Rotating placeholder (OnInit/OnDestroy) | Done |
| 4 | Header layout + New chat icon button | Done |
| 5 | Send button hover/active styling | Done |

## What Was Built

### Task 1 — resetThread() in ChatService
`chat.service.ts`: Changed `readonly threadId` to `private threadId` and added `resetThread()` that reassigns `this.threadId = crypto.randomUUID()`. The `sendMessage()` method continues to read `this.threadId` unchanged.

### Task 2 — newChat() in ChatComponent
`chat.ts`: Added `newChat()` that clears `messages = []`, resets `draft = ''`, calls `chatService.resetThread()`, resizes the textarea back to one row via `autoResize`, and triggers `cdr.detectChanges()`.

### Task 3 — Rotating placeholder
`chat.ts`: Added `PLACEHOLDER_EXAMPLES` const tuple (4 prompts) and `PLACEHOLDER_NEUTRAL` constant. `ChatComponent` implements `OnInit` (starts 3000ms `setInterval` advancing through examples, calls `cdr.markForCheck()`) and `OnDestroy` (calls `stopPlaceholderRotation()`). `stopPlaceholderRotation()` clears the interval once and sets placeholder to neutral — idempotent. `chat.html` binds `[placeholder]="placeholder"`, `(focus)="stopPlaceholderRotation()"`, and `(input)="autoResize(textareaRef); stopPlaceholderRotation()"`.

### Task 4 — Header layout + New chat button
`chat.html`: Wrapped `<select>` and new `<button>` in `<div class="flex items-center gap-2">`. New chat button is icon-only with a pencil SVG, `[disabled]="isLoading"`, `disabled:opacity-50 disabled:cursor-not-allowed`, `hover:bg-gray-100 rounded transition`, and `<span class="sr-only">New chat</span>`. Button sits left of the selector per D-09.

### Task 5 — Send button styling
`chat.html`: Added `hover:bg-blue-600 active:scale-95 transition` to the existing send button Tailwind class string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict const-tuple inference on `placeholder` field**
- **Found during:** Build verification (Task 3)
- **Issue:** `placeholder = PLACEHOLDER_EXAMPLES[0]` inferred type as the literal string `"Explain quantum computing in simple terms..."`. Assigning any other example string or `PLACEHOLDER_NEUTRAL` caused TS2322 errors.
- **Fix:** Added explicit type annotation: `placeholder: string = PLACEHOLDER_EXAMPLES[0]`
- **Files modified:** `apps/frontend/src/app/chat/chat.ts`

## Verification

- `pnpm nx build frontend`: PASSED (0 errors)
- `pnpm nx lint frontend`: PASSED (0 errors, 1 pre-existing warning in `main.ts` — not our files)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary changes.

## Self-Check: PASSED

- `apps/frontend/src/app/chat/chat.ts` — exists, modified
- `apps/frontend/src/app/chat/chat.html` — exists, modified
- `apps/frontend/src/app/chat/chat.service.ts` — exists, modified
- `.planning/phases/03-ui-ux-refinement/03-03-SUMMARY.md` — this file
