# Phase 4: Dark Theme and Visual Polish - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 gives the chatbot a cohesive desert aesthetic and replaces the generic white light theme with a desert day/night identity. The two modes — sunny desert day and cool desert night — are toggled by the user and persist across page refreshes. A pixel art snake mascot appears as the assistant avatar, a cactus-styled scrollbar reinforces the theme, and code block syntax highlighting adapts per mode.

**Scope:** Desert day/night color palette applied throughout, day/night toggle button in header, localStorage persistence, desert-themed typography, restyled message bubbles, cactus scrollbar, cactus-green pixel art snake avatar on assistant bubbles, two Prism.js themes (one per mode).

**Not in scope:** New chat capabilities, model changes, persistent history, authentication, mobile-specific layouts, animations beyond hover/transition effects already established in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Desert Palette — Day Mode
- **D-01:** Day mode uses a sandy/warm palette: warm parchment/sand background (~`#F5E6C8` range), terracotta/burnt orange accents, dusty brown text. Feels like sunbaked adobe in bright desert daylight.
- **D-02:** Day mode replaces the existing white/gray light theme entirely — `bg-white`, `text-gray-900`, `border-gray-200` and all hardcoded light Tailwind classes are replaced with desert equivalents.

### Desert Palette — Night Mode
- **D-03:** Night mode uses a deep brown/indigo palette: very dark brown or near-black background with an indigo undertone, warm amber/orange accents, muted sage green highlights. Feels like a starry desert night sky.
- **D-04:** Night mode is toggled by the user — it is NOT tied to `prefers-color-scheme`. The toggle is explicit and user-controlled.

### Day/Night Toggle
- **D-05:** A sun/moon icon button is placed in the header on the right side, grouped with the model selector and new chat button (`flex items-center gap-2` group already established in Phase 3).
- **D-06:** The selected mode persists via `localStorage` — user picks night mode, refreshes the page, stays in night mode. App defaults to day mode on first load (no prior localStorage entry).
- **D-07:** Theme class (e.g., `.day-mode` / `.night-mode` or `data-theme="day"/"night"`) applied to the root `<html>` or `<body>` element so Prism theme scoping and global palette work together.

