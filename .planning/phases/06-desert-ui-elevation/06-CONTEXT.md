# Phase 6: Desert UI Elevation - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 elevates the visual atmosphere of the desert-themed chatbot across four areas: a new pixel snake avatar, decorative background cactus silhouettes, a redesigned floating pill input, and a typography upgrade for the header title. No new functional capabilities — pure aesthetic and UX elevation.

**Scope:** Pixel snake avatar, background cacti, floating pill input, Cinzel typography, optional minor color tuning.

**Not in scope:** Chat history sidebar (deferred — see below), mobile/responsive layout overhaul, new chat capabilities, streaming, accessibility audits.

</domain>

<decisions>
## Implementation Decisions

### Snake Avatar
- **D-01:** Replace the current 8×8 pixel art in `message-bubble.html` with a 24×24 grid pixel art snake in **profile/S-curve orientation** — head facing right, S-curve body. The profile silhouette reads as "snake" instantly at small rendered size.
- **D-02:** The snake has a **forked tongue** — a 2-pixel fork extending from the snout tip. This is the single detail that makes it unmistakably a snake vs. a generic reptile at small size.
- **D-03:** Color palette uses **existing cactus-green tokens only** — `#4A7C59` (cactus-green) for the main body, `#6BAF82` (cactus-green-light) for highlight/shading pixels, `#1A1209` (desert-night) for the eye, `#C1644A` (desert-terracotta) for the tongue accent. No new tokens.
- **D-04:** Rendered at 24×24 px (`width="24" height="24"` on the SVG), `viewBox="0 0 24 24"`, `shape-rendering="crispEdges"`.

