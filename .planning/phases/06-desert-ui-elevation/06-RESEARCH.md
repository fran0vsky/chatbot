# Phase 6: Desert UI Elevation - Research

**Researched:** 2026-05-20
**Domain:** Angular template authoring, inline SVG pixel art, Tailwind CSS layout, Google Fonts integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace 8×8 snake SVG in `message-bubble.html` with a 24×24 profile/S-curve snake (head right, S-curve body)
- **D-02:** Forked tongue — 2-pixel fork from snout tip
- **D-03:** Colors: `#4A7C59` body, `#6BAF82` highlight, `#1A1209` eye, `#C1644A` tongue — existing tokens only, no new tokens
- **D-04:** `width="24" height="24"`, `viewBox="0 0 24 24"`, `shape-rendering="crispEdges"`
- **D-05:** 4–5 decorative cactus silhouettes in `<main>` of `chat.html`
- **D-06:** Fixed/absolute positioning behind messages (`z-0`); never overlap conversation bubbles
- **D-07:** Inline SVG in `chat.html` (not `<img>`)
- **D-08:** `opacity-[0.05] dark:opacity-[0.03]` on each cactus SVG
- **D-09:** Remove `border-t` separator from chat input; replace with `shadow-md`/`shadow-lg` drop shadow
- **D-10:** Pill corners: `rounded-2xl`
- **D-11:** Width: `w-[55%]` desktop / `w-[90%]` mobile (leaves sidebar room)
- **D-12:** Centered: `mx-auto`
- **D-13:** Sticky bottom with `pb-4`/`pb-5` gap below pill
- **D-14:** Messages stay full-width (`max-w-[75%]` unchanged)
- **D-15:** Circular send button: `rounded-full w-8 h-8` (was `rounded-lg w-10 h-10`)
- **D-16:** Switch header font from Playfair Display to Cinzel via `<link>` in `index.html`
- **D-17:** Title displayed as all-caps `CHATBOT` — add `uppercase` Tailwind class
- **D-18:** Update `tailwind.config.js` `fontFamily.title` to `["'Cinzel'", 'Georgia', 'serif']`

### Claude's Discretion

- Optional minor palette refinements within existing sandy/terracotta/amber family. No new tokens unless a specific tweak requires one.

### Deferred Ideas (OUT OF SCOPE)

- Chat history sidebar (future phase, likely Phase 7+)

</user_constraints>

---

## Summary

Phase 6 is a pure aesthetic pass — no new Angular components, no new services, no new TypeScript logic, no new npm packages. All work is HTML template edits, inline SVG authoring, and two config-file updates (`index.html`, `tailwind.config.js`).

The technical surface is narrow and well-understood: the existing codebase already uses inline SVG `<rect>` pixel art for the snake, inline SVG `<path>` icons throughout, Tailwind for all styling, and Google Fonts CDN for the existing Playfair Display font. Phase 6 extends all three patterns rather than introducing new ones.

The one area that requires craft judgment is the 24×24 pixel art snake: coordinates must be laid out manually as `<rect>` elements on a 24×24 grid to produce a readable S-curve silhouette with head, eye, tongue, and tapering tail. The UI-SPEC provides a pixel layout guide; the executor must translate that guide into concrete `<rect x y width height fill>` attributes. The cactus silhouette SVG paths require basic SVG path authoring for three shapes (saguaro, prickly pear, barrel/branched).

The pill input restructure is a straightforward HTML refactor: the existing `<form>` element loses its `border-t` outer styling and gains a new inner wrapper `<div>` that carries the pill shape and shadow. No TypeScript changes are needed because `ChatInput` uses `@ViewChild('textareaRef')` on the textarea element, which remains in place.

