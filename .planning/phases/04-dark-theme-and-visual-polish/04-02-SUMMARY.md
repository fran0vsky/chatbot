# Plan 04-02 Summary: Theme Toggle

**Phase:** 04-dark-theme-and-visual-polish
**Status:** Complete
**Date:** 2026-05-20

## What was done

Added day/night theme toggle to `ChatComponent` and replaced all white/gray shell classes with desert palette tokens.

### chat.ts
- Added `isDayMode = true` property
- Added `private applyTheme(mode: 'day' | 'night'): void` — toggles `.day-mode`/`.night-mode` on `<html>`, calls `cdr.markForCheck()`
- Added `toggleTheme(): void` — persists to `localStorage('desert-theme')`, calls `applyTheme`
- `ngOnInit` syncs `isDayMode` from localStorage (boolean only — no classList mutation; FOUC script handles first paint)

### chat.html
- Inserted moon/sun toggle button in header right group (first child, before new-chat button)
- `@if (isDayMode)` / `@else` blocks show moon/sun SVG icons with `sr-only` label
- Toggle button disabled while `isLoading`
- Shell class replacements: `bg-white` → `bg-desert-sand`/`bg-desert-header`, `border-gray-200` → `border-desert-border`, `text-gray-900` → `text-desert-brown`, `bg-blue-500` (send button) → `bg-desert-terracotta`, textarea focus ring → `focus:ring-desert-terracotta`
- `chat-scroll-area` class added to `<main>` to activate cactus scrollbar from Plan 04-01
- Header h1 gets `font-title` class (Playfair Display)
