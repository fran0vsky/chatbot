---
phase: 05-further-ui-ux-work
plan: 01
status: complete
---

# Summary: 05-01 Message Bubble Entry Animations

## What was built

Slide+fade entry animations for chat message bubbles. New bubbles mounted during
an active session animate in from their own side (user → from right;
assistant/error/typing → from left) over 150ms ease-out. The greeting (initial
render and after new-chat reset) appears instantly.

## Tasks completed

1. Added `@Input() animate = false` to `MessageBubble` — no Angular animations import.
2. Appended `@keyframes msg-slide-fade-right/left`, `.msg-enter-right/left` (150ms
   ease-out) and a `prefers-reduced-motion: reduce` fallback to `message-bubble.scss`.
3. Bound `[class.msg-enter-right]="animate"` on the user branch and
   `[class.msg-enter-left]="animate"` on the error, typing, and assistant branches.
   Wrapped the typing indicator in a plain `<div>` to carry the class.
4. Wired `[animate]="$index >= 1"` on the `@for` bubble and `[animate]="true"` on
   the typing bubble in `chat.html`.

## Key files

### Modified
- libs/ui/src/lib/message-bubble/message-bubble.ts
- libs/ui/src/lib/message-bubble/message-bubble.html
- libs/ui/src/lib/message-bubble/message-bubble.scss
- apps/frontend/src/app/chat/chat.html

## Verification

- All plan automated greps pass.
- `tsc --noEmit` on libs/ui passes clean.
- `pnpm nx build frontend` NOT run — nx fails in this environment with
  `ERR_UNSUPPORTED_ESM_URL_SCHEME` under Node v24.12.0 (environment issue,
  unrelated to these changes). Build verification + manual UAT pending.

## Deviations

None.

## Self-Check: PASSED (build verification deferred — see Verification)
