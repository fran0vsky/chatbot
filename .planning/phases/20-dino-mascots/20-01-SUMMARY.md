---
phase: 20-dino-mascots
plan: 01
subsystem: ui
tags: [angular, tailwind, sharp, pixel-art, mascot, assets]

requires:
  - phase: 18-dino-abstraction
    provides: dino registry with per-dino `species` field
  - phase: 19-dino-picker
    provides: DinoCard, DinoPicker, active-dino chat header
provides:
  - "split-mascot.js + optimize-spino-assets.js generalized to N dinos (--all / <id> modes, Spino default preserved)"
  - "Mascot component renders per-dino pixel-art by dinoId + theme, with graceful SVG fallback"
  - "Per-dino mascots wired into DinoCard (Explore/picker) and the chat active-dino header"
  - "dinos/_src/ art-drop scaffold + README documenting the art spec and pipeline"
affects: [dino-platform, ui, mascot]

tech-stack:
  added: []
  patterns:
    - "Theme-aware images via the existing dark:/.night-mode dual-image pattern (no theme plumbing through presentational components)"
    - "Asset-missing graceful degradation: (error) handler flips Mascot to the Spino SVG fallback"

key-files:
  created:
    - apps/frontend/public/spino/dinos/_src/README.md
  modified:
    - scripts/split-mascot.js
    - scripts/optimize-spino-assets.js
    - libs/ui/src/lib/mascot/mascot.ts
    - libs/ui/src/lib/mascot/mascot.html
    - libs/ui/src/lib/mascot/mascot.stories.ts
    - libs/ui/src/lib/dino-card/dino-card.html
    - apps/frontend/src/app/chat/chat.html

key-decisions:
  - "Extended the SVG Mascot to render an <img> per-dino asset rather than touching MascotPanel — plan assumed Mascot rendered PNGs; reality was an inline SVG"
  - "theme input is OPTIONAL; default renders both day+night and lets .night-mode (dark:) toggle them, so DinoCard needs no theme plumbing and stays presentational"
  - "On asset load error the Mascot falls back to the Spino SVG, so the app renders cleanly before any per-dino art exists"

patterns-established:
  - "Per-dino assets live at /spino/dinos/{id}-{day|night}.png, source art at /spino/dinos/_src/{id}-dual.png"

requirements-completed: []  # MASC-06..08 are wiring-complete but NOT visually satisfied until human art lands (see below)

duration: ~25min
completed: 2026-05-29
---

# Phase 20: Dino Mascots Summary

**Pipeline + Mascot component + integration are wired for per-dino pixel-art mascots (day/night, crisp, with Spino fallback) — the art itself and visual QA remain as human steps.**

## Status: HUMAN-NEEDED (code complete, art pending)

This plan is intentionally `autonomous: false`. Tasks 2–4 (the codeable work) are
done and verified. Tasks 1 (pixel-art generation) and 5 (in-app visual QA) are
the maker's deliverables and are **not yet done**, so the phase is **not marked
complete** — the per-dino mascots currently fall back to the generic Spino until
art is dropped in and the pipeline is run.

## Performance

- **Tasks:** 3 of 5 (the 3 autonomous code tasks; 2 human-gated tasks pending)
- **Files modified:** 7 (+1 created)
- **Completed:** 2026-05-29

## Accomplishments

- **Task 2** — `split-mascot.js` refactored: the half-keying logic is now a reusable
  `splitDual()`. New modes: `--all` (split every `dinos/_src/*-dual.png`) and
  `<id>` (split one dino). No-arg still splits the original `dual-mascot.png`
  (backward compatible). `optimize-spino-assets.js` now also resizes every
  `dinos/*.png`, and guards missing base targets instead of crashing.
- **Task 3** — `Mascot` gained `dinoId` + optional `theme` inputs. With `dinoId`
  it renders `/spino/dinos/{dinoId}-{theme}.png` (crisp via `[image-rendering:pixelated]`);
  without it, the existing Spino SVG. Auto theme-sync when `theme` is omitted
  (day + night images toggled by `dark:`). On load error it falls back to the
  Spino SVG. Storybook story extended with `DinoDay`/`DinoNight`.
- **Task 4** — `<app-mascot [dinoId]="dino.id">` bound in `dino-card.html`
  (Explore gallery + picker) and the chat active-dino header. Both auto-sync theme.

## Files Created/Modified