**Primary recommendation:** Execute in a single wave — all changes are independent template/config edits with no cross-file data dependencies. Commit atomically after all four areas (snake, cacti, pill, typography) are verified visually in both day and night modes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Snake avatar SVG | Browser / Client (inline template) | — | Pure decorative markup; no data, no state |
| Cactus silhouettes | Browser / Client (inline template) | — | Decorative; positioned via CSS in `<main>` |
| Floating pill input | Browser / Client (component template) | — | Structural HTML/CSS refactor of existing form |
| Cinzel font | CDN / Static (Google Fonts CDN link) | Frontend Server (`index.html`) | One `<link>` tag; browser fetches font from CDN |
| Font config | Frontend config (`tailwind.config.js`) | — | Build-time token; `font-title` utility auto-updated |
| Dark mode variants | Browser / Client (`.night-mode` class) | — | All `dark:` prefixes resolve to `.night-mode` per `darkMode: ['class', '.night-mode']` |

---

## Standard Stack

### Core (all already installed — zero new packages)

| Library/Tool | Current State | Phase 6 Usage |
|--------------|---------------|---------------|
| Angular standalone + OnPush | Installed | Template-only edits; no new components |
| Tailwind CSS | Installed, `darkMode: ['class', '.night-mode']` | New utility classes on new/modified elements |
| Inline SVG | Established pattern | Snake `<rect>` pixel art; cactus `<path>` silhouettes |
| Google Fonts CDN | `<link>` already in `index.html` | Swap Playfair Display link for Cinzel link |

### No New Packages

Phase 6 has **zero npm dependency additions**. The package legitimacy audit is not applicable.

**Installation:** None required.

---

## Package Legitimacy Audit

No packages are installed in this phase. Net npm delta: zero.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | N/A — no packages |