### Snake Mascot
- **D-08:** A pixel art snake appears as a small avatar to the LEFT of every assistant message bubble — same position where a profile picture would appear in a traditional chat layout.
- **D-09:** Snake is cactus green — ties it visually to the cactus scrollbar and the broader desert palette. Must look good on both parchment (day) and dark-brown (night) backgrounds.
- **D-10:** Snake is pixel art style (CSS `box-shadow` technique or inline SVG with small squares) — consistent with the pixel creature aesthetic the user referenced (e.g., Claude's orange pixel character). No user bubble avatar — snake appears on assistant bubbles only.

### Cactus Scrollbar
- **D-11:** The main chat message area scrollbar is styled to evoke a cactus: green thumb (`#4a7c59` range), thin track, rounded borders creating a segmented cactus-arm appearance. CSS `::-webkit-scrollbar-thumb` + `scrollbar-width: thin` for Firefox.
- **D-12:** Scrollbar color adapts between day and night modes (cactus green on parchment day, slightly lighter sage green on dark night).

### Typography
- **D-13:** A desert-appropriate font is applied to the `"Chatbot"` heading/header — a slab-serif or western-flavored font (e.g., Google Fonts `Playfair Display`, `Merriweather`, or similar). Body text and chat messages keep a readable sans-serif for legibility.

### Bubble Styling
- **D-14:** Message bubbles are restyled to fit the desert palette — rounded corners adjusted if needed, border/shadow tweaks to match the warm/earthy aesthetic. User bubbles use terracotta/warm orange; assistant bubbles use a slightly different sand/parchment shade.

### Code Block Syntax Highlighting
- **D-15:** Two Prism.js themes — one per mode. Day mode: a warm/earthy light theme (e.g., `prism-solarizedlight` or `prism-coy`). Night mode: a dark theme (e.g., `prism-tomorrow` or `prism-okaidia`). Claude picks the specific themes that best complement the two desert palettes.
- **D-16:** Theme swap is implemented by scoping the Prism CSS imports under the `.day-mode` / `.night-mode` root class in `styles.scss`. Toggling the root class swaps both the UI palette and the code theme simultaneously.

### Claude's Discretion
- Exact hex values within each palette family (sand/parchment for day, deep brown/indigo for night) — Claude picks values that give strong but comfortable contrast.
- Specific Prism.js theme files chosen for day and night.
- Specific pixel art snake dimensions and design (keep it small, ~24×24px, charming).
- Exact slab-serif font (must be available via Google Fonts CDN or Tailwind font stack).
- Interval/transition details for any hover effects beyond what Phase 3 established.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Goals & Constraints
- `.planning/ROADMAP.md` — Phase 4 goal; depends on Phase 3
- `.planning/PROJECT.md` — locked constraints: Tailwind-only, Angular standalone + OnPush, no inline styles

### Files to Modify
- `apps/frontend/src/styles.scss` — global palette, Prism theme imports, scrollbar styles, root `.day-mode`/`.night-mode` classes, font import
- `apps/frontend/src/index.html` — Google Fonts link tag (if adding a web font)
- `apps/frontend/src/app/chat/chat.html` — header toggle button, bubble layout (snake avatar slot)
- `apps/frontend/src/app/chat/chat.ts` — day/night toggle logic, localStorage read/write, theme class toggling on root element
- `apps/frontend/src/app/chat/chat.scss` — any chat-level palette overrides (if needed beyond global)
- `apps/frontend/src/app/chat/message-bubble/message-bubble.html` — snake avatar element next to assistant bubbles
- `apps/frontend/src/app/chat/message-bubble/message-bubble.ts` — pixel art snake rendering (inline SVG or CSS)
- `apps/frontend/src/app/chat/message-bubble/message-bubble.scss` — bubble palette classes, snake avatar styles

### Prior Phase Decisions (respected, not re-decided)
- `.planning/phases/03-ui-ux-refinement/03-CONTEXT.md` — D-08 (copy button on assistant bubbles), D-09 (new chat button placed right of model selector, both grouped right), D-11 (send button hover/active), D-13 (header layout)
- `.planning/phases/01-working-chat/01-CONTEXT.md` — D-14 (header reserved for right-side elements)
- `.planning/phases/02-choose-your-model/02-CONTEXT.md` — D-04 (native `<select>` for model), D-05 (selector right-aligned in header)

### Conventions
- `apps/frontend/CLAUDE.md` — Angular rules: standalone, OnPush, Tailwind-only, no `any`, services for HTTP
- `.planning/codebase/CONVENTIONS.md` — naming, linting, TypeScript strict mode

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatComponent.isLoading` — toggle button should be disabled during loading (same pattern as new chat button and model selector)
- Header `flex items-center gap-2` group — toggle button slots in alongside `new chat` + `<select>` without layout changes
- `@ViewChild('messageEnd')` + `scrollIntoView` — already handles scroll; cactus scrollbar styling is purely CSS, no JS interaction needed
- `MessageBubble` `[typing]` input — snake avatar must appear alongside typing indicator bubble too (assistant role)

### Established Patterns
- Angular OnPush + `ChangeDetectorRef.markForCheck()` — theme toggle state change must trigger CD if stored as class property
- Tailwind-only — all new UI (toggle button, snake avatar container, scrollbar) uses Tailwind classes; custom colors need to be added to `tailwind.config.js` as named values or used as arbitrary values (`bg-[#F5E6C8]`)
- Inline SVG pattern — send arrow and error triangle are inline SVGs in templates; snake pixel art follows same pattern
- `localStorage` — no existing usage in the codebase; new pattern, but straightforward browser API

### Integration Points
- Prism.js themes in `styles.scss` — currently `@import 'prismjs/themes/prism.css'` (global, unconditional). Replace with two scoped imports under `.day-mode` and `.night-mode` selectors.
- Root element class toggle — `document.documentElement.classList` or `document.body.classList` in `ChatComponent` or a new `ThemeService`. Theme must be applied before first paint to avoid flash (read localStorage in `ngOnInit` or app init).
- `tailwind.config.js` — may need `darkMode: 'class'` replaced with custom `class` strategy, or custom color palette extensions for desert tokens.

</code_context>

<specifics>
## Specific Ideas

- **Snake inspiration:** User referenced Claude's orange pixel creature as the visual reference point — small, blocky, charming pixel art. Same scale and personality, cactus green instead of orange.
- **Cactus scrollbar:** The scrollbar thumb should look like a cactus segment — green, with border-radius creating the rounded arm look. The scrollbar track should be subtle (transparent or very light desert tan).
- **Two desert identities:** Day = bright, warm, inviting (like an Arizona morning). Night = deep, cool, mysterious (like the desert under stars). These are not just palette swaps — they should feel like two distinct moods of the same place.
- **Font:** A slab-serif or western-flavored web font on the `"Chatbot"` header title only — body and chat messages stay legible sans-serif.

</specifics>

<deferred>
## Deferred Ideas

None — all discussion stayed within phase scope.

</deferred>

---

*Phase: 4-dark-theme-and-visual-polish*
*Context gathered: 2026-05-20*
