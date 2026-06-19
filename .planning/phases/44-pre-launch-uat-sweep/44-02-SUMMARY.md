---
phase: 44-pre-launch-uat-sweep
plan: 02
subsystem: docs
tags: [documentation, known-limitations, readme]

key-files:
  created:
    - KNOWN_LIMITATIONS.md
  modified:
    - README.md

requirements-completed: [UAT-01]

duration: ~10min
completed: 2026-06-19
---

# Phase 44 Plan 02: Known Limitations Note Summary

**One-liner:** Created `KNOWN_LIMITATIONS.md` at the repo root with user-facing limitations (voice Chrome-only, free-model 429/paid-fallback, paid image-gen, web search status, large-attachment limit, per-device data) and an operational appendix, then linked it from README.md.

## Status: COMPLETE

## What Was Built

- **`KNOWN_LIMITATIONS.md`** (repo root):
  - One-line intro: "DinoAgents is early — here's what to expect."
  - **User-facing limitations** in plain language (no internal terms like TAVILY or 413):
    - Voice features work best in Chrome (Firefox has no mic support)
    - Free models may briefly pause or retry (transparent paid-fallback)
    - Image generation uses a paid model (no free alternative)
    - Web search temporarily unavailable
    - Very large attachments or long conversations may fail to send
    - Data tied to browser/device (no cross-device sync yet)
  - **Operational notes appendix** mapping each to its root cause (TAVILY key, body limit, per-device userId, Phase 38 migration automation status)

- **`README.md`** — Added a `## Known Limitations` section (after the intro paragraph) with a link to `KNOWN_LIMITATIONS.md` and a one-line summary of what's covered.

## Deviations

None. Documentation-only task; no source code modified.

## Verification

- `KNOWN_LIMITATIONS.md` exists at repo root
- Contains voice (Chrome-only), free-model 429/paid-fallback, paid-only image gen, web search, large-attachment, per-device identity entries
- Operational appendix names TAVILY, body limit, per-device userId, DB migration
- `README.md` contains `KNOWN_LIMITATIONS` link (verified with grep)
- No source code changed — no lint/build/test gate applies

## Self-Check: PASSED
