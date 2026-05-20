# Phase 6: Desert UI Elevation - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 6 modified files (no new files)
**Analogs found:** 6 / 6

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `libs/ui/src/lib/message-bubble/message-bubble.html` | component | transform (SVG pixel art replacement) | self — lines 23–34 (existing 8×8 snake) | exact |
| `libs/ui/src/lib/chat-input/chat-input.html` | component | request-response (form submit) | self — current flat form structure | exact |
| `libs/ui/src/lib/chat-input/chat-input.ts` | component | request-response | self — `@ViewChild('textareaRef')` already in place | exact (no change needed) |
| `apps/frontend/src/app/chat/chat.html` | component | transform (layout decoration) | self — `<main>` element lines 12–20 | exact |
| `apps/frontend/tailwind.config.js` | config | — | self — `fontFamily.title` line 36 | exact |
| `apps/frontend/src/index.html` | config | — | self — Google Fonts `<link>` line 16 | exact |

---

## Pattern Assignments

### `libs/ui/src/lib/message-bubble/message-bubble.html` (component, SVG pixel art)

**Analog:** Self — lines 23–34 (the 8×8 snake being replaced)

**Existing snake SVG to replace** (lines 23–34):
```html
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

**Target SVG pattern** — same wrapper div context (lines 22–35), replace only the `<svg>` element:
```html
<!-- Container context (unchanged): -->
<div class="flex-shrink-0 self-end mb-1">
  <!-- REPLACE everything below with the new 24×24 SVG -->
  <svg xmlns="http://www.w3.org/2000/svg"
       width="24" height="24"
       viewBox="0 0 24 24"
       shape-rendering="crispEdges"
       aria-hidden="true" focusable="false">
    <!-- <rect> elements on 24-unit grid: 1 SVG unit = 1 CSS pixel -->
    <!-- Body color: fill="#4A7C59" (cactus-green) -->
    <!-- Highlight pixels: fill="#6BAF82" (cactus-green-light) -->
    <!-- Eye pixel: fill="#1A1209" (desert-night) -->
    <!-- Tongue fork (2 pixels): fill="#C1644A" (desert-terracotta) -->
  </svg>
</div>
```

**Key rules:**
- `viewBox` MUST be `0 0 24 24` — do NOT reuse the old `0 0 8 8`
- `width="24" height="24"` on the `<svg>` element (unchanged from current rendered size)
- `shape-rendering="crispEdges"` is mandatory — prevents anti-aliasing at pixel boundaries
- Each pixel = one `<rect width="1" height="1" x="..." y="...">` (or `width="2"` for the 2-wide head block)
- Hex fill values inside `<rect fill="...">` SVG attributes are permitted — they are NOT inline CSS styles
- Forbidden: `class="text-[#4A7C59]"` arbitrary hex in Tailwind class strings

---

### `libs/ui/src/lib/chat-input/chat-input.html` (component, request-response)

**Analog:** Self — current form structure (lines 1–30)

**Current structure** (lines 1–30 — full file):
```html
<form
  class="border-t border-desert-border dark:border-desert-night-border px-4 py-3 bg-desert-header dark:bg-desert-night-surface"
  (submit)="$event.preventDefault(); submit()"
>
  <div class="flex items-end gap-2">
    <textarea
      #textareaRef
      rows="1"
      ...
      class="flex-1 resize-none rounded-lg border border-desert-border ..."
    ></textarea>
    <button
      type="submit"
      class="flex items-center justify-center w-10 h-10 rounded-lg bg-desert-terracotta ..."
    >
      <svg class="w-5 h-5" ...>...</svg>
    </button>
  </div>
</form>
```

**Target pill structure** — the `<form>` becomes a sticky wrapper; a new inner `<div>` carries the pill shape:
```html
<form
  class="sticky bottom-0 w-full pb-4 bg-transparent"
  (submit)="$event.preventDefault(); submit()"
