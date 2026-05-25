# Phase 13: Jungle Atmosphere — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a single shared `JungleBackground` component that paints a theme-aware atmospheric layer behind the entire app — subtle vertical gradient + low-opacity edge silhouettes (ferns by day, palms by night). Background reads day/night via Tailwind's `dark:` variant — no input, no service, no parent wiring. Mounts at the outer flex-row root above the sidebar + chat columns at `z-0`, with existing chat/sidebar content already promoted to `z-10`. Inline, hand-drawn SVG silhouettes inherit color via `currentColor` so themed paths and any future motion layer (Phase 16) attach to the same element tree. No animation in this phase.

</domain>

<decisions>
## Implementation Decisions

### Silhouette Source & Art Direction

- **D-01:** **Inline SVG, hand-drawn organic silhouettes** authored inside the `JungleBackground` component template.
  - Future-proof for Phase 14 (mascot motion can coexist) and especially Phase 16 (drifting leaves / dust) — individual `<path>` and `<g>` elements can be animated, faded, or filtered without an asset pipeline.
  - Themable via `currentColor` — one Tailwind class on the wrapper drives day vs night silhouette tint; matches the Phase 12 mascot pattern (`text-studio-accent dark:text-studio-night-accent`).
  - No asset build step, no rasterization risk under motion, no CSS-filter color tricks.
  - Hand-drawn fronds (irregular leaflet shapes) over geometric/stylized — reads as "prehistoric jungle" rather than "generic decoration."
  - Two distinct silhouette compositions: day = fern frond band (lower, lighter, denser leaflets); night = palm silhouettes with taller trunks against the horizon.

### Theme Switching Mechanism

- **D-02:** **CSS-only via Tailwind `dark:` variant.** Component takes no inputs and injects no service.
  - Component renders both day-layer and night-layer SVG groups; day layer uses `dark:hidden`, night layer uses `hidden dark:block` (or `opacity-0 dark:opacity-100` if a future cross-fade is wanted — planner picks the cleanest one).
  - Keeps `JungleBackground` purely presentational per the project's component-architecture rule (libs/ui split): no domain word in the name, no injected services, Storybook-testable in isolation.
  - Zero CD work; relies on the existing `documentElement.classList` `dark` toggle that already drives the rest of the palette.

### Component Placement & Layering

