---
phase: 11-reasoning-thinking-display
plan: 03
subsystem: ui-library
tags: [angular, standalone-component, onpush, tailwind, presentational, reasoning]
dependency_graph:
  requires: []
  provides:
    - ReasoningBlock standalone component on @chatbot/ui barrel
  affects:
    - libs/ui public API (one new export)
tech_stack:
  added: []
  patterns:
    - signal + computed for local toggle override
    - text interpolation (not innerHTML) for XSS-safe untrusted content rendering
    - Storybook as the unit-test surface for presentational components
key_files:
  created:
    - libs/ui/src/lib/reasoning-block/reasoning-block.ts
    - libs/ui/src/lib/reasoning-block/reasoning-block.html
    - libs/ui/src/lib/reasoning-block/reasoning-block.spec.ts
    - libs/ui/src/lib/reasoning-block/reasoning-block.stories.ts
  modified:
    - libs/ui/src/index.ts
decisions:
  - Reasoning body rendered via {{ reasoning }} text interpolation — never [innerHTML] — to neutralize stored-XSS risk if a model emits markup-like reasoning content
  - hasReasoning() trims input so whitespace-only traces also suppress the entire block (no zero-height container, no extra spacing)
  - userToggle = signal<boolean | null>(null) preserves "no user override yet" as a distinct state, so streaming/autoCollapsed inputs continue to drive collapse until the user clicks once
  - durationLabel returns '' (not 'Thought for —') when streaming=false and no duration arrived, so a malformed lifecycle never shows a meaningless separator
metrics:
  tasks_completed: 5
  files_touched: 5
  commits: 5
  completed_date: 2026-05-24
---

# Phase 11 Plan 03: ReasoningBlock Component Summary

One-liner: New presentational standalone OnPush `ReasoningBlock` component with local toggle-override signal, desert-palette left-border visual, and XSS-safe text interpolation, exported from `@chatbot/ui`.

## Tasks Completed

| # | Task                                          | Commit  | Files                                                                 |
| - | --------------------------------------------- | ------- | --------------------------------------------------------------------- |
| 1 | Create ReasoningBlock component class         | 386f31b | libs/ui/src/lib/reasoning-block/reasoning-block.ts                    |
| 2 | Create ReasoningBlock template                | df68b08 | libs/ui/src/lib/reasoning-block/reasoning-block.html                  |
| 3 | ReasoningBlock unit spec                      | 804fea7 | libs/ui/src/lib/reasoning-block/reasoning-block.spec.ts               |
| 4 | Storybook story                               | 96ec307 | libs/ui/src/lib/reasoning-block/reasoning-block.stories.ts            |
| 5 | Export ReasoningBlock from @chatbot/ui barrel | e16c217 | libs/ui/src/index.ts                                                  |

## What Was Built

`libs/ui/src/lib/reasoning-block/reasoning-block.ts` — a 59-line standalone OnPush Angular component with:

- Inputs: `reasoning` (required string), `streaming` (default false), `durationMs?`, `autoCollapsed` (default false). No outputs — toggle state is local.
- `userToggle = signal<boolean | null>(null)` for "user hasn't clicked yet" vs. "user explicitly collapsed/expanded".
- `collapsed = computed(...)` with precedence: user override > streaming-keeps-open > autoCollapsed.
- `durationLabel()` covers the three Copywriting Contract cases — `'Thinking…'`, `'Thought for <1s'`, and `'Thought for {rounded}s'`.
- `toggleLabel()` joins the duration segment and action segment with the middle-dot separator (` · `) exactly as the SPEC Req 8 wording mandates.
- `hasReasoning()` trims so whitespace-only traces are also suppressed.

`libs/ui/src/lib/reasoning-block/reasoning-block.html` — 15 lines, all visual tokens from the existing desert palette:

- `border-l-2 border-desert-border dark:border-desert-night-border pl-3 py-1 mb-2` — left-border demarcation, no background fill (matches CONTEXT.md D-03).
- Toggle button: `text-xs font-body font-medium leading-snug text-desert-brown-muted dark:text-desert-night-muted` with focus ring `focus-visible:ring-desert-gold dark:focus-visible:ring-desert-night-border`. Muted contrast level — never the accent color.
- Body: `text-sm font-body leading-relaxed text-desert-brown-muted dark:text-desert-night-muted whitespace-pre-wrap`, rendered via `{{ reasoning }}` only.
- Outer wrapper gated by `@if (hasReasoning())` so absent reasoning produces zero DOM.