>
  <!-- Pill card — centered, elevated, rounded -->
  <div class="w-[55%] sm:w-[90%] mx-auto rounded-2xl shadow-lg
              bg-desert-sand-light dark:bg-desert-night-surface
              border border-desert-border dark:border-desert-night-border
              px-4 py-3">
    <div class="flex items-end gap-2">
      <textarea
        #textareaRef
        rows="1"
        [placeholder]="placeholder"
        class="flex-1 resize-none rounded-lg border border-desert-border dark:border-desert-night-border bg-desert-sand-light dark:bg-desert-night-surface text-desert-brown dark:text-desert-night-text px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-desert-terracotta dark:focus:ring-desert-night-amber disabled:opacity-60 disabled:cursor-not-allowed"
        [class.overflow-y-auto]="atMaxHeight"
        [class.overflow-hidden]="!atMaxHeight"
        [(ngModel)]="draft"
        name="draft"
        [disabled]="disabled"
        (keydown)="onKeydown($event)"
        (input)="autoResize(textareaRef)"
      ></textarea>
      <!-- Circular send button — was w-10 h-10 rounded-lg, now w-8 h-8 rounded-full -->
      <button
        type="submit"
        [disabled]="disabled || draft.trim().length === 0"
        class="flex items-center justify-center w-8 h-8 rounded-full bg-desert-terracotta dark:bg-desert-night-amber text-white hover:bg-desert-terracotta-dark dark:hover:bg-desert-night-amber-dark active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3.105 3.105a.75.75 0 01.815-.163l13.5 5.625a.75.75 0 010 1.376l-13.5 5.625a.75.75 0 01-1.04-.819l1.43-5.722L9.5 10 4.31 9.073l-1.43-5.722a.75.75 0 01.225-.246z" />
        </svg>
        <span class="sr-only">Send</span>
      </button>
    </div>
  </div>
</form>
```

**Key changes from current:**
- `border-t border-desert-border dark:border-desert-night-border px-4 py-3 bg-desert-header dark:bg-desert-night-surface` removed from `<form>`
- `<form>` gets `sticky bottom-0 w-full pb-4 bg-transparent`
- New inner `<div>` carries `w-[55%] sm:w-[90%] mx-auto rounded-2xl shadow-lg` + background tokens
- Button: `w-10 h-10 rounded-lg` → `w-8 h-8 rounded-full`; icon: `w-5 h-5` → `w-4 h-4`
- `#textareaRef` attribute MUST remain on the `<textarea>` — `@ViewChild('textareaRef')` in `chat-input.ts` line 27 depends on it

---

### `libs/ui/src/lib/chat-input/chat-input.ts` (component — no changes required)

**Analog:** Self (verified — no TypeScript changes needed)

**Confirmed anchor** (line 27):
```typescript
@ViewChild('textareaRef') private textareaRef?: ElementRef<HTMLTextAreaElement>;
```

The `#textareaRef` template ref variable must remain on the `<textarea>` element in `chat-input.html`. All other class members (`draft`, `atMaxHeight`, `autoResize`, `submit`, `onKeydown`) are unchanged.

---

### `apps/frontend/src/app/chat/chat.html` (component, layout decoration)

**Analog:** Self — current `<main>` element (line 12)

**Current `<main>` line 12:**
```html
<main class="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll-area">
```

**Target `<main>` — add `relative`:**
```html
<main class="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll-area relative">
```

**Cactus SVG pattern** — insert 5 SVGs as the first children inside `<main>`, before the `@for` loop. Each follows this structure:
```html
<svg
  class="absolute pointer-events-none select-none opacity-[0.05] dark:opacity-[0.03]
         text-desert-brown dark:text-desert-night-text z-0
         [position-and-size-classes]"
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 [w] [h]"
  xmlns="http://www.w3.org/2000/svg"
>
  <path d="..." fill="currentColor" />
</svg>
```

**Five silhouette positions and sizes** (from RESEARCH.md):

| # | Shape | Position classes | Size classes |
|---|---|---|---|
| 1 | Tall saguaro | `bottom-0 left-4` | `w-24 h-48` |
| 2 | Prickly pear | `bottom-0 right-16` | `w-20 h-24` |
| 3 | Mid-right branched | `top-1/3 right-8` | `w-16 h-32` |
| 4 | Top-right small | `top-8 right-4` | `w-10 h-16` |
| 5 | Mid-left small | `top-1/2 left-8` | `w-12 h-20` |

**Key rules:**
- `pointer-events-none` is mandatory — without it SVGs intercept mouse events over the message area
- `z-0` keeps cacti behind message bubbles (messages use default stacking, which is above `z-0`)
- `fill="currentColor"` on `<path>` inherits from `text-desert-brown` / `dark:text-desert-night-text` Tailwind classes on the `<svg>` element
- `opacity-[0.05] dark:opacity-[0.03]` — atmosphere is felt, not seen; dark mode uses `.night-mode` class via `darkMode: ['class', '.night-mode']`
- `absolute` positioning resolves relative to `<main>` (once `relative` is added) — cacti scroll with the message list, NOT viewport-fixed
- Do NOT use `position: fixed` — would bleed outside `<main>` and overlap header/input

**Existing message list content (unchanged)** — cacti are inserted before it:
```html
@for (m of messages; track $index) {
  <app-message-bubble [message]="m" [animate]="$index >= 1" />
}
@if (isLoading) {
  <app-message-bubble [message]="{ text: '', role: 'assistant' }" [typing]="true" [animate]="true" />
}
<div #messageEnd></div>
```

