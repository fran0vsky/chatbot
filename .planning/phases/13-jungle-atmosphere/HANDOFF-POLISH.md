# SpinoChat Jungle Redesign — Polish Phase Handoff

**Foundation status:** Complete. Visual shell is in place; legacy components have been repaletted but not redesigned.
**Next session goal:** Make every visible piece of UI look like the user's reference mockup.

## What the foundation session already did

1. **Image assets** — six pixel-art PNGs in `apps/frontend/public/spino/`:
   - `bg-day.png` 1920×1080, `bg-night.png` 1920×1080 (full-bleed jungle scenes)
   - `mascot-day.png` 768×1024, `mascot-night.png` 768×1024 (Spinosaurus character art)
   - `spino-avatar.png` 256×256 (transparent head crop)
   - `spino-logo.png` 128×128 (transparent footprint glyph)
   - Optimization script: [scripts/optimize-spino-assets.js](../../../scripts/optimize-spino-assets.js). Re-run after replacing assets.

2. **Palette** — `studio-*` → `jungle-*` rename across both `tailwind.config.js` files and all 17 component files. New jungle palette:
   - Day: forest greens (`#0F2419` → `#2D5A3D`), gold accent (`#D4A574`), cream user bubble (`#E8D9A0`), cream ink (`#F0E6CC`)
   - Night: deep teal/midnight (`#061421` → `#1A4055`), cyan accent (`#7AB8D4`), pale ink (`#D8E4ED`)

3. **Layout** — `apps/frontend/src/app/chat/chat.html` is now a 3-column shell:
   - Background image layer (z-0) with `dark:` swap
   - Left: existing `<app-history-panel>` (unchanged structure)
   - Center: existing chat column (unchanged structure)
   - Right: NEW `<app-mascot-panel>` (320px, hidden below `lg` breakpoint)

4. **MascotPanel placeholder** — [libs/ui/src/lib/mascot-panel/](../../../libs/ui/src/lib/mascot-panel/). Renders day/night mascot art with status header, footer with placeholder waveform bars and emoji footprints. Input: `status: 'idle' | 'thinking'`. Wired to `(isLoading || isStreaming())`.

5. **Obsolete component removed** — `libs/ui/src/lib/jungle-background/` deleted (it was an SVG-silhouette experiment superseded by raster backgrounds).

## What still needs to ship for "full redesign" — work items

Order matters; sidebar first because it sets the visual language for the rest.

### 1. Sidebar redesign — repurpose HistoryPanel
**File:** [libs/ui/src/lib/history-panel/history-panel.html](../../../libs/ui/src/lib/history-panel/history-panel.html) (and `.ts` if needed)

Target look from mockup:
- Convert from collapsible overlay to **permanent left sidebar** (~260px wide, always visible at `md+`, hidden on mobile with hamburger trigger)
- Top: **SPINO** wordmark + small **BETA** chip, using `font-title` and gold accent — include `spino-logo.png` 28×28 to the left
- "**+ New chat**" pill with `⌘K` hint on the right (binds to existing `newChat` output)
- **Nav list** (static placeholder buttons for now — no routing):
  - 💬 Chats (this is where the existing sessions list goes — keep the existing rename/delete/pin functionality, just restyle each row as a thin list item with hover glow)
  - 🌿 Explore (placeholder, disabled or no-op)
  - 📖 Knowledge (placeholder)
  - ⚙️ Settings (placeholder)
- **Promo card** near the bottom: small mascot thumb + "The AI that survived. Ancient brain. Modern AI." in muted text
- **User chip** at the very bottom: avatar circle (initial in colored bg) + name + "Free Plan" subtitle + chevron
- Background: `bg-jungle-bg/85 dark:bg-jungle-night/85 backdrop-blur-md` with a 1px right border in `jungle-border/30`

The existing HistoryPanel has `[open]` + `(closed)` outputs for overlay behavior. Decide: either deprecate the overlay mode entirely (cleanest), or keep both modes behind a `[variant]="'docked' | 'overlay'"` input. Recommend deprecate — the chat.html no longer uses overlay.

