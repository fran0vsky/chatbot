---
created: 2026-05-29T14:17:07Z
completed: 2026-06-10
resolved_by: quick task 260610-qw4
title: Replace placeholder dino mascots with real pixel-art
area: ui
files:
  - apps/frontend/public/spino/dinos/_src/rexford-dual.png
  - apps/frontend/public/spino/dinos/_src/veloce-dual.png
  - apps/frontend/public/spino/dinos/_src/glyphos-dual.png
  - apps/frontend/public/spino/dinos/_src/nimbus-dual.png
  - scripts/gen-placeholder-mascots.js
---

## Problem

Phase 20 shipped the per-dino mascot pipeline + Mascot component wiring, but the
actual art is **placeholder** only: `scripts/gen-placeholder-mascots.js` tints the
generic Spino silhouette per dino (different hue, same shape). This does NOT meet
MASC-06/07 ("unique pixel-art mascot of a *distinct dinosaur species*, in the same
style as `dual-mascot.png`"). It exists so the wiring is demonstrable without
blocking on art.

Roster + species: rexford=Tyrannosaurus, veloce=Velociraptor, glyphos=Stegosaurus,
nimbus=Pteranodon (source of truth: `apps/backend/src/app/agents/dinos/dinos.ts`).

## Solution

1. Draw a stacked dual-mascot PNG per dino (day palette on top, night on bottom,
   solid black bg) matching the `dual-mascot.png` pixel-art style and the distinct
   species silhouette. Save to `apps/frontend/public/spino/dinos/_src/{id}-dual.png`,
   overwriting the placeholders. Full spec in `dinos/_src/README.md`.
2. Run the pipeline:
   ```
   node scripts/split-mascot.js --all
   node scripts/optimize-spino-assets.js
   ```
3. Visual QA (Phase 20 plan Task 5): `pnpm nx serve frontend`, toggle day/night,
   confirm each dino shows its own crisp species in the right palette across the
   Explore gallery and the chat active-dino header; readable at ~48px, no blur.
4. Once real art is in, `scripts/gen-placeholder-mascots.js` can be deleted.

## Resolution (2026-06-10, quick task 260610-qw4)

Done — all **6** dinos (the original 4 + `iris`/`vinci` added in later phases) now
ship real per-species pixel-art:
- `scripts/split-mascot.js` keyer replaced with **flood-fill** background removal —
  the old partial-alpha pass punched holes through shaded sprites.
- Bodies: `_src/{id}-dual.png` → `dinos/{id}-day.png` + `{id}-night.png` (≤800px).
- Head avatars: `dinos/avatars/{id}.png` (256² transparent) wired into the chat
  header + every assistant message bubble (modern chatbot pattern).
- `scripts/gen-placeholder-mascots.js` deleted; full-res masters kept in `_src/`.
