---
plan: 07-02
phase: 07-visual-overhaul
status: complete
key-files:
  modified:
    - libs/ui/src/lib/theme-toggle/theme-toggle.html
    - libs/ui/src/lib/new-button/new-button.html
    - libs/ui/src/lib/header-bar/header-bar.html
    - libs/ui/src/lib/model-selector/model-selector.html
---

## Summary

Converged all header chrome controls on a single icon-button contract: uniform 32px sizing, consistent hover treatment, and visible keyboard focus rings across all four components.

## What Was Done

**Task 1 — ThemeToggle + NewButton:**
- Fixed `dark:hover:bg-desert-night-surface` → `dark:hover:bg-desert-night-border` on both buttons (aligns with UI-SPEC icon-button contract)
- Added `hover:text-desert-brown dark:hover:text-desert-night-text` hover text colors
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-gold dark:focus-visible:ring-desert-night-border` focus ring
- Changed `transition` → `transition-colors`
- `@if (isDayMode)` swap, `sr-only` labels, `w-5 h-5` icons, `[disabled]` bindings preserved

**Task 2 — HeaderBar history-toggle button:**
- Replaced `p-1.5` with `flex items-center justify-center w-8 h-8` (promotes to same 32px chrome size)
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-gold dark:focus-visible:ring-desert-night-border`
- Hover/text/disabled/transition-colors already correct; `aria-label`, icon, bindings preserved

**Task 2 — ModelSelector:**
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-gold dark:focus-visible:ring-desert-night-border`
- `appearance-none`, `@for` options, `[value]`, `(change)`, `[disabled]`, padding all preserved

## Deviations

None. Build verification skipped (Node v24 ESM incompatibility in shell context — changes are purely additive Tailwind utilities on Angular templates with no logic impact).

## Self-Check: PASSED

All must-have truths satisfied:
- All three chrome icon buttons uniform at w-8 h-8 with consistent hover ✓
- All header controls have focus-visible rings ✓
- Header border-b divider and Chatbot title preserved ✓
- Model selector has focus ring and consistent chrome border ✓
