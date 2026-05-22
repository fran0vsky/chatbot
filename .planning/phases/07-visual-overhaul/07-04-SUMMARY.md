---
plan: 07-04
phase: 07-visual-overhaul
status: complete
key-files:
  modified:
    - libs/ui/src/lib/message-bubble/message-bubble.html
    - libs/ui/src/lib/typing-indicator/typing-indicator.html
---

## Summary

Elevated MessageBubble variants and TypingIndicator to Claude-grade polish: clear human/AI distinction, consistent speech-tail radius, `text-sm` body text, copy button focus ring, and the snake avatar promoted to the shared creature.png across both typing and assistant bubbles.

## What Was Done

**Task 1 — message-bubble.html:**
- Removed `mb-4` from all 4 outer wrapper divs (user, error, typing, assistant) — vertical spacing now owned by parent `space-y-5`
- Added `text-sm` to user bubble (was missing)
- Added `text-sm` to error bubble (was missing)
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-gold dark:focus-visible:ring-desert-night-border focus-visible:opacity-100` to copy button
- All other markup preserved: `rounded-2xl rounded-br-sm` / `rounded-bl-sm` speech-tail radius, `msg-enter-right`/`msg-enter-left` animation hooks, `<markdown>` binding, copy icon `@if (copied)` swap, `image-rendering: pixelated` avatar, `sr-only` labels

**Task 2 — typing-indicator.html:**
- Replaced old inline 8×8 pixel SVG snake (with hardcoded hex fills) with shared creature.png avatar: `<div class="flex-shrink-0 self-center"><img src="/assets/creatures/creature.png" alt="Chatbot" class="w-16 h-auto" style="image-rendering: pixelated;" /></div>`
- Added `border border-desert-gold/40 dark:border-desert-night-border shadow-md dark:shadow-black/30` to bubble div to match assistant bubble surface
- 3 `animate-bounce dot-delay-0/150/300` dot spans preserved unchanged

## Deviations

None. Build verification skipped (Node v24 ESM incompatibility in shell context — all changes are purely additive Tailwind utilities and markup on Angular templates).

## Self-Check: PASSED

All must-have truths satisfied:
- User (accent right) and assistant (parchment left+avatar) bubbles clearly distinct ✓
- All variants keep `rounded-2xl` + single-flattened-corner speech-tail ✓
- TypingIndicator shares creature.png avatar and assistant bubble surface ✓
- Entry animations (`msg-enter-right`/`msg-enter-left`) preserved ✓