- `scripts/split-mascot.js` — reusable `splitDual()`; `--all` / `<id>` / default modes
- `scripts/optimize-spino-assets.js` — processes `dinos/*.png`; defensive missing-file guards
- `libs/ui/src/lib/mascot/mascot.ts` — `dinoId` + optional `theme` inputs, asset-failed signal
- `libs/ui/src/lib/mascot/mascot.html` — img (auto/explicit theme) + SVG fallback under a sized wrapper
- `libs/ui/src/lib/mascot/mascot.stories.ts` — dino mascot stories
- `libs/ui/src/lib/dino-card/dino-card.html` — `[dinoId]="dino.id"`
- `apps/frontend/src/app/chat/chat.html` — active-dino header `[dinoId]="dino.id"`
- `apps/frontend/public/spino/dinos/_src/README.md` — art spec + pipeline instructions (created)

## Deviations from Plan

**1. [Plan assumption mismatch] Mascot was an SVG, not a PNG renderer**
- The plan's Task 3 assumed the `Mascot` component already rendered `mascot-{theme}.png`
  and just needed a `dinoId`. In reality `Mascot` rendered an inline **SVG**; the PNG
  mascot lived in `MascotPanel` (chat side panel, via CSS background-image).
- **Fix:** Extended `Mascot` to render an `<img>` when `dinoId` is set, keeping the
  SVG as the no-dino / asset-missing fallback. Honors the plan's key_link intent
  (`<app-mascot [dinoId]=...>` in DinoCard + chat) without disturbing MascotPanel.

**2. [Plan assumption mismatch] `theme` made optional; DinoCard uses `dino.id` not `dino().id`**
- Plan Task 4 referenced `dino().id` (signal accessor); `DinoCard` actually uses a
  plain `@Input() dino`, so the binding is `dino.id`.
- Threading a `theme` input through DinoCard/DinoPicker would break their
  presentational purity, so `theme` is optional and the component auto-syncs via the
  established `dark:`/`.night-mode` dual-image pattern (same as `MascotPanel`).

## Issues Encountered

- **`nx lint ui` does not pass — pre-existing, unrelated.** 10 errors exist in
  `input-composer.ts`, `message-bubble.ts`, `tool-call-bubble.ts`
  (`@nx/enforce-module-boundaries`: "Buildable libraries cannot import from
  non-buildable libraries") and `message-bubble.ts` empty-arrow-functions. None are
  in files this plan touched. My changed files (`mascot.*`, `dino-card.html`,
  `chat.html`) lint clean. `nx lint frontend` is green (1 pre-existing `main.ts`
  `no-console` warning). Recommend a separate quick task to fix the `ui` lib
  module-boundary config.

## Update — placeholder art generated (real art deferred)

At the maker's request, placeholder mascots were generated so the wiring is
visibly working now without spending time on art:
- `scripts/gen-placeholder-mascots.js` (created) tints the Spino silhouette per
  dino into `dinos/_src/{id}-dual.png`.
- Ran `split-mascot.js --all` + `optimize-spino-assets.js` → real assets now exist:
  `dinos/{rexford,veloce,glyphos,nimbus}-{day,night}.png`.
- Per-dino mascots now render (distinct by hue) in the Explore cards and chat header.

Real pixel-art (distinct species, `dual-mascot.png` style) is deferred to a tracked
todo: `.planning/todos/pending/2026-05-29-replace-placeholder-dino-mascots.md`.
**MASC-06/07 are functionally wired but not yet visually satisfied** (placeholders
are not distinct species), so the phase is not fully verified.

## Human Steps Remaining (plan Tasks 1 & 5 — real art still pending via the todo above)

**Task 1 — Generate the art (offline, no LLM usage):**
For each dino id (`rexford`, `veloce`, `glyphos`, `nimbus`), create a stacked
dual-mascot PNG (day palette on top, night on bottom, on solid black) following the
art spec, and save as `apps/frontend/public/spino/dinos/_src/{id}-dual.png`.
Full spec + roster in `apps/frontend/public/spino/dinos/_src/README.md`.

Then run the pipeline:
```bash
node scripts/split-mascot.js --all
node scripts/optimize-spino-assets.js
```

**Task 5 — Visual QA:** `pnpm nx serve frontend`, toggle day/night, confirm each
dino shows its own crisp species in the right palette in the Explore gallery and the
active chat header, readable at small sizes, no smoothing/blur.

## Next Phase Readiness

- Code + pipeline ready; the platform will show per-dino mascots the moment art
  lands in `_src/` and the pipeline runs.
- Phase stays **pending** until art + visual QA are done; re-run verification after.

---
*Phase: 20-dino-mascots*
*Status: human-needed (code complete, art + QA pending)*
