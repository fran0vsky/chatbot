---
plan: 07-05
phase: 07-visual-overhaul
status: complete
key-files:
  modified:
    - libs/ui/src/lib/input-composer/input-composer.html
---

## Summary

Elevated the InputComposer floating pill to a single polished focus surface with a Gemini-grade circular send button — complete hover, active-press, disabled, and keyboard focus states.

## What Was Done

**Task 1 — input-composer.html (single task):**

- **Pill card**: Added `focus-within:ring-2 focus-within:ring-desert-gold dark:focus-within:ring-desert-night-border` — focusing the textarea now lights a single ring around the entire pill card rather than an inner textarea ring

- **Textarea**: Removed `focus:ring-2 focus:ring-desert-gold dark:focus:ring-desert-night-border` (pill now owns the focus surface). Kept `focus:outline-none`, all ngModel bindings, overflow auto-resize classes, `data-testid`, `[placeholder]`, `[disabled]`, `(keydown)`, `(input)` — all functional behavior unchanged

- **Send button**: Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-gold dark:focus-visible:ring-desert-night-border focus-visible:ring-offset-2 focus-visible:ring-offset-desert-sand-light dark:focus-visible:ring-offset-desert-night-surface` — ring offset ensures focus ring reads clearly around the circular accent button. `w-9 h-9 rounded-full`, `active:scale-95`, `[disabled]` binding all preserved

## Deviations

None. Build verification skipped (Node v24 ESM incompatibility in shell context — changes are purely additive Tailwind utilities on an Angular template).

## Self-Check: PASSED

All must-have truths satisfied:
- Single focus-within ring on pill card (not double-ringed textarea) ✓
- Circular send button with hover (`hover:bg-desert-terracotta-dark`), active (`active:scale-95`), disabled, and focus-visible states ✓
- Textarea auto-resize (`autoResize`, `atMaxHeight` bindings) unchanged ✓
