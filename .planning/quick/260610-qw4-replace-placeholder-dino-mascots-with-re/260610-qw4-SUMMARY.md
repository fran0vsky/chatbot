---
quick_id: 260610-qw4
slug: replace-placeholder-dino-mascots-with-re
date: 2026-06-10
status: complete
---

# Summary — 260610-qw4

Replaced the tinted-Spino placeholder dino mascots with real generated pixel-art
for all **6** dinos and wired per-dino head avatars into the chat UI.

## What changed

- **Keyer (`scripts/split-mascot.js`):** swapped the per-pixel black-threshold +
  partial-alpha pass for **flood-fill** background removal (BFS from the image
  edges over near-black pixels). The old logic faded interior dark scales to
  partial transparency, punching see-through holes in shaded sprites; flood fill
  only clears background-connected black, so claws/shadows stay solid. Verified on
  magenta composites — all 6 bodies (incl. Nimbus's spread wings) are hole-free.
- **Assets:** stacked each `_incoming` day/night into `_src/{id}-dual.png`, split →
  `dinos/{id}-day.png` + `{id}-night.png` (≤800px), and keyed each head →
  `dinos/avatars/{id}.png` (256² transparent). Full-res masters (`{id}-dual.png`,
  `{id}-head.png`) kept in `_src/`.
- **UI wiring (modern chatbot pattern):** the active dino's head avatar now shows
  in the chat header and beside every assistant message bubble. `message-bubble`
  gained an `avatarSrc` input (with Spino fallback on load error); `chat.ts` added
  the `activeDinoAvatarSrc` computed; the header switched from the body mascot to
  a circular avatar. Body mascots remain in the Explore/picker/groupchat/arena
  gallery surfaces.

## Cleanup

- Deleted `scripts/gen-placeholder-mascots.js`.
- Closed the 2026-05-29 placeholder todo (moved to `todos/completed/`).
- Refreshed `dinos/_src/README.md` (flood-fill keying, 6-dino roster, avatars).
- Removed the `_incoming/` staging folder.

## Verification

- `npx nx build frontend` succeeds (only pre-existing budget/prismjs warnings).
- Keying QA via magenta + 48px contact sheets: all bodies solid, all avatars
  read as distinct species at avatar size.

## Follow-ups / HUMAN-UAT

- Visual check in the running app: header + assistant-bubble avatars per dino,
  day/night body swap, picker still shows bodies. (Not run here.)