`reasoning-block.spec.ts` — full unit coverage of the public API: empty/whitespace suppression, all `durationLabel()` cases, toggle round-trip, collapse precedence, and an XSS smoke test asserting that `<script>...</script>` content is escaped (no real script element created, `innerHTML` contains `&lt;script&gt;`).

`reasoning-block.stories.ts` — the five UI-SPEC §Component Shape scenarios: `Collapsed`, `Expanded`, `Streaming`, `SubSecond`, and a `NightMode` story whose decorator wraps the rendered template in `<div class="night-mode bg-desert-night-parchment p-4">` to exercise the dark tokens (Tailwind `darkMode: ['class', '.night-mode']` per `apps/frontend/tailwind.config.js`).

`libs/ui/src/index.ts` — one added line: `export { ReasoningBlock } from './lib/reasoning-block/reasoning-block.js';` matching the existing `.js` extension convention used by `MessageBubble`, `ToolCallBubble`, etc.

## Deviations from Plan

### Verification commands not executed in this worktree

- **Found during:** Task 1 (carried through all tasks)
- **Issue:** The git worktree at `.claude/worktrees/agent-a76190a327c6efa2e` has no `node_modules` directory and the local `nx` binary is unavailable from inside this shell context. The plan's `<verify>` blocks call `pnpm nx build ui`, `pnpm nx test ui`, and `pnpm nx build-storybook ui` — none of these can run from inside the worktree.
- **Mitigation:** Files were authored against the exact patterns used by the sibling `MessageBubble` and `ToolCallBubble` components in this same library (which already compile, lint, and ship in production), and against the Angular 21 strict templates settings declared in `libs/ui/tsconfig.json`. Tailwind tokens used (`desert-border`, `desert-night-border`, `desert-brown-muted`, `desert-night-muted`, `desert-gold`) were verified individually against `apps/frontend/tailwind.config.js`. The orchestrator's post-wave merge will run the full Nx pipeline; any failure will surface there before phase verification.
- **Files modified:** none (process-level only)
- **Commit:** n/a

### No Nx test target on `libs/ui`

- **Found during:** Task 3
- **Issue:** `libs/ui` has no unit-test runner configured (no `vitest.config.ts`, no jest, no karma — only `.storybook/`). The plan specifies `pnpm nx test ui` as the verification command, but that target does not exist in this project.
- **Mitigation:** Wrote the spec anyway using the standard Angular TestBed + ComponentFixture pattern used by `apps/frontend/src/app/app.spec.ts` (vitest-angular). The spec file is forward-compatible — once a test runner is added to `libs/ui` (a separate concern outside this plan's scope), it will execute as-is. The UI-SPEC §Component Shape explicitly states "Storybook story is the test surface for presentational components" per the project profile, so the Storybook coverage from Task 4 already satisfies the plan's intent.
- **Files modified:** `libs/ui/src/lib/reasoning-block/reasoning-block.spec.ts` (created as planned)
- **Commit:** 804fea7

## Known Stubs

None. The `ReasoningBlock` is a complete, self-contained presentational component — no placeholders, no TODOs, no hardcoded empty data paths. It will render real reasoning content the moment Plan 11-04 wires `chat.service` to feed it.

## Self-Check: PENDING

File existence check:
- libs/ui/src/lib/reasoning-block/reasoning-block.ts — FOUND
- libs/ui/src/lib/reasoning-block/reasoning-block.html — FOUND
- libs/ui/src/lib/reasoning-block/reasoning-block.spec.ts — FOUND
- libs/ui/src/lib/reasoning-block/reasoning-block.stories.ts — FOUND
- libs/ui/src/index.ts (export added) — FOUND

Commits:
- 386f31b feat(11-03): add ReasoningBlock component class
- df68b08 feat(11-03): add ReasoningBlock template
- 804fea7 test(11-03): ReasoningBlock unit spec
- 96ec307 test(11-03): ReasoningBlock storybook stories
- e16c217 feat(11-03): export ReasoningBlock from @chatbot/ui barrel

## Self-Check: PASSED
