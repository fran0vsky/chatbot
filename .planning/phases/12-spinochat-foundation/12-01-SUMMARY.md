---
phase: 12-spinochat-foundation
plan: 01
subsystem: ui
tags: [branding, copy, angular]
requires:
  - phase: 11-reasoning-thinking-display
    provides: existing chat shell and message bubble structure
provides:
  - header title reads "SpinoChat"
  - browser tab title and meta description updated
  - landing greeting includes tagline "The AI that survived"
  - README and CLAUDE.md describe SpinoChat instead of generic Chatbot
affects: [12-02-jungle-palette, 12-03-mascot, marketing/SEO]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - libs/ui/src/lib/header-bar/header-bar.html
    - apps/frontend/src/index.html
    - apps/frontend/src/app/chat/chat.ts
    - README.md
    - CLAUDE.md
key-decisions:
  - "Greeting carries the tagline inline so landing state surfaces it via existing MessageBubble render — no new view needed"
patterns-established: []
requirements-completed: [BRAND-01, BRAND-02, BRAND-03]
duration: 5min
completed: 2026-05-25
---

# Phase 12 Plan 01: Branding Text Swap

**Replaced all visible "Chatbot" naming with SpinoChat / Spino plus the "The AI that survived" tagline across header, tab title, greeting, README, and CLAUDE.md.**

## Accomplishments
- Header `<h1>` and browser tab now read SpinoChat
- Landing state greeting includes the tagline inline
- Project docs (README.md, CLAUDE.md) name the product SpinoChat

## Files Modified
- `libs/ui/src/lib/header-bar/header-bar.html` — header title
- `apps/frontend/src/index.html` — `<title>` + meta description
- `apps/frontend/src/app/chat/chat.ts` — initial + reset greeting strings
- `README.md` — H1 and first paragraph
- `CLAUDE.md` — `## Project` block

## Self-Check: PASSED

- header-bar.html contains `>SpinoChat<` exactly once and no `Chatbot`
- index.html contains `<title>SpinoChat — The AI that survived</title>` and the meta description
- chat.ts contains `the AI that survived` and `SpinoChat` and no `Hello! How can I assist you today?`
- README.md H1 contains `SpinoChat`
- CLAUDE.md contains `**SpinoChat**` under `## Project`
