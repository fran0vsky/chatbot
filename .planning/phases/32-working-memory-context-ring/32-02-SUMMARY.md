---
phase: 32-working-memory-context-ring
plan: "02"
subsystem: chat-context-ring
tags: [context-ring, token-estimation, usage-indicator, shared-types, ui]
dependency_graph:
  requires:
    - "32-01: ChatHistoryItem with image+tool-call replay fields; buildHistory() with capped images + tool messages"
  provides:
    - "MODEL_CONTEXT_WINDOWS map + token-estimation helpers in @org/shared-types"
    - "UsageRing presentational donut SVG component in @chatbot/ui"
    - "InputComposer contextPercent/contextTokens/draftChange extension"
    - "contextUsage computed() in ChatComponent driving live ring"
  affects:
    - "libs/shared-types"
    - "libs/ui"
    - "apps/frontend/chat"
tech_stack:
  added: []
  patterns:
    - "computed() signal derived from messages + currentDraft + activeDino().model"
    - "SVG donut via stroke-dasharray proportional to percent"
    - "char/4 token heuristic + flat IMAGE_TOKEN_COST"
key_files:
  created:
    - libs/shared-types/src/lib/model-context.ts
    - libs/ui/src/lib/usage-ring/usage-ring.ts
    - libs/ui/src/lib/usage-ring/usage-ring.html
    - libs/ui/src/lib/usage-ring/usage-ring.stories.ts
  modified:
    - libs/shared-types/src/index.ts
    - libs/ui/src/index.ts
    - libs/ui/src/lib/input-composer/input-composer.ts
    - libs/ui/src/lib/input-composer/input-composer.html
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
decisions:
  - "MODEL_CONTEXT_WINDOWS in shared-types (not backend model-capabilities.ts) — client ring must run live in browser without a round-trip"
  - "DEFAULT_CONTEXT_WINDOW=8000 (conservative) so ring warns early for unknown models (D-07)"
  - "char/4 heuristic + IMAGE_TOKEN_COST=1000 flat — documented as approximate (D-08)"
  - "SYSTEM_PROMPT_ALLOWANCE=800 — client never holds the system prompt, fixed allowance"
  - "contextUsage is a computed() signal; updates on every messages()/currentDraft()/activeDino() change"
  - "draftChange EventEmitter on InputComposer feeds currentDraft signal without coupling services"
  - "contextPercent null (default) hides ring entirely — groupchat/arena composers unaffected"
metrics:
  duration: "~35 minutes"
  completed: "2026-06-08"
  tasks_completed: 4
  tasks_total: 5
  files_changed: 10
---

# Phase 32 Plan 02: Context-Usage Ring Summary

