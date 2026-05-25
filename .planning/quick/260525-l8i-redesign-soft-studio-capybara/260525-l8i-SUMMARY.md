---
quick_id: 260525-l8i
slug: redesign-soft-studio-capybara
status: complete
date: 2026-05-25
---

# Summary: Soft Studio + Capybara redesign

## What changed

**Palette rebuilt.** Replaced the desert palette (sand/parchment/terracotta/brown/gold + night amber) with a modern Soft Studio palette: warm off-white day mode (`#FAFAF7` bg, `#1A1D21` ink, `#B8845F` warm-tan accent) / deep slate night mode (`#0F1419` bg, `#E8E6DF` text, `#D4A574` amber accent). Updated in both Tailwind configs and both styles.scss files (frontend + storybook).

**Tokens renamed.** `desert-*` and `cactus-green-*` → `studio-*`. Applied across 14 component templates/scripts using a longest-prefix-first replacement map so `desert-night-amber-dark` doesn't get corrupted by a `desert-night` rule firing first. `desert-night-sage` merged into `studio-night-accent` (was only used once as a link color in night mode).

**Mascot replaced.** Inline SVG capybara in [message-bubble.html](libs/ui/src/lib/message-bubble/message-bubble.html) replaces the `<img src=".../creature.png">`. SVG uses `currentColor` so body fill follows `text-studio-accent` (day) and `text-studio-night-accent` (night) automatically — no pixel-scaling artifacts, no second asset for dark mode.

**Background decluttered.** Removed the 11 decorative cactus SVG blocks from [chat.html](apps/frontend/src/app/chat/chat.html). The modern layered shadows on the bubbles + input composer (added in the prior session) now carry the visual weight.

## Files touched

Code (18):
- `apps/frontend/tailwind.config.js`, `libs/ui/tailwind.config.js`
- `apps/frontend/src/styles.scss`, `libs/ui/.storybook/styles.scss`
- `apps/frontend/src/app/chat/chat.html`
- `libs/ui/src/lib/message-bubble/{message-bubble.html, message-bubble.scss, message-bubble.ts}`
- `libs/ui/src/lib/{header-bar, input-composer, reasoning-block, tool-call-bubble, model-selector, theme-toggle, history-panel, typing-indicator, new-button}/*.html`
- `libs/ui/src/lib/reasoning-block/reasoning-block.stories.ts`

Docs (2):
- `.planning/quick/260525-l8i-redesign-soft-studio-capybara/260525-l8i-PLAN.md`
- `.planning/quick/260525-l8i-redesign-soft-studio-capybara/260525-l8i-SUMMARY.md`

## Verification

- ✅ `Grep "desert-|cactus-green"` returns zero matches in non-`.planning/` source files (excluding intentional localStorage keys).
- ⚠️ `nx run frontend:build` not executed — local toolchain has an unrelated Windows ESM URL scheme error (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). User will verify visually at `localhost:4200` on next dev-server reload.

## Intentionally not changed

- **`creature.png` file on disk** (`apps/frontend/public/assets/creatures/creature.png`) — left in place as an orphan; can be `git rm`'d in a follow-up if the SVG capybara is approved.
- **localStorage keys** (`desert-theme`, `desert-chat-history` in [chat.ts](apps/frontend/src/app/chat/chat.ts) and [history.service.ts](apps/frontend/src/app/chat/history.service.ts)) — these are data identifiers, not cosmetic tokens. Renaming would silently drop any existing user's saved theme + chat history. Recommended follow-up: add a one-shot migration that reads old key, writes new key, deletes old.
- **Storybook story snapshots** — not regenerated; visual snapshots may need a manual review pass.

## Brand-conflict check (research log)

Web search performed for AI/tech-product mascot conflicts before settling on capybara. Confirmed safe — no major brand owns a capybara mascot as of 2026 (cross-checked against Firefox/Kit, Otter.ai, Duolingo/Duo, Anthropic/Claude alligator, Discord/Wumpus+Nelly, Meta/Llama, GitHub/Octocat, Linux/Tux).

## Follow-ups (not required to ship)

1. Remove orphaned `creature.png` from disk.
2. Migrate localStorage keys (`desert-theme` → `studio-theme`, `desert-chat-history` → `studio-chat-history`) with backward-compat read.
3. Regenerate Storybook snapshots if any have been committed.
4. Once palette is approved visually, consider adding a subtle CSS animation (idle breathing / blink) to the capybara SVG.
