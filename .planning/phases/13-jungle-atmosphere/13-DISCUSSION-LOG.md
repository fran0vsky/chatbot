# Phase 13 Discussion Log

**Date:** 2026-05-25
**Mode:** default (single-question turns)

## Areas Selected
User selected all four presented gray areas:
1. Silhouette source & art direction
2. Theme switching mechanism
3. Component placement + layering
4. Gradient intensity

## Q1 — Silhouette source & art direction
**Options presented:**
- Inline SVG, hand-drawn organic (recommended)
- Inline SVG, simple stylized
- External SVG asset files

**User response:** "which option can get the most advanced moving forwards"
**Resolution:** Claude framed inline + hand-drawn as the most extensible option (per-path animation for Phase 16, currentColor theming for Phase 14, no asset pipeline). User accepted.
**Decision:** Inline SVG, hand-drawn organic. → D-01

## Q2 — Theme switching mechanism
**Options presented:**
- CSS-only via Tailwind `dark:` variant (recommended)
- Read isDayMode input/signal
- Inject theme service

**User selection:** CSS-only via Tailwind `dark:` variant.
**Decision:** Component takes no inputs, no services — both layers rendered, swapped by `dark:` utilities. → D-02

## Q3 — Component placement + layering
**Options presented:**
- Outer flex-row root — covers sidebar + chat (recommended)
- Inside `<main>` only — chat area
- Fixed body-level layer

**User selection:** Outer flex-row root.
**Decision:** Mount as first child of outer wrapper at z-0; sidebar + chat columns stay on z-10. → D-03

## Q4 — Gradient intensity
**Options presented:**
- Subtle / restrained (recommended)
- Pronounced sunset feel
- Asymmetric (subtle day, dramatic night)

**User selection:** Subtle / restrained.
**Decision:** Atmospheric, near-flat day gradient; gentle teal→coral horizon at night. Exact stops left to planner against `studio-*` tokens. → D-04

## Deferred Ideas Captured
- Drifting leaves / dust motion → Phase 16 (stretch)
- Animated gradient transitions → no concrete request
- Parallax on scroll → no scroll relationship to bg
- Per-route bg variants → no other routes exist

## Claude's Discretion Items
- Exact silhouette SVG path geometry (hand-shaped during execution)
- Single `<svg>` with two `<g>` groups vs two `<svg>` elements
- Tailwind `bg-gradient-to-b` utility vs arbitrary-value `bg-[linear-gradient(...)]`
- Where `relative` class is applied on the outer root
- Component path: defaulting to `libs/ui/src/lib/jungle-background/`

---
*Discussion log preserved for human reference; not consumed by downstream agents.*
