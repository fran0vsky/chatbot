# Phase 43: When-to-React Configuration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 43-when-to-react-configuration
**Areas discussed:** Control type, Enforcement, Defaults, Settings UI surface, Precedence with persona, Persistence

---

## Control type

| Option | Description | Selected |
|--------|-------------|----------|
| Preset levels | 4-step never/rarely/normal/chatty; deterministic, testable propensity + one nudge line | ✓ |
| Free-text rule | Short user-authored rule appended to decision prompt; expressive but hard to prove/test | |
| Presets + optional note | Preset primary + optional free-text note; more power, fuzzier SC#2 proof | |

**User's choice:** Preset levels (Recommended)
**Notes:** Maps cleanly to SC#2 ("observably changes frequency") and keeps the decision prompt testable. Free-text deferred.

---

## Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Hard clamp + nudge | `never` deterministically forces silent; other levels inject a propensity nudge | ✓ |
| Prompt nudge only | All levels are prompt text; `never` not guaranteed | |

**User's choice:** Hard clamp + nudge (Recommended)
**Notes:** Makes SC#2 observable even when the model ignores the nudge; `never` becomes a hard guarantee.

---

## Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| `normal` = today's behavior | No stored row → `normal` → no nudge, no clamp → identical to Phase 41 | ✓ |
| Per-dino baked default | Each dino ships a persona-derived default; changes behavior on day one | |

**User's choice:** `normal` = today's behavior (Recommended)
**Notes:** Satisfies SC#4 literally — zero behavior change for users who never configure a dino.

---

## Settings UI surface

| Option | Description | Selected |
|--------|-------------|----------|
| Group-chat settings panel | Lists roster dinos, each with the control; covers built-in + custom uniformly | ✓ |
| On the dino card/picker | Inline control on each card; clutters picker, mixes selection with config | |
| Per-dino editor + built-in fallback | Custom in editor, built-ins elsewhere; two inconsistent surfaces | |

**User's choice:** Group-chat settings panel (Recommended)
**Notes:** Matches roadmap framing ("group-chat config"); model on existing `skill-manager` component.

---

## Precedence with persona

| Option | Description | Selected |
|--------|-------------|----------|
| Setting = frequency, persona = content | Persona shapes how/what; level shapes how often; `never` absolute override | ✓ |
| Persona wins | Authored prompt overrides the setting; makes setting unreliable | |
| Setting fully overrides | Level replaces persona reactivity; discards user's authored intent | |

**User's choice:** Setting = frequency, persona = content (Recommended)
**Notes:** Documented precedence for SC#3; `never` overrides persona absolutely.

---

## Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| One (userId, dinoId) settings table | New table keyed (userId, dinoId); works for built-in + `custom:` ids; null-db degrades | ✓ |
| Column on custom_dinos + table for built-ins | Asymmetric two-path storage to keep in sync | |

**User's choice:** One (userId, dinoId) settings table (Recommended)
**Notes:** Mirrors `userMemories`/`dinoSkills`; no `custom_dinos` schema change.

---

## Claude's Discretion

- Exact table/column/endpoint names; per-roster vs per-dino read shape.
- Precise nudge wording per level (must make `rarely` vs `chatty` visibly differ).
- Panel layout/placement, entry point, and control widget (segmented control vs slider vs select).
- Whether `normal` is stored explicitly or represented as "no row".

## Deferred Ideas

- Free-text per-dino reaction rule (alternative to presets).
- Per-message reaction overrides; reaction analytics (out of scope per roadmap).
- Per-dino persona-derived default levels (rejected — would violate SC#4).
- Planning risk noted: Phase 42 partially shipped — custom-dino group-chat E2E proof of SC#3 is gated on Phase 42's chat-loop resolution gap.