### Background Cacti
- **D-05:** **4–5 decorative cactus silhouettes** in the `<main>` chat area of `chat.html`. Suggested layout: tall saguaro bottom-left, branched cactus bottom-right, 2–3 smaller silhouettes at other corners/mid-edges (e.g., top-right, mid-left).
- **D-06:** **Fixed position** (not scrolling with content) — use `absolute` or `fixed` positioning with Tailwind. Must sit behind messages (`z-0` / behind `z-10` message content) so they never overlap conversation bubbles.
- **D-07:** **Inline SVG** in `chat.html` (Claude's discretion — better dark mode control via Tailwind classes, no CSS custom property plumbing needed). Each SVG is a simple filled silhouette path.
- **D-08:** Opacity: **~5% in light mode, ~3% in dark mode**. Achieved via Tailwind `opacity-[0.05] dark:opacity-[0.03]` on each SVG element. The desert atmosphere is felt rather than seen.

### Input Pill
- **D-09:** The chat input becomes a **floating pill-style card**. Remove the `border-t` separator entirely. Replace with a drop shadow (`shadow-md` or equivalent) to signal elevation. Background matches the existing surface tokens (`bg-desert-sand-light dark:bg-desert-night-surface`).
- **D-10:** Corner style: **`rounded-2xl`** — large rounded corners, not `rounded-full`. Allows the textarea to expand to multiple lines without the container looking misshapen.
- **D-11:** Width: **~55% of the chat area** on desktop, expanding to ~90% on mobile (`w-[55%] sm:w-[90%]` or similar). This intentionally leaves side space for a future chat history sidebar (see Deferred Ideas).
- **D-12:** **Centered horizontally** — `mx-auto` within the sticky bottom container.
- **D-13:** **Sticky bottom with padding gap** — ~16–20px of visible background below the pill (e.g., `pb-4` or `pb-5` on the wrapper). The pill visually hovers above the screen edge.
- **D-14:** **Messages stay full-width** — the message list keeps current behavior (`max-w-[75%]` bubbles left/right aligned). Only the input pill is narrower/centered.
- **D-15:** **Circular send button** — `rounded-full w-8 h-8` circle on the right inside the pill (replacing the current `rounded-lg w-10 h-10` square). More visually cohesive with the rounded-2xl pill.

### Typography
- **D-16:** **Switch header title font from Playfair Display to Cinzel** — Roman-inscribed capitals with a frontier/carved quality that fits the western desert aesthetic better. Add `<link>` for Cinzel to `index.html` (or `styles.scss` `@import`) — one new Google Font import, no npm dependency.
- **D-17:** Title displayed as **all-caps `CHATBOT`** — add `uppercase` Tailwind class. Cinzel's letterforms are designed for capitals; the monumental feel is strongest in all-caps.
- **D-18:** Update `tailwind.config.js` `fontFamily.title` to `["'Cinzel'", 'Georgia', 'serif']`. Existing `font-title` usages pick up the change automatically.

### Color Tweaks (Claude's Discretion)
- Optional minor palette refinements within the existing sandy/terracotta/amber family. Warmer darks in night mode, crisper contrast in day mode. No full redesign, no new tokens unless a specific tweak requires one. Implementer should use visual judgment — if it looks right, it is right.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Goals & Constraints
- `.planning/ROADMAP.md` — Phase 6 goal and dependency on Phase 5
- `.planning/PROJECT.md` — locked constraints: Tailwind-only, Angular standalone + OnPush, no inline styles

### Files to Modify
- `libs/ui/src/lib/message-bubble/message-bubble.html` — replace 8×8 SVG snake avatar with 24×24 profile snake
- `libs/ui/src/lib/chat-input/chat-input.html` — redesign to floating pill (remove border-t, add shadow, rounded-2xl, centered, circular button)
- `libs/ui/src/lib/chat-input/chat-input.ts` — may need class/style adjustments if pill wrapper structure changes
- `apps/frontend/src/app/chat/chat.html` — add decorative cactus SVGs to the `<main>` area
- `apps/frontend/tailwind.config.js` — update `fontFamily.title` to Cinzel
- `apps/frontend/src/index.html` — add Google Fonts link for Cinzel

### Prior Phase Decisions (respected, not re-decided)
- `.planning/phases/05-further-ui-ux-work/05-CONTEXT.md` — input overflow fix, animation patterns
- `.planning/phases/04-dark-theme-and-visual-polish/04-CONTEXT.md` — desert day/night palette tokens, snake avatar context (D-09), cactus scrollbar
- `.planning/phases/03-ui-ux-refinement/03-CONTEXT.md` — copy button pattern (D-08)

### Conventions
- `apps/frontend/CLAUDE.md` — Angular rules: standalone, OnPush, Tailwind-only, no `any`
- `.planning/codebase/CONVENTIONS.md` — naming, linting, TypeScript strict mode

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Current snake SVG: `message-bubble.html` lines 23–34 — 8×8 viewBox, replace entirely with 24×24 profile snake
- `ChatInput` form: `chat-input.html` — currently `border-t` + `flex items-end gap-2` row. Pill restructure wraps this in a centered sticky container; the textarea and button remain but button becomes `rounded-full w-8 h-8`
- `chat.html` `<main>`: `flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll-area` — add `relative` to allow absolute-positioned cactus SVGs inside it
- Desert palette: `tailwind.config.js` — `cactus-green` (#4A7C59), `cactus-green-light` (#6BAF82) already defined; no new tokens needed for the snake

### Established Patterns
- Tailwind-only — all new styling via Tailwind classes; no inline styles
- `dark:` variants use `.night-mode` class strategy (`darkMode: ['class', '.night-mode']`)
- Inline SVG icons — all icons are inline SVG; snake and cacti follow the same pattern
- Angular OnPush + `ChangeDetectorRef` — no new state fields needed for Phase 6 (purely visual)

### Integration Points
- Cactus SVGs: add `relative` to `<main>` in `chat.html`; position each SVG as `absolute bottom-0 left-0` etc. with `pointer-events-none` and `select-none`
- Input pill: the `<form>` in `chat-input.html` becomes a centered sticky wrapper; the inner card (pill) is a new `<div>` with shadow + rounded-2xl
- Cinzel font: one `<link rel="stylesheet">` in `index.html` for `family=Cinzel:wght@400;600&display=swap`; update `tailwind.config.js` fontFamily.title

</code_context>

<specifics>
## Specific Ideas

- **Snake head detail:** Head pixel block should be visibly larger than the body (2-3px wide), with a distinct eye pixel and the forked tongue extending 2px forward. The S-curve body tapers toward the tail.
- **Cactus silhouette shapes:** Use simple filled `<path>` SVG shapes — a classic saguaro (two arms), a barrel cactus (oval), a prickly pear (two oval pads). All monochrome fills using `currentColor` or a single hardcoded desert-appropriate color, controlled by opacity.
- **Pill shadow:** `shadow-[0_4px_24px_rgba(0,0,0,0.12)]` or Tailwind `shadow-lg` — subtle but enough to lift the pill off the background. Dark mode may need slightly more shadow intensity.
- **Cinzel weight:** 400 for the title (`CHATBOT`) — the regular weight is already strong at large sizes. 600 available if bolder feel is wanted.

</specifics>

<deferred>
## Deferred Ideas

- **Chat history sidebar** — user anticipates adding a left-side conversation history panel in a future phase (likely after mentoring session). The ~55% pill width is intentionally narrow to leave room. Natural Phase 7 or later.

</deferred>

---

*Phase: 6-desert-ui-elevation*
*Context gathered: 2026-05-20*
