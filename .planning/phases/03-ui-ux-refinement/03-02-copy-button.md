# Plan 03-02: Copy Button on Assistant Bubbles

**Phase:** 3 — UI/UX Refinement
**Wave:** 2 — depends on 03-01 (both edit `message-bubble.*`; run after 03-01 to avoid conflicts)
**Requirements:** D-08, D-10
**Files touched:** `apps/frontend/src/app/chat/message-bubble/message-bubble.ts`, `apps/frontend/src/app/chat/message-bubble/message-bubble.html`

## Objective

A small copy icon appears on hover over **assistant** message bubbles only. Clicking copies the raw markdown text (`message.text`, not rendered HTML) to the clipboard. No copy button on user, error, or typing bubbles. No regenerate button (D-10 — nothing to add).

## Required reading before starting

- `.planning/phases/03-ui-ux-refinement/03-CONTEXT.md` — D-08, code context
- `apps/frontend/CLAUDE.md` — standalone, OnPush, Tailwind-only, no `any`, no `console.log`
- The post-03-01 state of `message-bubble.html` (assistant branch now uses `<markdown [data]="message.text">`).

## Tasks

### Task 1 — Copy handler in MessageBubble
- Add a `copyMessage()` method to `message-bubble.ts` that calls `navigator.clipboard.writeText(this.message.text)`.
- Add a `copied` boolean field for transient feedback: on success set `copied = true`, reset to `false` after ~1500ms via `setTimeout`; call `markForCheck()` (inject `ChangeDetectorRef`) since the component is OnPush.
- Handle the `writeText` promise rejection silently (clipboard may be blocked) — no `console.log`; leave `copied` false.
- **Commit:** `feat(frontend): add copy-to-clipboard handler to MessageBubble`

### Task 2 — Copy button in the assistant bubble
- In `message-bubble.html`, the assistant `@else` branch only: make the bubble's outer wrapper a hover group (`class="... group relative"` on the wrapping div) so the button can be positioned and revealed on hover.
- Add an icon-only `<button type="button">` positioned top-right of the bubble (`absolute top-1 right-1` or similar), hidden by default and shown on hover via `opacity-0 group-hover:opacity-100 transition` (fade-in — Claude's discretion per D-08).
- Button shows an inline copy-icon SVG; swap to a check icon (or keep copy icon) when `copied` is true. Follow the existing inline-SVG pattern. Small + subtle: `w-4 h-4` icon, muted color, `hover:bg-gray-200 rounded` (it sits on a `bg-gray-100` bubble).
- Add `(click)="copyMessage()"` and `<span class="sr-only">Copy message</span>`.
- Do **not** add the button to the user, error, or typing branches.
- Ensure the button does not overlap rendered markdown awkwardly — bubble already has `px-4 py-2`; adjust padding/position so the icon clears the first line of content.
- **Commit:** `feat(frontend): show copy button on assistant bubble hover`

## Verification

- `pnpm nx build frontend` and `pnpm nx lint frontend` pass — no `any`, no `console.log`.
- Manual:
  - Hovering an assistant bubble reveals the copy icon top-right; it fades out on mouse-leave.
  - Clicking copies the raw markdown — paste into a text editor shows `#`, `*`, fenced code, etc., not rendered HTML.
  - Brief visual feedback (icon swap) after copying, then reverts.
  - User, error, and typing bubbles show no copy button.

## Done when

Both commits landed, build + lint green, manual checks pass.
