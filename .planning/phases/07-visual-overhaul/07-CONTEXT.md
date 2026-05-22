# Phase 7: Visual Overhaul — Context

## Phase Goal

Complete visual overhaul of the chatbot UI. Keep the existing western/desert theme
(sand colors, cactus silhouettes, the soul of it) but modernize every component to
match the polish level of ChatGPT, Claude, or Gemini. This is a big surface-area
change — sidebar, message bubbles, input area, typography, spacing, scrolling,
transitions, empty states, loading states.

## User Decisions (locked — do not re-ask)

### Design inspiration / references

- **ChatGPT** — clean sidebar with conversation history, subtle hover states, compact message list.
- **Claude** — spacious message bubbles, clear human/AI distinction, smooth input area.
- **Gemini** — polished send button, nice focus rings.
- Blend these patterns into the existing sand/amber/brown desert palette. Do NOT
  replace the theme — elevate it.

### Scope

**In scope:** every visible UI component — layout, sidebar, message list, bubbles,
input, buttons, scrollbar, empty state, loading spinner, typography scale, spacing
system, micro-animations.

**Out of scope:** backend changes, new features, routing changes.

## Constraints (from project)

- Tailwind CSS only — no inline styles.
- Angular standalone components with OnPush change detection.
- Desert theme palette and day/night toggle from Phases 4–6 must be preserved.