- **D-03:** **Mount as the first child of the outer `<div class="flex flex-row h-screen">` root** in [apps/frontend/src/app/chat/chat.html](../../../apps/frontend/src/app/chat/chat.html).
  - Sidebar and chat column both float over the same atmospheric layer → cohesive across the app even when the history sidebar is open.
  - `<app-jungle-background>` carries `absolute inset-0 z-0 pointer-events-none` (or planner's preferred non-interactive equivalent).
  - The outer root needs `relative` added so the absolute child anchors correctly; sidebar + chat column wrappers stay at `relative z-10` (chat already does this; sidebar inherits or gains the same).
  - Never overlaps content because content is on its own z-layer (BG-acceptance: "Background never overlaps message content or interactive elements" — z-stacking enforces this structurally).

### Gradient Intensity

- **D-04:** **Subtle / restrained gradient** for both modes — atmospheric, never competing with chat content.
  - Day: near-flat warm vertical gradient on the `studio-bg` family — sand at top, faintly warmer/greener at bottom. Target luminance shift ~5–8%, well within the body-text WCAG AA contrast that PAL-03 already verified.
  - Night: gentle deep-teal-to-warm-coral toward the bottom horizon — uses existing `studio-night` + `studio-night-accent` tokens; horizon warmth telegraphs "sunset jungle" without going full magenta-sunset.
  - Exact gradient stops/percentages chosen by the planner against the `studio-*` palette already locked in Phase 12 — researcher does NOT need to invent a new palette.

### Claude's Discretion

- Exact silhouette SVG path geometry — hand-shaped during execution; goal is "reads as fern/palm at 200px tall" not a specific reference image.
- Whether silhouettes use a single `<svg>` with day/night `<g>` siblings vs two stacked `<svg>` elements — planner picks whichever keeps the template simplest.
- Exact gradient implementation: Tailwind `bg-gradient-to-b from-* to-*` utility vs custom CSS gradient in a `style` block. Prefer the Tailwind utility if both colors map cleanly to existing tokens; fall back to inline `linear-gradient(...)` with `var(--*)` if intermediate stops are needed. (Tailwind-only rule still allows arbitrary value syntax `bg-[linear-gradient(...)]` — planner picks.)
- Where the `relative` class is added on the outer root (chat.html host vs the root `<div>` itself) — planner picks.
- Whether the component lives at `libs/ui/src/lib/jungle-background/` (consistent with Mascot) — yes, default to that unless a stronger placement reason emerges.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope (this milestone's locked requirements)
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — BG-01, BG-02, BG-03 (v1.1 milestone). MUST read.
- [.planning/ROADMAP.md](../../ROADMAP.md) — Phase 13 success criteria (5 items).

### Prior phase context (carries forward)
- [.planning/phases/12-spinochat-foundation/12-02-SUMMARY.md](../12-spinochat-foundation/12-02-SUMMARY.md) — Jungle palette hex values on the `studio-*` token system the gradient reads from. No new tokens this phase.
- [.planning/phases/12-spinochat-foundation/12-03-SUMMARY.md](../12-spinochat-foundation/12-03-SUMMARY.md) — Mascot component pattern + `currentColor` theming via `text-studio-accent dark:text-studio-night-accent` wrapper. Reuse this for silhouette tinting.

### Frontend touchpoints
- [apps/frontend/src/app/chat/chat.html](../../../apps/frontend/src/app/chat/chat.html) — outer flex-row root where `<app-jungle-background>` mounts; sidebar + chat column already structured around it.
- [apps/frontend/src/app/chat/chat.ts](../../../apps/frontend/src/app/chat/chat.ts) — host component, imports `JungleBackground`.
- [apps/frontend/tailwind.config.js](../../../apps/frontend/tailwind.config.js) — `studio-bg`, `studio-surface`, `studio-night`, `studio-night-surface`, `studio-night-accent` tokens used for gradient stops.

### New asset
- `libs/ui/src/lib/jungle-background/jungle-background.{ts,html}` — new standalone OnPush component, no inputs, no services, exported from `libs/ui/src/index.ts`. Storybook story expected per project profile.

### Frontend conventions (binding)
- [apps/frontend/CLAUDE.md](../../../apps/frontend/CLAUDE.md) — standalone + OnPush + Tailwind-only.
- Memory: presentational components (no domain word, no injected services, Storybook required) — `JungleBackground` qualifies as presentational.

### Out of phase scope (defer to later phases)
- Phase 14: mascot motion (Rive integration is independent of background).
- Phase 16 (stretch): animated drifting leaves / dust layer — the inline-SVG structure decided here intentionally enables it but does NOT implement it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`studio-*` palette tokens** (Phase 12) — both day and night palette values are already locked; gradient just reads them.
- **Mascot `currentColor` theming pattern** (Phase 12 Plan 03) — `text-studio-accent dark:text-studio-night-accent` on a wrapper drives SVG color. Same pattern applies to silhouettes (probably at a more muted shade — `studio-accent-dark` / `studio-night-border` or similar muted token; planner picks).
- **`z-10` layering on chat content** (chat.html, already in place) — landing-state wrapper, message-list wrapper, and sticky input all carry `relative z-10`. New bg slots in at z-0 without re-layering existing markup.
- **Tailwind `dark:` variant infrastructure** — `document.documentElement` carries the `dark` class via the existing theme toggle; no new mechanism needed.

### Established Patterns
- **Presentational vs smart split**: `JungleBackground` is presentational — no domain word ("background" is visual), no services, Storybook story required.
- **Standalone + OnPush + Tailwind-only** across libs/ui.
- **Single-source component with size/variant inputs** (Mascot's `size` input). `JungleBackground` does NOT need variants — theme is CSS-driven; one component, zero inputs.

### Integration Points
- `chat.html` outer root — adds one new line: `<app-jungle-background />` as the first child; outer wrapper gains `relative` if not already present.
- `libs/ui/src/index.ts` — exports `JungleBackground`.
- `chat.ts` — imports `JungleBackground` into its standalone component imports array.
- Sidebar (`app-history-panel`) — no changes; already opaque enough that bg behind it doesn't bleed through. Verify visually during execution.

### Performance Note (BG-success-criterion 5)
- Inline SVG with no animation = paint-once, no per-frame cost. Frame-rate parity with v1.0 baseline is structural, not requiring profiling. Planner adds a one-line note in execution; no perf instrumentation phase needed.

</code_context>

<specifics>
## Specific Ideas

- Day silhouette: fern frond band along the bottom — leaflets visible from ~bottom 15–20% of viewport up; opacity ~0.15–0.25 on `studio-accent-dark` so they read as shadow-like foliage, not bright green decoration.
- Night silhouette: palm trunks + fronds at the bottom horizon — slightly taller composition (~bottom 25%) so the silhouette breaks the gradient horizon line; opacity ~0.3–0.4 on a dark `studio-night-*` token so they're visible against the deeper bg.
- Gradient direction: vertical (`to-b`) for both modes — top stays "sky-like", bottom warms/grounds.
- Silhouette SVG `viewBox`: wide and short (e.g. `0 0 1600 300`), `preserveAspectRatio="xMidYMax slice"` so it crops to the bottom and scales across viewports without distortion.

</specifics>

<deferred>
## Deferred Ideas

- **Drifting leaves / dust motion layer** — Phase 16 (stretch). The inline-SVG structure decided here enables it without rework.
- **Animated gradient (e.g. slow day → dusk transition)** — not requested; would add CD/animation cost. Defer until a concrete user-facing reason exists.
- **Parallax on scroll** — chat list scrolls inside `<main>`, the bg sits behind the whole shell; no scroll-tied motion this phase.
- **Per-route bg variants** (e.g. different scene for a settings page) — no other routes exist; revisit if/when routing expands.

</deferred>

---

*Phase: 13-jungle-atmosphere*
*Context gathered: 2026-05-25*
