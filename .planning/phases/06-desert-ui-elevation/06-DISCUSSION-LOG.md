# Phase 6: Desert UI Elevation — Discussion Log

**Date:** 2026-05-20
**Areas discussed:** Snake avatar shape, Background cacti layout, Input pill structure, Typography choice

---

## Area 1: Snake Avatar Shape

| Question | Options | Selected |
|----------|---------|----------|
| Coiled or profile? | Profile/S-curve, Coiled/top-down | Profile/S-curve |
| Grid size? | 24×24, 16×16 | 24×24 |
| Forked tongue? | Yes, No | Yes |
| Color palette? | Existing cactus-green tokens, New snake-specific green | Existing cactus-green tokens |

**Notes:** Profile orientation reads instantly as snake at small sizes. Forked tongue is the key identifier. No new color tokens needed.

---

## Area 2: Background Cacti Layout

| Question | Options | Selected |
|----------|---------|----------|
| Placement? | Fixed corners/edges, Scattered sides, Bottom edge only | Fixed corners/edges |
| SVG or CSS? | Inline SVG, CSS background-image | Claude's discretion → inline SVG |
| How many? | 3, 2, 4–5 | 4–5 |
| Opacity? | 5%/3%, 8%/4%, You decide | ~5% light / ~3% dark |

**Notes:** User left SVG vs CSS to implementer — inline SVG chosen for better Tailwind dark mode control.

---

## Area 3: Input Pill Structure

| Question | Options | Selected |
|----------|---------|----------|
| Floating or keep border-t? | Float with shadow, Keep border-t | Float with shadow |
| Corner style? | rounded-2xl, rounded-full | (answered via freeform — centered narrower pill) |
| Width? | ~60%, max-w fixed, 50% | ~55% (between 50–60%) — user noted future sidebar need |
| Vertical position? | Sticky + padding gap, Flush bottom | Sticky with padding gap |
| Messages also narrow? | Stay full-width, Also centered | Messages stay full-width |
| Send button? | Circular rounded-full, Keep square | Circular rounded-full |

**Notes:** User explicitly mentioned anticipating a chat history sidebar on the left in a future phase — the ~55% width is intentional to leave side clearance. This is logged as a deferred idea.

---

## Area 4: Typography Choice

| Question | Options | Selected |
|----------|---------|----------|
| Font direction? | Keep Playfair Display, Cinzel, Abril Fatface | Cinzel |
| Casing? | All-caps CHATBOT, Title case Chatbot | All-caps CHATBOT |

**Notes:** Cinzel chosen for its Roman-inscription / frontier-carved quality. Requires one Google Fonts import — user accepted this as the only new dependency.

---

## Claude's Discretion Items

- Inline SVG chosen over CSS background-image for cacti (better Tailwind dark mode class control)
- Optional color tweaks (warmer darks, crisper light mode) left to implementer judgment — no specific decisions made

## Deferred Ideas

- **Chat history sidebar** — user mentioned this is a likely future phase after upcoming mentoring session. Phase 6 input pill width (~55%) leaves intentional room on both sides.
