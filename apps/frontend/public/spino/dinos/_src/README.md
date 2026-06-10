# Per-dino mascot source art

Master art for the dino roster. Two masters per dino live here:

- `{id}-dual.png` — stacked **day over night** body on solid black (consumed by
  the splitter to produce the in-app day/night body mascots).
- `{id}-head.png` — full-res head portrait on solid black (downscaled to the
  256² transparent chat avatar).

`apps/backend/src/app/agents/dinos/dinos.ts` is the source of truth for the roster.

## Roster (ids must match the backend dino registry)

| id        | species          | accent    | notes                         |
|-----------|------------------|-----------|-------------------------------|
| `rexford` | Tyrannosaurus    | `#3f7d3f` | default dino                  |
| `veloce`  | Velociraptor     | `#c47f1a` |                               |
| `glyphos` | Stegosaurus      | `#4a6fa5` |                               |
| `nimbus`  | Pteranodon       | `#7a5ba6` |                               |
| `iris`    | Troodon          | `#2f8f8f` | vision dino                   |
| `vinci`   | Parasaurolophus  | `#c2410c` | image-gen dino                |

## Art spec (match `apps/frontend/public/spino/dual-mascot.png`)

- Detailed painterly pixel art, glowing yellow eyes, textured scaly skin — same
  rendering style as `dual-mascot.png` (study it first).
- **Bodies:** one `{id}-dual.png` in the stacked format — day palette (warm/sunlit)
  on top, night palette (cool teal/blue) on the bottom, on a **solid pure black**
  background. The two halves must be **equal height** (the splitter cuts at the
  vertical midpoint) and each creature fully inside its half.
- **Heads:** one `{id}-head.png`, 3/4 profile portrait (head + upper neck) on a
  **solid pure black** background.
- Distinct, readable species silhouette at small (~48px) sizes.

## Keying

The splitter removes the background with a **flood fill from the image edges** over
near-black pixels — only background-connected black goes transparent, so interior
dark detail (claws, shadows, eye sockets) is preserved. (The earlier per-pixel
partial-alpha pass punched holes through richly shaded sprites — do not reintroduce
it.) Requirement: the background must be **solid pure black**, not a dark gradient
or vignette, or the fill leaves halos.

## Pipeline

```bash
# Bodies: split each stacked dual into dinos/{id}-day.png + {id}-night.png
node scripts/split-mascot.js --all        # or a single id, e.g. `rexford`

# Resize/optimize all assets (bodies → ≤800px; spino assets)
node scripts/optimize-spino-assets.js
```

Head avatars (`dinos/avatars/{id}.png`, 256² transparent) are produced from the
`{id}-head.png` masters with the same flood-fill keying.

Until a dino's assets exist, `<app-mascot>` falls back to the generic Spino SVG so
the UI still renders cleanly.
