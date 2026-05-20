---
phase: 05-further-ui-ux-work
plan: 02
status: complete
---

# Summary: 05-02 Chat Input Auto-Resize Refinement

## What was built

Two targeted fixes to the chat input textarea auto-resize (D-04, D-06):
computed line-height for the 5-line cap, and a scrollbar that appears only when
the textarea is capped at max height.

## Tasks completed

1. Added `atMaxHeight = false` field. Rewrote `autoResize()` to derive line
   height from `getComputedStyle(textarea).lineHeight` with a `parseFloat` NaN
   fallback to 24, compute `maxHeight = lineHeight * 5`, and set
   `atMaxHeight = scrollHeight > maxHeight`. `submit()` and `onKeydown()` unchanged.
2. Removed the static `overflow-hidden` class from the textarea and added
   `[class.overflow-y-auto]="atMaxHeight"` / `[class.overflow-hidden]="!atMaxHeight"`.

## Key files

### Modified
- libs/ui/src/lib/chat-input/chat-input.ts
- libs/ui/src/lib/chat-input/chat-input.html

## Verification

- Plan automated greps pass.
- `tsc --noEmit` on libs/ui passes clean; no `any` types used.
- `pnpm nx build frontend` NOT run — nx fails in this environment with
  `ERR_UNSUPPORTED_ESM_URL_SCHEME` under Node v24.12.0. Build + manual UAT pending.

## Deviations

None.

## Self-Check: PASSED (build verification deferred — see Verification)
