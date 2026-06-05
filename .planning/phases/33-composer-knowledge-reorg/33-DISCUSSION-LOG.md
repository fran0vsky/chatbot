# Phase 33: Composer & Knowledge Reorg - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 33-composer-knowledge-reorg
**Areas discussed:** Brain + tools button layout, /teach slash-command UX, Skill 'trigger' field, Edit UX + Knowledge list

---

## Brain + Tools button layout

### Brain click target
| Option | Description | Selected |
|--------|-------------|----------|
| Open the existing teach panel | Brain reuses current teach/skill overlay; Phase 34 upgrades that modal's body | ✓ |
| Open a placeholder modal | New near-empty 'coming soon' stub; teach reachable only via /teach | |
| You decide | Minimize dead UI / rework vs Phase 34 | |

**User's choice:** Open the existing teach panel

### Tools button appearance
| Option | Description | Selected |
|--------|-------------|----------|
| Icon + text label | Pill showing icon + 'Tools' + enabled-count badge | |
| Icon-only + tooltip | Compact icon, labeled via tooltip + aria-label | ✓ |
| You decide | Best satisfy 'clearly-labeled' without crowding | |

**User's choice:** Icon-only + tooltip
**Notes:** Locked requirement that tooltip + aria-label must read "Tools" so SC#1 "clearly-labeled" still holds.

---

## /teach slash-command UX

### How it fires
| Option | Description | Selected |
|--------|-------------|----------|
| Detect on submit/Enter | Type /teach + Enter → opens modal instead of sending | |
| Live autocomplete menu | Typing '/' shows a command menu; select /teach | ✓ |
| You decide | Lighter-weight option that still feels good | |

**User's choice:** Live autocomplete menu

### Trailing text handling
| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fill the instruction field | Trailing text → instruction box; name blank | (chosen by Claude) |
| Ignore trailing text | Open empty modal; /teach is purely a launcher | |
| You decide | Least surprising, least work | ✓ |

**User's choice:** You decide → Claude chose pre-fill the instruction field
**Notes:** Minimal extra work and on the path to Phase 34 (natural text → filled form).

---

## Skill 'trigger' field

| Option | Description | Selected |
|--------|-------------|----------|
| Add 'when-to-activate' now | New DB column + type + API + teach form; matches SC#3, no Phase 34 migration | (chosen by Claude) |
| Keep 2 fields this phase | Edit name+instruction only; defer trigger to Phase 34 | |
| You decide | Least total work across 33+34 honoring SC#3 | ✓ |

**User's choice:** You decide → Claude chose Add 'when-to-activate' now
**Notes:** SC#3 literally names "trigger" as editable; nullable column, empty = always-apply (protects SC#5 no-regression); Phase 34 consumes rather than migrates.

---

## Edit UX + Knowledge list

### Edit UX
| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand in the list | Edit row expands into editable fields with Save/Cancel | (chosen by Claude) |
| Reuse the teach form | Top teach form pre-fills + 'Update' mode | |
| You decide | Reuse most existing UI, cleanest | ✓ |

**User's choice:** You decide → Claude chose Inline expand in the list

### Knowledge structure
| Option | Description | Selected |
|--------|-------------|----------|
| Shared skill-list component | Same `<app-skill-manager>` in modal + Knowledge view, one SkillService source | (chosen by Claude) |
| Knowledge is the home; modal links to it | Full management only in Knowledge view | |
| You decide | Least duplication, clearest mental model | ✓ |

**User's choice:** You decide → Claude chose Shared skill-list component
**Notes:** Inline-edit + shared component are mutually reinforcing — inline edit lives inside the shared presentational list, so it works in both surfaces without depending on the teach form. New `PUT /api/skills/:id` endpoint either way.

---

## Claude's Discretion

- Trailing-text → instruction pre-fill (D-04)
- Add `whenToActivate` field now, nullable, empty = always-apply (D-06/D-07/D-08)
- Inline-expand edit (D-09) + shared `<app-skill-manager>` (D-11)
- Brain glyph, composer button ordering, command-menu styling

## Deferred Ideas

- AI Memory Creator (brain modal contents) — Phase 34.
- "Replace placeholder dino mascots" todo — reviewed, not folded; belongs to Phase 20 (matched only on keyword "dinos").