---

### `apps/frontend/tailwind.config.js` (config — single line change)

**Analog:** Self — `fontFamily` block (lines 35–37)

**Current** (line 36):
```js
fontFamily: {
  title: ["'Playfair Display'", 'Georgia', 'serif'],
},
```

**Target:**
```js
fontFamily: {
  title: ["'Cinzel'", 'Georgia', 'serif'],
},
```

**Context:** `darkMode` strategy (line 10) is unchanged and governs all `dark:` variants used in Phase 6:
```js
darkMode: ['class', '.night-mode'],
```

All existing `font-title` usages in `chat-header.html` pick up the Cinzel change automatically at next build. Must update both this file and `index.html` atomically.

---

### `apps/frontend/src/index.html` (config — single line change)

**Analog:** Self — `<link>` on line 16

**Current** (line 16):
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
```

**Target:**
```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap" rel="stylesheet">
```

**Surrounding context (unchanged)** — preconnect hints on lines 14–15 remain:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Replace line 16 only -->
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap" rel="stylesheet">
```

---

### `libs/ui/src/lib/chat-header/chat-header.html` (component — 1 class addition)

**Analog:** Self — `<h1>` on line 2

**Current** (line 2):
```html
<h1 class="font-title text-lg font-semibold text-desert-brown dark:text-desert-night-text">Chatbot</h1>
```

**Target — add `uppercase`:**
```html
<h1 class="font-title text-lg font-semibold uppercase text-desert-brown dark:text-desert-night-text">Chatbot</h1>
```

Text content `Chatbot` stays as-is — CSS `text-transform: uppercase` via Tailwind `uppercase` class handles the rendering.

---

## Shared Patterns

### Dark mode — `.night-mode` class strategy
**Source:** `apps/frontend/tailwind.config.js` line 10
**Apply to:** All new Tailwind classes that need dark mode variants
```js
darkMode: ['class', '.night-mode'],
```
Every `dark:` prefix generates `.night-mode .element { ... }` selectors. The theme toggle in `ChatComponent` adds/removes `night-mode` on `document.documentElement`. No changes needed to this mechanism.

### Inline SVG color via `currentColor`
**Source:** `libs/ui/src/lib/message-bubble/message-bubble.html` lines 10–12 (error icon)
```html
<svg class="w-4 h-4 mt-0.5 flex-shrink-0"
     viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
  <path fill-rule="evenodd" d="..." clip-rule="evenodd" />
</svg>
```
For cactus silhouettes: set `fill="currentColor"` on the `<path>`, control color via `text-desert-brown dark:text-desert-night-text` Tailwind classes on the `<svg>` element. This is the established pattern for all decorative SVGs.

### Accessibility attributes for decorative SVGs
**Source:** `libs/ui/src/lib/message-bubble/message-bubble.html` line 23
```html
aria-hidden="true" focusable="false"
```
Both attributes are required on all decorative SVGs (snake, cacti, icons). `focusable="false"` is for IE/Edge compatibility — keep it even though the project targets modern browsers.

### Angular template control flow syntax
**Source:** `apps/frontend/src/app/chat/chat.html` lines 13–19
```html
@for (m of messages; track $index) { ... }
@if (isLoading) { ... }
```
Use Angular 17+ block syntax (`@for`, `@if`) — not `*ngFor`/`*ngIf` directives. All templates in this codebase use the new syntax.

---

## No Analog Found

All 6 modified files have exact analogs (themselves). No files in Phase 6 require a pattern from RESEARCH.md that has no codebase precedent. The cactus SVG `<path>` data (the actual `d` attribute strings) has no codebase precedent — the executor must author the path coordinates from scratch following the silhouette skeleton pattern documented in RESEARCH.md Pattern 2.

| Element | Role | Reason |
|---|---|---|
| Cactus `<path d="...">` coordinate strings | SVG authoring | No existing cactus silhouette paths in the codebase; executor authors from scratch using RESEARCH.md saguaro/prickly-pear/barrel shape descriptions |
| 24×24 snake `<rect>` coordinate grid | SVG pixel art | The 8×8 layout cannot be scaled up — executor authors new coordinates within the layout intent from RESEARCH.md pixel layout guide |

---

## Metadata

**Analog search scope:** `libs/ui/src/lib/`, `apps/frontend/src/`
**Files read:** 7 (`message-bubble.html`, `chat-input.html`, `chat-input.ts`, `chat.html`, `chat-header.html`, `tailwind.config.js`, `index.html`)
**Pattern extraction date:** 2026-05-20