### 2. Message bubble restyle
**File:** [libs/ui/src/lib/message-bubble/message-bubble.html](../../../libs/ui/src/lib/message-bubble/message-bubble.html) + `.scss`

- **User bubble (right-aligned):** `bg-jungle-user-bubble dark:bg-jungle-night-user-bubble`, `text-jungle-user-ink dark:text-jungle-night-text`, rounded-2xl with a small tail nub on the bottom-right. Add timestamp + double-check read receipt (`✓✓` styled in `jungle-accent`) bottom-right of bubble.
- **AI bubble (left-aligned):** `bg-jungle-surface/85 dark:bg-jungle-night-surface/85 backdrop-blur-sm`, `text-jungle-ink dark:text-jungle-night-text`, rounded-2xl. Render **`spino-avatar.png`** in a 32×32 circle to the left of the bubble (vertical-align: top). Add timestamp below the bubble, right-aligned.
- **Action row** below AI bubbles (👍 👎 copy share): 4 ghost icon buttons in a row, `text-jungle-ink-muted dark:text-jungle-night-muted`, hover → `text-jungle-accent dark:text-jungle-night-accent`. Wire 👍/👎 to a feedback signal (new `(feedback)` output, can no-op for now), keep copy as existing copy-to-clipboard, share is no-op placeholder. Keep existing edit/regenerate buttons but tuck them into the same row.
- **Date divider** ("Today" / "Yesterday" / formatted date): add a small chip with `bg-jungle-bg/60 dark:bg-jungle-night/60` text-xs in `font-medium`, rendered between message groups. New component or inline render — host can compute group boundaries.

### 3. Input composer restyle
**File:** [libs/ui/src/lib/input-composer/input-composer.html](../../../libs/ui/src/lib/input-composer/input-composer.html) + `.ts`

- Outer pill: `bg-jungle-surface/85 dark:bg-jungle-night-surface/85 backdrop-blur-md` rounded-full with a 1px `jungle-border/40` border and soft glow on focus-within (`focus-within:ring-2 focus-within:ring-jungle-accent/40`)
- Placeholder: "Ask Spino anything…"
- **Three left affordances**: small ghost icon buttons (no-op placeholders for now — paperclip / emoji / mic)
- **Circular send button on the right**: `bg-jungle-accent dark:bg-jungle-night-accent` solid circle, white play-icon (`▷`), `disabled:opacity-50`
- Drop the rectangular send currently there

### 4. Header bar restyle (or remove)
**File:** [libs/ui/src/lib/header-bar/header-bar.html](../../../libs/ui/src/lib/header-bar/header-bar.html)

Mockup has no top header in the center column — chrome is in the sidebar instead. Two options:
- **A (cleaner):** Remove `<app-header-bar />` from chat.html entirely; move theme toggle into MascotPanel header (next to the volume icon); New chat is already in the sidebar; History toggle is moot since sidebar is permanent. Delete `header-bar` component if nothing else uses it.
- **B (safer):** Keep it but visually de-emphasize — just a thin transparent strip with day/night toggle button right-aligned, no border, no shadow.

Recommend **A** to match mockup.

### 5. Mascot panel polish
**File:** [libs/ui/src/lib/mascot-panel/mascot-panel.html](../../../libs/ui/src/lib/mascot-panel/mascot-panel.html)

Current placeholder shows static bars and emoji footprints. Upgrade to:
- **Animated waveform**: replace the static `<span>` bars with a CSS `@keyframes` height-pulse driven by `[status]` input. Day uses gold, night uses cyan. When `idle`, bars stay low and gently breathe (1.5s ease-in-out infinite, varying delays). When `thinking`, faster amplitude.
- **Footprint thinking dots**: replace emoji 🐾 with three inline SVG paw prints, each pulsing with a 200ms-staggered opacity animation when `status === 'thinking'`. Use existing pattern in [libs/ui/src/lib/typing-indicator](../../../libs/ui/src/lib/typing-indicator/).
- **Status text crossfade** between "Listening…" / "Thinking…" with a 200ms opacity transition when status changes.
- Verify the mascot art looks centered — may need to adjust `bg-position` per image; both mockup mascots crop neatly with default `bg-center`.

