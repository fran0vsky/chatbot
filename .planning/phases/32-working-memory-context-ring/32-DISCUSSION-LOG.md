# Phase 32: Working Memory + Context Ring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 32-working-memory-context-ring
**Areas discussed:** Image reuse depth & cost, Tool-result reuse & staleness, Context ring (limit & behavior), Ring placement & visual

---

## Image reuse depth & cost

### Depth
| Option | Description | Selected |
|--------|-------------|----------|
| Last N images (cap) | Retain most recent N (~2–3); older drop off; bounds vision-token cost | ✓ |
| Only the most recent | Single most-recent image only; cheapest but loses older referenced images | |
| All thread images | Every image kept; unbounded cost / window blowout | |

### Send strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Every turn (always) | Retained images sent each turn; deterministic, no retrieval logic | ✓ |
| Only when referenced | Include only when message refers to an image; needs heuristics | |

**User's choice:** Last N images (cap) + sent every turn.
**Notes:** N≈2–3 left to implementer.

---

## Tool-result reuse & staleness

### Injection method
| Option | Description | Selected |
|--------|-------------|----------|
| Replay as ToolMessage | Reconstruct prior tool calls as LangChain ToolMessages; faithful | ✓ |
| Fold into history text | Append "earlier you fetched X" note; simpler but blurs structure | |

### Staleness policy
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse; model may re-fetch | Always reuse, keep tool available so model can re-fetch | ✓ |
| Always reuse (no re-fetch) | Treat stored as authoritative; cheapest but stale risk | |
| Reuse recent only | Only last few turns' results reused | |

**User's choice:** Replay as ToolMessage + reuse with model-controlled re-fetch.
**Notes:** Reused tool text already bounded by Phase 31 caps.

---

## Context ring (limit & behavior)

### Limit denominator
| Option | Description | Selected |
|--------|-------------|----------|
| Per-model real window | Active dino model's actual window; accurate, needs tabulation | (Claude decided) |
| Fixed approximate budget | Single ~8–16k budget regardless of model; simplest | |

### Warning threshold
| Option | Description | Selected |
|--------|-------------|----------|
| ~80% (single warn) | One warning state past ~80% | ✓ |
| Two-stage (80/95%) | Caution + critical states | |

### At limit
| Option | Description | Selected |
|--------|-------------|----------|
| Warn only (MVP) | Ring red + warning; nothing removed | ✓ |
| Auto-trim oldest | Drop oldest turns/images to stay under budget | |

**User's choice:** "Don't have an answer / you decide" for the denominator → Claude chose **per-model real window (bounded map) + ~8k fixed fallback**. Threshold ~80% single warn; warn-only at limit.

---

## Ring placement & visual

### Placement
| Option | Description | Selected |
|--------|-------------|----------|
| In the composer | Near input/send; where attention is | ✓ |
| Chat header | Top of chat pane | |
| Floating / corner | Unobtrusive floating indicator | |

### Visual
| Option | Description | Selected |
|--------|-------------|----------|
| Donut + color + tooltip | % fill, warning color past 80%, hover tooltip with tokens | ✓ |
| Donut, no tooltip | Just colored fill | |
| You decide | Leave exact treatment to implementer | |

**User's choice:** Donut in composer + color shift + tooltip with approx token usage.

---

## Claude's Discretion

- Context-ring limit denominator (user delegated): per-model real window + ~8k fallback.
- Exact N for image cap (2–3), token-estimation heuristic, per-model window numbers, tooltip copy / animation, and AIMessage+ToolMessage reconstruction approach.

## Deferred Ideas

- Exhaustive per-model window tabulation; auto-trim/summarize near limit; intent-based image inclusion; two-stage ring warning; DB persistence across devices.
- Mascot todo (Phase 20) surfaced as a 0.3 match — reviewed, not folded.
