# Plan 04-03 Summary: Bubble Restyling + Snake Mascot

**Phase:** 04-dark-theme-and-visual-polish
**Status:** Complete
**Date:** 2026-05-20

## What was done

Restyled message bubbles to desert palette and added pixel art snake avatar to all assistant/typing bubbles.

### message-bubble.ts
- Added `DomSanitizer, SafeHtml` import from `@angular/platform-browser`
- Added `private readonly sanitizer = inject(DomSanitizer)`
- Added `readonly snakeSvg: SafeHtml` — 8×8 pixel art SVG (24×24px rendered) with `shape-rendering="crispEdges"`, cactus-green body (#4A7C59), terracotta tongue (#C1644A), dark eyes (#1A1209)

### message-bubble.html
- User bubble: `bg-blue-500` → `bg-desert-terracotta`
- Typing indicator: wrapped in `flex items-end gap-2` container with snake avatar (`[innerHTML]="snakeSvg"`); bubble color `bg-desert-parchment text-desert-brown`; dots use CSS classes `dot-delay-0/150/300` (no `[style.animation-delay]` bindings)
- Assistant bubble: same snake avatar wrapper; `bg-gray-100 text-gray-800` → `bg-desert-parchment text-desert-brown`
- Copy button hover: `hover:bg-gray-200 text-gray-500` → `hover:bg-desert-border text-desert-brown-muted`

### message-bubble.scss
- Dot-delay utility classes added: `.dot-delay-0/150/300` with `animation-delay`
- Markdown element colors updated: blockquote → `border-desert-border text-desert-brown-muted`, inline code → `bg-desert-border text-desert-brown`, pre → `bg-[#2d2d2d] text-[#ccc]`, table borders → `border-desert-border`, hr → `border-desert-border`, links → `text-desert-terracotta`