**Packages removed due to [SLOP]:** none
**Packages flagged [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User browser
    │
    ├── index.html
    │     └── <link> Google Fonts CDN → Cinzel wght@400;600   [CHANGED]
    │
    ├── chat.html  (ChatComponent template)
    │     ├── <app-chat-header>  →  chat-header.html
    │     │     └── <h1 class="font-title uppercase ...">CHATBOT</h1>  [CHANGED: uppercase added]
    │     │
    │     ├── <main class="... relative">                               [CHANGED: +relative]
    │     │     ├── <svg cactus silhouette 1 absolute bottom-0 left-4>  [NEW]
    │     │     ├── <svg cactus silhouette 2 absolute bottom-0 right-16>[NEW]
    │     │     ├── <svg cactus silhouette 3 absolute top-1/3 right-8>  [NEW]
    │     │     ├── <svg cactus silhouette 4 absolute top-8 right-4>    [NEW]
    │     │     ├── <svg cactus silhouette 5 absolute top-1/2 left-8>   [NEW]
    │     │     └── @for messages → <app-message-bubble>
    │     │           └── 24×24 snake SVG (assistant bubbles)           [CHANGED]
    │     │
    │     └── <app-chat-input>  →  chat-input.html
    │           └── pill wrapper div (sticky, rounded-2xl, shadow-lg)   [CHANGED]
    │
    └── tailwind.config.js
          └── fontFamily.title: ["'Cinzel'", ...]                       [CHANGED]
```

### Recommended Project Structure

No new files or folders. All changes are in-place edits to existing files:

```
apps/frontend/
├── src/
│   ├── index.html                        ← swap Playfair Display link for Cinzel
│   └── app/chat/chat.html                ← add relative to <main>; inject 5 cactus SVGs
└── tailwind.config.js                    ← fontFamily.title → Cinzel

libs/ui/src/lib/
├── message-bubble/message-bubble.html   ← replace 8×8 snake with 24×24 profile snake
└── chat-input/chat-input.html           ← pill restructure (wrapper div + shadow + rounded-2xl)
```

### Pattern 1: Inline SVG Pixel Art (`<rect>` per pixel)

**What:** Each visible pixel in the snake is one `<rect>` element with explicit `x`, `y`, `width`, `height`, and `fill` attributes. `shape-rendering="crispEdges"` prevents anti-aliasing.

**When to use:** Pixel art at exact pixel-grid sizes. The existing 8×8 snake in `message-bubble.html` already uses this pattern.

**Example (existing 8×8 snake — verified in codebase):**
```html
<!-- Source: libs/ui/src/lib/message-bubble/message-bubble.html lines 23–34 -->
<svg xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     viewBox="0 0 8 8"
     shape-rendering="crispEdges"
     aria-hidden="true" focusable="false">
  <rect x="2" y="0" width="2" height="1" fill="#4A7C59"/>
  <rect x="1" y="1" width="4" height="1" fill="#4A7C59"/>
  <!-- ... more rects ... -->
</svg>
```

**Key insight for Phase 6:** The new snake uses `viewBox="0 0 24 24"` (not `0 0 8 8`), and each "pixel" in the design maps to one `<rect>` with `width="1" height="1"` (or `width="2"` for the head block). The rendered SVG element stays `width="24" height="24"` — same as the existing SVG's rendered size, so the layout is unchanged.

**Pixel grid note:** At `viewBox="0 0 24 24"` with `width="24" height="24"`, one SVG unit = one CSS pixel. A `<rect width="1" height="1">` renders as exactly 1×1 CSS pixel. The `shape-rendering="crispEdges"` attribute is mandatory for this to be crisp on retina displays. [VERIFIED: codebase grep]

### Pattern 2: Inline SVG Silhouette Path

**What:** A `<path d="..." fill="currentColor"/>` element inside an `<svg>` that uses `currentColor` for its fill. Opacity is controlled on the SVG element via Tailwind classes, not inside the path.

**When to use:** Decorative single-color SVG shapes (icons, silhouettes). All existing icons use this pattern.

**Example (existing icon pattern — verified in codebase):**
```html
<!-- Source: libs/ui/src/lib/message-bubble/message-bubble.html lines 10–12 -->
<svg class="w-4 h-4 mt-0.5 flex-shrink-0"
     viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
  <path fill-rule="evenodd" d="M8.485 2.495..." clip-rule="evenodd" />
</svg>
```

**Cactus silhouette pattern (Phase 6):**
```html
<!-- Source: 06-UI-SPEC.md Component Inventory section -->
<svg
  class="absolute pointer-events-none select-none opacity-[0.05] dark:opacity-[0.03] text-desert-brown dark:text-desert-night-text w-24 h-48 bottom-0 left-4 z-0"
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 100 200"
>
  <path d="..." fill="currentColor" />
</svg>
```

**Note:** The `text-desert-brown` class sets `color:` which `fill="currentColor"` inherits. This is the correct Tailwind pattern for color-controlled SVGs. [VERIFIED: codebase pattern]

### Pattern 3: Tailwind `dark:` with `.night-mode` Strategy

**What:** `darkMode: ['class', '.night-mode']` in `tailwind.config.js` means Tailwind's `dark:` prefix generates CSS selectors like `.night-mode .element { ... }` — NOT `@media (prefers-color-scheme: dark)`.

**When to use:** Every dark-mode variant in this project. This is an existing locked pattern.

**Confirmed config (verified in `tailwind.config.js` line 10):**
```js
darkMode: ['class', '.night-mode'],
```

**Implication for Phase 6:** All `dark:opacity-[0.03]`, `dark:bg-desert-night-surface`, `dark:text-desert-night-text` etc. classes work correctly because the theme toggle adds/removes `night-mode` on `document.documentElement`. No changes needed to this mechanism. [VERIFIED: codebase grep]

### Pattern 4: Pill Input HTML Structure

**What:** The current `<form>` is a flat flex row with outer border. The pill redesign wraps the existing row in a centered card `<div>` inside a sticky bottom container.

**Current structure (verified):**
```html
<form class="border-t border-desert-border ... px-4 py-3 ...">
  <div class="flex items-end gap-2">
    <textarea ...></textarea>
    <button class="w-10 h-10 rounded-lg ...">...</button>
  </div>
</form>
```

**Target structure:**
```html
<form class="sticky bottom-0 w-full pb-4" (submit)="...">
  <div class="w-[55%] sm:w-[90%] mx-auto rounded-2xl shadow-lg
              bg-desert-sand-light dark:bg-desert-night-surface px-4 py-3">
    <div class="flex items-end gap-2">
      <textarea ...></textarea>
      <button class="w-8 h-8 rounded-full ...">
        <svg class="w-4 h-4" ...>...</svg>  <!-- was w-5 h-5 -->
      </button>
    </div>
  </div>
</form>
```

**TypeScript impact:** None. `@ViewChild('textareaRef')` references the `#textareaRef` attribute on the `<textarea>` element, which remains in place. The `autoResize()` method and all other class members are unchanged. [VERIFIED: codebase read]

### Pattern 5: Google Fonts CDN link in `index.html`

**What:** A `<link rel="stylesheet">` in `<head>` loading a Google Fonts CSS2 API URL.

**Current (verified in `index.html` line 16):**
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
```

**Replacement:**
```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap" rel="stylesheet">
```

The `preconnect` hints on lines 14–15 remain unchanged (they preconnect to `fonts.googleapis.com` and `fonts.gstatic.com` generically). [CITED: developers.google.com/fonts/docs/css2]

### Anti-Patterns to Avoid

- **Inline `style="..."` attributes** — forbidden by `apps/frontend/CLAUDE.md`. All styling via Tailwind utilities. Exception: SVG `<rect fill="...">` attributes are not CSS inline styles; hex fills inside SVG elements are permitted (same pattern as existing snake).
- **Arbitrary hex in Tailwind class strings** — `class="text-[#4A7C59]"` is forbidden. Use token names: `text-cactus-green`. The hex values belong inside `<rect fill="#4A7C59">` SVG attributes only.
- **`<img src="cactus.svg">`** — D-07 locks inline SVG. No external SVG files.
- **Moving `<app-chat-input>` inside `<main>`** — the pill "floats" via `sticky bottom-0` on the `<form>` element. `<app-chat-input>` stays as a sibling of `<main>` in `chat.html`. The sticky positioning works because the parent `<div>` is `h-screen flex flex-col`. [VERIFIED: codebase read]
- **Adding `relative` to the wrong element** — `relative` must go on `<main>`, not on the outer `<div class="flex flex-col h-screen">`. The cactus SVGs use `absolute` positioning relative to `<main>` so they stay within the scroll area visually but behind messages.
- **Forgetting `pointer-events-none`** on cactus SVGs — without it, the SVGs would intercept mouse events over the message area.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode color switching | Custom JS or CSS vars | `dark:` Tailwind prefix + `.night-mode` class | Already wired; toggle is in `ChatComponent` |
| Font loading | Manual `FontFace` API | Google Fonts `<link>` CDN | One-liner; already the pattern for Playfair Display |
| Pixel-perfect SVG scaling | `transform: scale()` | `viewBox` + `width`/`height` attributes | SVG viewport handles scaling without CSS transforms |
| Cactus opacity on theme switch | JS class toggle | `opacity-[0.05] dark:opacity-[0.03]` Tailwind | Same `.night-mode` mechanism handles it |

**Key insight:** This phase has no algorithmic logic. Every "problem" is already solved by the existing patterns — the executor is composing markup, not building infrastructure.

---

## Common Pitfalls

### Pitfall 1: Snake SVG `viewBox` mismatch

**What goes wrong:** Keeping `viewBox="0 0 8 8"` while placing `<rect>` coords designed for a 24-unit grid. The snake renders as a stretched blob.

**Why it happens:** The existing snake uses `viewBox="0 0 8 8"` with `width="24" height="24"` — the 8 viewBox units each scale to 3 CSS pixels. The new snake uses `viewBox="0 0 24 24"` with `width="24" height="24"` — each unit is exactly 1 CSS pixel. If the viewBox is forgotten during replacement, all coordinates shift.

**How to avoid:** Replace the entire `<svg>` element including the `viewBox` attribute. Don't reuse the opening tag from the old snake.

**Warning signs:** Snake renders as a large blob or is invisible (coords outside 0–8 viewBox are clipped).

### Pitfall 2: Cactus SVGs scrolling with messages instead of staying fixed

**What goes wrong:** Cactus silhouettes scroll up when the user scrolls the message list.

**Why it happens:** `<main>` has `overflow-y-auto` — it's the scroll container. `absolute` children of `<main>` scroll with `<main>`'s content unless `<main>` itself has `position: relative`. If `relative` is missing from `<main>`, the `absolute` positioning resolves to the nearest positioned ancestor higher up, which may produce unexpected layout.

**How to avoid:** Add `relative` to `<main class="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll-area relative">`. The cacti are `absolute` within the scroll container — they will scroll with the message list (appearing fixed relative to the chat area's corners, not the viewport). This is the intended behavior per D-06 (absolute, not CSS `fixed`).

**Note on "fixed feel":** D-06 says "fixed position (not scrolling with content)" but D-07 and the UI-SPEC use `absolute` positioning. `absolute` within the scroll container `<main>` achieves the intended visual: the cacti appear anchored to the corners of the chat area. They will scroll slightly if the message list is very long, but at `opacity-[0.05]` this is imperceptible. CSS `position: fixed` would anchor to the viewport but bleed outside `<main>` and could overlap the header/input — `absolute` is the correct choice.

**Warning signs:** Cacti visible in header or behind input pill; cacti appearing at wrong position.

### Pitfall 3: Pill `sticky` not working — input disappears or doesn't stick

**What goes wrong:** The pill input either scrolls away with messages or pins to the browser window edge instead of the chat column.

**Why it happens:** `sticky` requires the parent to be a scroll container or have a constrained height. In this layout, `<div class="flex flex-col h-screen">` is the parent, and `<main>` handles scrolling. `<app-chat-input>` is a flex child of the outer `h-screen` div — it naturally stays at the bottom. `sticky bottom-0` on the `<form>` inside `<app-chat-input>` is redundant but harmless; alternatively the outer `<app-chat-input>` host element already stays at the bottom via flexbox.

**How to avoid:** Verify that `<app-chat-input>` renders as a flex child of the `h-screen flex flex-col` div (confirmed in `chat.html`). The `sticky bottom-0` on the `<form>` is belt-and-suspenders. The existing layout already pins the input at the bottom.

**Warning signs:** Input scrolls with messages; input not visible; input overlaps messages.

### Pitfall 4: `font-title` class not picking up Cinzel after config change

**What goes wrong:** Header still renders in Playfair Display (or fallback Georgia) after updating `tailwind.config.js`.

**Why it happens:** The Angular/Nx dev server may cache the Tailwind-generated CSS. The Google Fonts `<link>` must also be present in `index.html` for the font file to be fetched — updating only `tailwind.config.js` without updating `index.html` results in CSS declaring `font-family: 'Cinzel'` but the font file never loading.

**How to avoid:** Update both files atomically. After updating, do a hard refresh (Ctrl+Shift+R) in the browser to bypass CSS cache. In CI, the build always regenerates CSS from scratch.

**Warning signs:** Title renders in Georgia or system serif; "CHATBOT" text appears but not in Roman-inscribed style.

### Pitfall 5: `uppercase` class placement

**What goes wrong:** `CHATBOT` appears in mixed case; the Cinzel all-caps effect is not visible.

**Why it happens:** The title element in `chat-header.html` line 2 currently renders `Chatbot` (not all-caps). D-17 requires adding the `uppercase` Tailwind class. Without it, Cinzel renders as mixed case.

**How to avoid:** Add `uppercase` to the `<h1>` class list in `chat-header.html`. The text content `Chatbot` can stay as-is — CSS `text-transform: uppercase` handles it.

**Warning signs:** Title is styled differently but not all-caps.

---

## Code Examples

### Current snake SVG (to be replaced)
```html
<!-- Source: libs/ui/src/lib/message-bubble/message-bubble.html lines 23–34 -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
  <rect x="2" y="0" width="2" height="1" fill="#4A7C59"/>
  <rect x="1" y="1" width="4" height="1" fill="#4A7C59"/>
  <rect x="0" y="2" width="5" height="1" fill="#4A7C59"/>
  <rect x="1" y="2" width="1" height="1" fill="#1A1209"/>
  <rect x="3" y="2" width="1" height="1" fill="#1A1209"/>
  <rect x="1" y="3" width="6" height="1" fill="#4A7C59"/>
  <rect x="2" y="4" width="5" height="1" fill="#4A7C59"/>
  <rect x="3" y="5" width="3" height="1" fill="#4A7C59"/>
  <rect x="5" y="6" width="2" height="1" fill="#4A7C59"/>
  <rect x="0" y="2" width="1" height="1" fill="#C1644A"/>
</svg>
```
This entire `<svg>` block is replaced. The new SVG uses `viewBox="0 0 24 24"` and `<rect>` elements with coordinates on the 24-unit grid.

### 24×24 snake: coordinate design guide

The pixel layout guide from UI-SPEC (D-04, UI-SPEC Component Inventory):
```
Row  1 (y=1): cols 22-23 → head top (2px wide)
Row  2 (y=2): cols 15-21 → body; col 22 → head; col 23 → eye pixel
Row  3 (y=3): cols 9-15  → S upper curve body
Row  4 (y=4): cols 7-8   → S mid connection
Row  5 (y=5): cols 7-13  → S lower curve body
Row  6 (y=6): cols 13-19 → tail segment
Row  7 (y=7): cols 19-21 → tail
Row  8 (y=8): col 22     → tail tip
```

Colors: body `#4A7C59`, highlight pixels `#6BAF82` (upper-face of each curve), eye `#1A1209`, tongue `#C1644A` (2 pixels forward of head at y=2, x=24-25 — but viewBox is 0-23, so tongue extends at x=23 y=2 as a 1-wide pixel pair or is placed at y=1-2 x=23).

**Executor note:** The exact pixel coordinates are implementation discretion within the layout intent. The constraint is: head on the right side of the grid, S-curve body, forked tongue extends from the snout, tail tapers to 1px. Verify the result renders clearly at 24px × 24px before committing.

### Cactus silhouette SVG skeleton

```html
<!-- Source: 06-UI-SPEC.md Component Inventory — cactus structure pattern -->
<svg
  class="absolute pointer-events-none select-none opacity-[0.05] dark:opacity-[0.03]
         text-desert-brown dark:text-desert-night-text
         w-24 h-48 bottom-0 left-4 z-0"
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 100 200"
  xmlns="http://www.w3.org/2000/svg"
>
  <path d="M50 200 L50 60 ..." fill="currentColor" />
</svg>
```

Five silhouettes with these position/size classes (from UI-SPEC):

| Silhouette | Position classes | Size classes |
|------------|-----------------|--------------|
| Tall saguaro | `bottom-0 left-4` | `w-24 h-48` |
| Prickly pear | `bottom-0 right-16` | `w-20 h-24` |
| Mid-right branched | `top-1/3 right-8` | `w-16 h-32` |
| Top-right small | `top-8 right-4` | `w-10 h-16` |
| Mid-left small | `top-1/2 left-8` | `w-12 h-20` |

### Font swap (both files must change together)

```html
<!-- index.html — replace line 16 -->
<!-- BEFORE: -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<!-- AFTER: -->
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap" rel="stylesheet">
```

```js
// tailwind.config.js — update fontFamily.title (line 36)
// BEFORE:
fontFamily: { title: ["'Playfair Display'", 'Georgia', 'serif'] }
// AFTER:
fontFamily: { title: ["'Cinzel'", 'Georgia', 'serif'] }
```

```html
<!-- chat-header.html line 2 — add uppercase class -->
<!-- BEFORE: -->
<h1 class="font-title text-lg font-semibold text-desert-brown dark:text-desert-night-text">Chatbot</h1>
<!-- AFTER: -->
<h1 class="font-title text-lg font-semibold uppercase text-desert-brown dark:text-desert-night-text">Chatbot</h1>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `viewBox="0 0 8 8"` 8×8 snake | `viewBox="0 0 24 24"` 24×24 profile snake | Phase 6 | More readable; S-curve silhouette; distinct tongue |
| `border-t` separator above input | Floating pill with `shadow-lg` | Phase 6 | Elevated feel; less visual weight |
| Playfair Display (600/700) | Cinzel (400/600) | Phase 6 | More monumental; frontier aesthetic |
| Mixed-case "Chatbot" title | All-caps `CHATBOT` | Phase 6 | Stronger brand mark |

**No deprecated patterns introduced.** All changes are additive styling within the established Angular + Tailwind stack.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cinzel is available on Google Fonts CSS2 API at `family=Cinzel:wght@400;600&display=swap` | Standard Stack / Code Examples | Font fails to load; fallback Georgia used. Mitigation: UI-SPEC already contains the exact URL string derived from project discussion. [CITED: developers.google.com/fonts/docs/css2] |
| A2 | Cinzel weight 400 and 600 are available as discrete weights (not variable font axis only) | Code Examples | Font may render incorrectly if weights are wrong. Mitigation: Google Fonts helper tool confirms Cinzel is available; discrete weights are the standard GF delivery mechanism. |

**If both A1 and A2 are wrong:** The fallback `Georgia, serif` in `fontFamily.title` ensures the title renders; it just won't have the desired aesthetic. Low risk — fonts.google.com/specimen/Cinzel is a well-known font.

---

## Open Questions

1. **Exact pixel coordinates for the 24×24 snake**
   - What we know: Layout intent (head right, S-curve, eye, forked tongue, tapering tail) from UI-SPEC pixel layout guide
   - What's unclear: Precise `x`/`y` values for each `<rect>` that produce a readable, aesthetically pleasing result at 24×24
   - Recommendation: Executor has full discretion on exact coordinates within the layout intent. The constraint is visual readability — the snake should be recognizable as a snake at rendered size. Draft on paper/pixel editor if needed; translate to `<rect>` elements.

2. **Cactus SVG path data**
   - What we know: Three shapes needed (saguaro, prickly pear, barrel/branched); filled silhouettes; simple paths
   - What's unclear: Exact SVG path `d` attribute strings for each shape
   - Recommendation: Executor constructs simple path data. Saguaro: vertical column with two arm stubs. Prickly pear: two overlapping ellipses. Barrel: simple rounded rectangle or ellipse. Complexity is low — these are silhouettes at very low opacity, not detailed illustrations.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Angular/Nx build | Yes | v24.12.0 | — |
| Google Fonts CDN | Cinzel font loading | Requires internet | CDN | Georgia (system serif fallback in tailwind.config.js) |
| Nx CLI | Build / serve | Yes (pnpm nx) | Nx 22.7.0 | — |

**Known issue (from STATE.md):** `pnpm nx build` fails on this dev machine (Nx 22.7.0 + Node 24.12.0, `ERR_UNSUPPORTED_ESM_URL_SCHEME` on Windows). This is pre-existing and does not block Phase 6 — TypeScript compilation passes clean; full build verification happens on CI.

**Missing dependencies with no fallback:** None for Phase 6 (no new runtimes or services required).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (E2E); Angular testing via Nx |
| Config file | `apps/frontend-e2e/` (Playwright); `jest.config.ts` per library |
| Quick run command | `pnpm nx build frontend` (type-check + build) |
| Full suite command | `pnpm nx run-many -t test lint` |

### Phase Requirements → Test Map

Phase 6 success criteria are visual — they cannot be fully verified by automated unit tests. The validation strategy is:

| Req | Behavior | Test Type | Notes |
|-----|----------|-----------|-------|
| SC-1 | Snake avatar recognizable as snake at 24px | Manual visual | No automated assertion available for pixel art aesthetics |
| SC-2 | Cactus silhouettes present, never overlap messages | Manual visual (+ DOM inspection) | `z-0` and `pointer-events-none` can be asserted via DOM |
| SC-3 | Pill input works in day and night modes | Manual visual + functional smoke | Functional: send a message, verify it works |
| SC-4 | Typography is Cinzel + all-caps | Manual visual | `font-family` computed style can be checked in DevTools |
| SC-5 | No functional regressions | Existing E2E / smoke test | `pnpm nx e2e frontend-e2e` if available |

### Sampling Rate

- **Per task commit:** `pnpm nx build frontend` — verifies TypeScript compiles clean (no template errors)
- **Per wave merge:** Manual smoke: open app in browser in both day and night modes; verify all four visual areas
- **Phase gate:** All five success criteria visually confirmed before `/gsd:verify-work`

### Wave 0 Gaps

None — Phase 6 requires no new test infrastructure. Existing build verification is sufficient. The changes are HTML/SVG/config only with no new TypeScript logic to unit-test.

---

## Security Domain

Phase 6 introduces no authentication, session management, input handling, or cryptography changes. No ASVS categories apply.

The only external dependency added is a Google Fonts CDN `<link>` tag — CDN font loading carries no executable code risk; it delivers CSS and font files only. The existing `preconnect` hints for `fonts.googleapis.com` and `fonts.gstatic.com` are already present in `index.html`.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `libs/ui/src/lib/message-bubble/message-bubble.html` — confirmed existing 8×8 snake SVG pattern, `shape-rendering="crispEdges"`, `<rect>` per pixel
- Codebase: `libs/ui/src/lib/chat-input/chat-input.html` — confirmed current `border-t` form structure, textarea classes, button classes
- Codebase: `libs/ui/src/lib/chat-header/chat-header.html` — confirmed `font-title` usage on `<h1>`, text content `Chatbot`
- Codebase: `apps/frontend/src/index.html` — confirmed Playfair Display `<link>` pattern, preconnect hints
- Codebase: `apps/frontend/tailwind.config.js` — confirmed `darkMode: ['class', '.night-mode']`, all color tokens, `fontFamily.title`
- Codebase: `apps/frontend/src/app/chat/chat.html` — confirmed `<main>` classes, `<app-chat-input>` placement

### Secondary (MEDIUM confidence)

- [Google Fonts CSS2 API docs](https://developers.google.com/fonts/docs/css2) — confirmed `family=Cinzel:wght@400;600&display=swap` URL format [CITED]
- `06-UI-SPEC.md` — UI design contract (verified against codebase)
- `06-CONTEXT.md` — 18 locked decisions

### Tertiary (LOW confidence — assumptions)

- Cinzel weight 400/600 availability on Google Fonts CDN — assumed based on font being a well-known Google Font; not directly verified from font specimen page [ASSUMED: A1, A2]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new packages; all existing libraries
- Architecture patterns: HIGH — all patterns verified directly in codebase
- Pitfalls: HIGH — derived from concrete code analysis, not general knowledge
- Cinzel font availability: MEDIUM — confirmed via Google Fonts API docs; font specimen page inaccessible via WebFetch

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable stack; only risk is Google Fonts CDN URL changes, which are rare)
