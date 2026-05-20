# Plan 03-03: Chat Shell Polish — Placeholder, New Chat, Send Button, Header

**Phase:** 3 — UI/UX Refinement
**Wave:** 1 (parallel with 03-01; no file overlap)
**Requirements:** D-05, D-06, D-07, D-09, D-11, D-12, D-13
**Files touched:** `apps/frontend/src/app/chat/chat.ts`, `apps/frontend/src/app/chat/chat.html`, `apps/frontend/src/app/chat/chat.service.ts`

## Objective

Polish the chat shell: a rotating textarea placeholder that stops on focus/typing, a "New chat" button in the header that resets the conversation, refined send-button hover/active states, and a finalized header layout (title left; model selector + New chat grouped right).

## Required reading before starting

- `.planning/phases/03-ui-ux-refinement/03-CONTEXT.md` — D-05..D-13, code context
- `apps/frontend/CLAUDE.md` — standalone, OnPush, Tailwind-only, no inline styles, no `console.log`
- Prior decisions: 01-CONTEXT D-10 (input disabled during loading), 02-CONTEXT D-05/D-07 (selector right-aligned, disabled during loading)

## Tasks

### Task 1 — `resetThread()` in ChatService
- In `chat.service.ts`, change `readonly threadId` to a mutable private/public field and add a `resetThread()` method that reassigns `this.threadId = crypto.randomUUID()`.
- Keep `threadId` readable by `sendMessage()`; existing behavior on first load (fresh id) is unchanged.
- **Commit:** `feat(frontend): add resetThread to ChatService for new chat`

### Task 2 — "New chat" logic in ChatComponent
- Add a `newChat()` method to `chat.ts`: clears `messages` to `[]`, resets `draft` to `''`, calls `chatService.resetThread()`, calls `cdr.detectChanges()`. No confirmation dialog (D-09).
- Resize the textarea back to one row after clearing the draft (reuse `autoResize` with `textareaRef`).
- **Commit:** `feat(frontend): add newChat handler to ChatComponent`

### Task 3 — Rotating placeholder
- In `chat.ts`, add a `placeholder` field initialized to a first example string and a private list of 4 example prompts. Suggested set (Claude's discretion per D-06): `"Explain quantum computing in simple terms..."`, `"Write a poem about the ocean..."`, `"Help me debug a TypeScript error..."`, `"Summarize the history of jazz..."`.
- In `ngOnInit` (implement `OnInit`), start `setInterval` (3000ms, D-06/discretion) that advances `placeholder` to the next example and calls `cdr.markForCheck()`.
- Stop rotation permanently the first time the user focuses the textarea or types: clear the interval via `clearInterval` and store the timer id so it is only cleared once. On stop, set `placeholder` to a plain neutral string (`"Message"`) so it no longer cycles.
- Implement `OnDestroy` and clear the interval there too (no leaks).
- Bind `[placeholder]="placeholder"` on the textarea in `chat.html`; add `(focus)="stopPlaceholderRotation()"`. The existing `(input)` handler also calls `stopPlaceholderRotation()` (keep `autoResize` too).
- No external library (D-07). No `console.log`.
- **Commit:** `feat(frontend): rotate textarea placeholder through example prompts`

### Task 4 — Header layout + New chat button
- In `chat.html` header (lines 2-13): keep `<h1>Chatbot</h1>` anchored left. Wrap the `<select>` and a new New-chat `<button>` in a `<div class="flex items-center gap-2">` on the right (D-13). The New chat button sits to the **left** of the selector (D-09).
- New chat button: icon-only `<button type="button">` with an inline SVG (compose/pencil or plus — Claude's discretion; pick the cleanest, follow the existing inline-SVG pattern used for the send arrow). Add `[disabled]="isLoading"` and matching `disabled:opacity-50 disabled:cursor-not-allowed` styling so it behaves like the selector during loading. Add `(click)="newChat()"` and an `<span class="sr-only">New chat</span>` for accessibility.
- Style with Tailwind utilities only — give it a subtle hover (e.g. `hover:bg-gray-100 rounded transition`).
- **Commit:** `feat(frontend): add New chat button to header`

### Task 5 — Send button styling refinement
- In `chat.html`, the submit `<button>` (lines 38-47): keep icon-only (D-11, no label). Refine the enabled-state interaction — add `hover:bg-blue-600 active:scale-95 transition` (or equivalent Tailwind) to the existing `bg-blue-500` button.
- Do not change disabled styling or the `[disabled]` binding. No keyboard hint text (D-12).
- **Commit:** `style(frontend): refine send button hover and active states`

## Verification

- `pnpm nx build frontend` and `pnpm nx lint frontend` pass — no `any`, no unused vars, no `console.log`.
- Manual:
  - On load, placeholder cycles through examples ~every 3s; cycling stops the moment you focus or type, and does not resume.
  - "New chat" clears the transcript, resets the draft, and a follow-up message shows no memory of the prior conversation (new threadId).
  - New chat button and selector are grouped on the right, both disabled while a response is loading.
  - Send button has a visible hover and a press (scale) feedback when enabled.

## Done when

All five commits landed, build + lint green, manual checks pass.