### 6. Model selector visibility
**File:** [libs/ui/src/lib/model-selector/model-selector.html](../../../libs/ui/src/lib/model-selector/model-selector.html)

The mockup has no model selector. Options:
- Tuck it inside a small kebab menu next to the input bar's mic icon
- Hide it by default with a "Power user" settings toggle
- Leave it visible but restyle as a small chip below input

Recommend tucking into a popover triggered from the input bar's leftmost icon (`⚙` swap).

### 7. Reasoning & tool-call bubbles
**Files:** [libs/ui/src/lib/reasoning-block/](../../../libs/ui/src/lib/reasoning-block/), [libs/ui/src/lib/tool-call-bubble/](../../../libs/ui/src/lib/tool-call-bubble/)

Already repaletted. Just verify they look at home — likely need:
- Reduce visual weight (mockup has zero of these surfaces)
- Use `bg-jungle-surface/40` translucent backgrounds, `border-jungle-border/30`
- Reasoning auto-collapsed by default (already exists)

### 8. Disclaimer footer placement
Currently at the bottom of `<main>` in chat.html. Mockup shows it as a subtle line below the input bar. Probably already correct — verify visually.

### 9. Tests
- Run `npx nx test ui` and `npx nx test frontend` — paletté rename is global, may have broken existing component tests that asserted on `studio-*` class names. Fix as they come up.
- Storybook: add `mascot-panel.stories.ts` with `Idle` and `Thinking` stories (mirror the pattern from existing `mascot.stories.ts`).
- Build verification on Windows fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME` — this is an Nx loader / Node version issue, not our code. User should run build manually or upgrade Node if it persists.

### 10. Day/night toggle
The toggle still uses `'desert-theme'` as the localStorage key in [apps/frontend/src/app/chat/chat.ts:124](../../../apps/frontend/src/app/chat/chat.ts#L124) and around. Rename to `'spino-theme'` for brand consistency. Move the trigger button into the MascotPanel header (next to the volume icon).

## Files modified by the foundation session

```
apps/frontend/tailwind.config.js        — jungle palette tokens
apps/frontend/src/app/chat/chat.html    — 3-column shell + bg images + mascot panel
apps/frontend/src/app/chat/chat.ts      — swap JungleBackground import for MascotPanel
apps/frontend/public/spino/*.png        — six new optimized pixel-art assets

libs/ui/tailwind.config.js              — jungle palette tokens
libs/ui/src/index.ts                    — drop JungleBackground export, add MascotPanel
libs/ui/src/lib/mascot-panel/*.{ts,html} — new component (placeholder)
libs/ui/src/lib/jungle-background/      — DELETED

(17 component files repaletted via studio-* → jungle-* global rename)

scripts/optimize-spino-assets.js        — sharp resize/compress pipeline (~76% size cut)
package.json                            — sharp added as devDependency
```

## Quick visual smoke test the user should do

1. Run dev server (`npx nx serve frontend`)
2. Open `localhost:4200`
3. Expect: jungle day background visible, mascot art in right column, chat in center with old palette converted to greens/golds
4. Click the theme toggle (currently in header-bar): backgrounds and mascot should swap to night
5. Send a test message: mascot panel status footer changes "Listening…" → "Thinking…"

**Known visual gaps you'll see** that the polish phase fixes:
- Sidebar still looks like a session-history overlay, not the SPINO nav
- Bubbles look like the old soft-studio style, not jungle
- Header bar visible above the chat column (mockup has none)
- Input bar is rectangular, not the rounded pill with circular send
- Mascot panel waveform is static and uses emoji footprints