**One-liner:** Live SVG donut ring in the chat composer estimating context-window fill (char/4 heuristic + IMAGE_TOKEN_COST) against per-model window sizes from a new shared-types map, warning at ~80% — warn-only, nothing auto-removed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Model context-window map + token-estimation helpers in shared-types | e49954a | libs/shared-types/src/lib/model-context.ts, libs/shared-types/src/index.ts |
| 2 | Presentational UsageRing donut component + Storybook story | 13fb800 | libs/ui/src/lib/usage-ring/* (3 files), libs/ui/src/index.ts |
| 3 | Add optional context-ring inputs to InputComposer and render the ring | 63b77f9 | libs/ui/src/lib/input-composer/input-composer.ts, input-composer.html |
| 4 | Compute the live context estimate in chat.ts and wire it to the composer | 552d930 | apps/frontend/src/app/chat/chat.ts, chat.html |
| 5 | Live UAT — ring fills, warns at ~80%, and never deletes context | — | Manual — awaiting human verification |

## What Was Built

### Task 1: Model Context-Window Map + Token Estimation Helpers

New file `libs/shared-types/src/lib/model-context.ts` exports:
- `MODEL_CONTEXT_WINDOWS: Record<string, number>` — all 5 dino registry models + `gpt-4o-mini`/`openai/gpt-4o-mini` + `google/gemini-2.5-flash-image`, each with their known window sizes (~128k for free models, ~1M for Gemini flash)
- `DEFAULT_CONTEXT_WINDOW = 8000` — conservative fallback for unknown models
- `getContextWindow(modelId)` — returns mapped value or default
- `estimateTextTokens(text)` — `Math.ceil(text.length / 4)` heuristic
- `IMAGE_TOKEN_COST = 1000` — flat per retained image

All values documented as deliberately approximate (D-08). Exported from shared-types barrel via `.js` extension convention.

### Task 2: UsageRing Presentational Component

New `UsageRing` standalone OnPush component (`app-usage-ring`) in `libs/ui`:
- Inputs: `percent` (0–100, clamped), `tokens` (optional, for tooltip), `warnThreshold` (default 80)
- Template: SVG donut — background track circle + foreground arc via `stroke-dasharray` computed from `percent * circumference/100`
- Warning colour: `text-amber-500/text-amber-400` when `percent >= warnThreshold`; normal colour is `text-jungle-accent`/`text-jungle-night-accent`
- Accessibility: `role="img"`, `[attr.aria-label]`, `[attr.title]` showing "~N tokens (~X%)"
- No injected services, no domain types
- Four Storybook stories: Low (15%), Mid (55%), Warning (85%), Full (100%)
- Exported from `@chatbot/ui` barrel via `.js` extension

### Task 3: InputComposer Extension

`InputComposer` gained:
- `@Input() contextPercent: number | null = null` — when non-null, renders the ring
- `@Input() contextTokens?: number` — passed to ring tooltip
- `@Output() draftChange = new EventEmitter<string>()` — emitted on textarea `(input)` event alongside `autoResize`
- `UsageRing` added to component `imports` array
- Template: `<app-usage-ring>` rendered immediately before the send/stop button, gated with `@if (contextPercent !== null)`

### Task 4: Live Context Estimate in ChatComponent

`ChatComponent` gained:
- `SYSTEM_PROMPT_ALLOWANCE = 800` constant (client never holds the system prompt)
- `IMAGE_CAP = 2` constant (matches `buildHistory()` from Phase 32-01)
- `currentDraft = signal('')` updated via `(draftChange)` output
- `contextUsage = computed()` returning `{ tokens, percent }`:
  - Sums `estimateTextTokens()` for all user/assistant messages in history (slice(0, -1))
  - Adds `estimateTextTokens(toolResult)` for tool messages
  - Adds `IMAGE_TOKEN_COST` per retained image (up to IMAGE_CAP, newest-first)
  - Adds `SYSTEM_PROMPT_ALLOWANCE`
  - Adds `estimateTextTokens(currentDraft())`
  - Divides by `getContextWindow(activeDino()?.model ?? '')`
- Both main chat composers bound with `[contextPercent]`, `[contextTokens]`, `(draftChange)`
- Groupchat (`#groupComposer`) and arena composers have no ring bindings

### Task 5: Live UAT (Pending)

Manual UAT required to verify CTX-03 live:
1. Confirm donut ring is visible in the composer near the send button, shows low % on a fresh thread
2. Type a long draft and watch the % climb live
3. Build up a long thread until estimate crosses ~80%; confirm ring shifts to amber warning + tooltip
4. Confirm NOTHING is auto-removed (warn-only — D-10)
5. Confirm ring does NOT appear on groupchat/arena composers

## Deviations from Plan

**1. [Rule 2 - Missing entries] Added `gpt-4o-mini` variants and Gemini flash image to MODEL_CONTEXT_WINDOWS**
- **Found during:** Task 1 implementation
- **Issue:** The backend uses both `gpt-4o-mini` (bare) and `openai/gpt-4o-mini` (namespaced) as the fallback model; also Vinci dino uses `google/gemini-2.5-flash-image`
- **Fix:** Added both variants of gpt-4o-mini and the Gemini image model to the map
- **Files modified:** libs/shared-types/src/lib/model-context.ts

None — plan executed as designed for all other aspects.

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary schema changes introduced.
- Token estimate is derived entirely from data already in the client's own session (T-32-02-01: accepted)
- contextUsage recompute is O(messages) cheap arithmetic on a capped 20-turn list (T-32-02-02: mitigated — computed() behind signal)
- Estimate is explicitly approximate and advisory; documented in code (T-32-02-03: accepted)

## Known Stubs

None — the ring shows real live estimates derived from actual message content, not placeholders.

## Verification

- `npm exec nx -- run-many -t lint,build --projects=@org/shared-types,@chatbot/ui,frontend` — builds green; `@chatbot/ui:lint` has pre-existing `@nx/enforce-module-boundaries` errors (workspace config issue present since Phase 24, unrelated to this plan)
- `npm exec nx -- lint frontend --quiet` — passes (0 errors)
- Storybook: `UsageRing` has four fill-state stories (Low/Mid/Warning/Full)
- Manual UAT (Task 5): pending human verification

## Self-Check: PASSED

Files verified present:
- libs/shared-types/src/lib/model-context.ts — exists
- libs/shared-types/src/index.ts — updated with `export * from './lib/model-context.js'`
- libs/ui/src/lib/usage-ring/usage-ring.ts — exists
- libs/ui/src/lib/usage-ring/usage-ring.html — exists
- libs/ui/src/lib/usage-ring/usage-ring.stories.ts — exists
- libs/ui/src/index.ts — updated with `UsageRing` export
- libs/ui/src/lib/input-composer/input-composer.ts — updated
- libs/ui/src/lib/input-composer/input-composer.html — updated
- apps/frontend/src/app/chat/chat.ts — updated
- apps/frontend/src/app/chat/chat.html — updated

Commits verified:
- e49954a feat(32-02): add model context-window map and token-estimation helpers to shared-types
- 13fb800 feat(32-02): add UsageRing presentational donut component with Storybook stories
- 63b77f9 feat(32-02): extend InputComposer with context-ring inputs and draftChange output
- 552d930 feat(32-02): wire live context-usage estimate in chat.ts and bind ring to main composer
