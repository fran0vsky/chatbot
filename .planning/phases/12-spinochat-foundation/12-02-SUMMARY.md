---
phase: 12-spinochat-foundation
plan: 02
subsystem: ui
tags: [tailwind, palette, theming]
requires:
  - phase: 11-reasoning-thinking-display
    provides: studio-* token system across app + ui lib + storybook
provides:
  - jungle day palette (sand + sunlit greens) on studio-* day tokens
  - deep teal night palette with sunset coral accents on studio-night-* tokens
  - storybook preview vars re-mapped to the new palette
affects: [12-03-mascot, all future phases that read studio-* tokens]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - apps/frontend/tailwind.config.js
    - libs/ui/tailwind.config.js
    - libs/ui/.storybook/styles.scss
key-decisions:
  - "Pure hex-only re-map per PAL-04 — no token rename, no template changes, both tailwind configs kept byte-identical inside `colors`"
  - "Storybook scss vars updated to keep preview iframe consistent with the running app"
patterns-established:
  - "Palette evolution rule: change hex values in lockstep across frontend + ui tailwind configs; templates remain untouched"
requirements-completed: [PAL-01, PAL-02, PAL-03, PAL-04]
duration: 5min
completed: 2026-05-25
---

# Phase 12 Plan 02: Jungle Palette Re-Map

**Swapped Soft Studio cream/tan + slate palette for a jungle palette — sand + sunlit greens by day, deep teal with sunset coral accents by night — keeping all studio-* token names intact.**

## Accomplishments
- Day palette: warm sand bg `#F1ECDA`, jungle accent `#5C8A3A`
- Night palette: deep teal bg `#0A1A28`, sunset coral accent `#E87850`
- WCAG AA verified on all four body-text pairings (all well above 4.5:1)

## Files Modified
- `apps/frontend/tailwind.config.js`
- `libs/ui/tailwind.config.js`
- `libs/ui/.storybook/styles.scss`

## WCAG AA contrast check (PAL-03)

| Pairing | Ratio | Status |
|---------|-------|--------|
| studio-ink #1F2A1A on studio-bg #F1ECDA | ~12.6:1 | PASS |
| studio-ink on studio-card #E2DAB8 | ~10.7:1 | PASS |
| studio-night-text #EDE6D6 on studio-night #0A1A28 | ~14.1:1 | PASS |
| studio-night-text on studio-night-card #163148 | ~10.7:1 | PASS |

## Self-Check: PASSED

- both tailwind configs contain all 16 new hex values and no prior `#FAFAF7` / `#B8845F` / `#0F1419` / `#D4A574` references
- storybook styles.scss preview vars updated to jungle palette
- darkMode + fontFamily blocks unchanged
