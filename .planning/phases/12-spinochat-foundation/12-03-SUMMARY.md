---
phase: 12-spinochat-foundation
plan: 03
subsystem: ui
tags: [mascot, svg, angular, standalone-component]
requires:
  - phase: 12-spinochat-foundation
    provides: brand naming (12-01) and jungle palette (12-02) the mascot inherits its accent color from
provides:
  - standalone `Mascot` component (libs/ui) with `size: 'sm' | 'hero'` input
  - Spinosaurus SVG with sail back, long snout, bipedal stance (replaces capybara)
  - hero mascot in landing/empty state above the greeting + input composer
  - small mascot beside every assistant MessageBubble (unchanged 56x56 footprint)
affects: [13-jungle-atmosphere, 14-mascot-animations, future hero/landing-state work]
tech-stack:
  added: []
  patterns:
    - "Single-source mascot component drives both small (bubble) and hero (landing) renderings via size input"
key-files:
  created:
    - libs/ui/src/lib/mascot/mascot.ts
    - libs/ui/src/lib/mascot/mascot.html
  modified:
    - libs/ui/src/index.ts
    - libs/ui/src/lib/message-bubble/message-bubble.ts
    - libs/ui/src/lib/message-bubble/message-bubble.html
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
key-decisions:
  - "Used @Input() decorator consistent with every other component in libs/ui (not signal-input — the plan's `size()` reference is inconsistent with the lib's existing pattern)"
  - "Mascot inherits color via currentColor from a parent wrapper carrying `text-studio-accent dark:text-studio-night-accent` — keeps theme switching free"
patterns-established:
  - "Presentational mascot component pattern: standalone, OnPush, single Input toggles size class binding, no services"
requirements-completed: [MASC-01, MASC-02, MASC-05]
duration: 8min
completed: 2026-05-25
---

# Phase 12 Plan 03: Spinosaurus Mascot Integration

**Replaced the capybara SVG with a Spinosaurus mascot extracted into a reusable standalone `Mascot` component, and placed a hero rendering in the landing state above the input composer.**

## Accomplishments
- New `libs/ui/src/lib/mascot/` component with `size: 'sm' | 'hero'` input
- MessageBubble assistant role now renders `<app-mascot size="sm" />` in the same 56x56 footprint
- Landing/empty state renders `<app-mascot size="hero" />` (~128px / md:160px) above the greeting bubble
- Mascot color follows `currentColor` from `text-studio-accent` / `dark:text-studio-night-accent` wrappers — day = jungle green, night = sunset coral

## Files Created
- `libs/ui/src/lib/mascot/mascot.ts` — `Mascot` standalone component, OnPush, `@Input() size`
- `libs/ui/src/lib/mascot/mascot.html` — Spinosaurus SVG, viewBox `0 0 64 64`, size classes bound via `[class.*]`

## Files Modified
- `libs/ui/src/index.ts` — re-export Mascot from `@chatbot/ui` barrel
- `libs/ui/src/lib/message-bubble/message-bubble.{ts,html}` — import Mascot, replace inlined capybara SVG with `<app-mascot size="sm" />`
- `apps/frontend/src/app/chat/chat.{ts,html}` — import Mascot, add hero block to landing state

## Self-Check: PASSED

- `Mascot` exported from `@chatbot/ui` barrel
- MessageBubble.html contains `<app-mascot size="sm"` once and zero capybara coordinates
- chat.html contains `<app-mascot size="hero" />` exactly once, inside the landing `@if` branch above the greeting bubble
- SVG contains all 9 shape elements (body, tail, sail path with Q control points, neck, snout, eye, eye highlight, two legs, ground shadow)
- Theme switching unchanged: `currentColor` inheritance from existing accent wrapper classes
