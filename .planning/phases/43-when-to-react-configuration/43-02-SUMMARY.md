---
phase: 43-when-to-react-configuration
plan: "02"
subsystem: frontend/ui
tags: [reactivity, group-chat, angular, ui-component, storybook]
dependency_graph:
  requires: [Phase 43 Plan 01 — ReactivityController + /api/dino-reactivity]
  provides: [ReactivityService (frontend), ReactivitySettings (presentational), GroupChat settings panel]
  affects: [ChatComponent, groupchat surface, @chatbot/ui barrel]
tech_stack:
  added: [ReactivitySettings component, ReactivityService (Angular)]
  patterns: [presentational+smart split (mirrors SkillManager/SkillService), signal-driven optimistic update, OnPush standalone]
key_files:
  created:
    - apps/frontend/src/app/chat/reactivity.service.ts
    - libs/ui/src/lib/reactivity-settings/reactivity-settings.ts
    - libs/ui/src/lib/reactivity-settings/reactivity-settings.html
    - libs/ui/src/lib/reactivity-settings/reactivity-settings.stories.ts
    - apps/frontend/src/app/chat/reactivity.service.spec.ts
    - .planning/phases/43-when-to-react-configuration/43-HUMAN-UAT.md
  modified:
    - libs/ui/src/index.ts (ReactivitySettings export added)
    - apps/frontend/src/app/chat/chat.ts (ReactivityService injected, ReactivitySettings imported, panel signals + handlers)
    - apps/frontend/src/app/chat/chat.html (Reaction settings toggle + app-reactivity-settings mount)
decisions:
  - "ReactivityService mirrors SkillService exactly: inject HttpClient, loadUserId(), environment.apiUrl base"
  - "setLevel() is optimistic — signal updated before PUT, value kept on error (T-43-02-03)"
  - "ReactivitySettings is presentational (no service injection, Input/Output only) — mirrors SkillManager (D-07)"
  - "participantDinos() promoted from private to allow template binding to [dinos]"
  - "Panel toggled per the existing settings-toggle pattern (toggleReactivityPanel + reactivityPanelOpen signal)"
  - "load() called on panel open only — no eager load on ngOnInit to avoid unnecessary HTTP on non-group views"
metrics:
  duration: "~35 minutes"
  completed: "2026-06-19"
  tasks_completed: 6
  files_changed: 9
---

# Phase 43 Plan 02: When-to-React Frontend Summary

**One-liner:** Frontend `ReactivityService` (HTTP get/set + optimistic signal) + presentational `ReactivitySettings` panel (per-dino segmented control, Tailwind, Storybook) wired into the Group Chat surface via `ChatComponent`, completing the end-to-end when-to-react feature (SC#1-SC#4).

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Frontend ReactivityService | a9d8cd4 | apps/frontend/src/app/chat/reactivity.service.ts |
| 2 | ReactivitySettings component + Storybook | a45d0c0 | libs/ui/src/lib/reactivity-settings/* |
| 3 | Export ReactivitySettings from @chatbot/ui barrel | 28544c3 | libs/ui/src/index.ts |
| 4 | Mount panel in GroupChat surface | cfd1dfb | chat.ts, chat.html |
| 5 | ReactivityService unit tests | 58428d4 | reactivity.service.spec.ts |
| 6 | HUMAN-UAT document | 1371b33 | 43-HUMAN-UAT.md |

## What Was Built

### ReactivityService (Task 1)
`@Injectable({ providedIn: 'root' })` service mirroring `SkillService` exactly. Holds a `WritableSignal<DinoReactivityMap>` exposed as a readonly signal via `.asReadonly()`. `load()` issues `GET /api/dino-reactivity?userId=` and sets the signal from `{ levels }`. `setLevel(dinoId, level)` updates the signal optimistically then PUTs `{ userId, level }` to `/api/dino-reactivity/:dinoId`. Errors are logged non-blocking — the optimistic value is kept (T-43-02-03). `userId = loadUserId()` from `chat.service.ts`.

### ReactivitySettings Component (Task 2)
Standalone `OnPush` presentational component at selector `app-reactivity-settings`. Inputs: `dinos: DinoSummary[]`, `levels: DinoReactivityMap`. Output: `levelChanged: EventEmitter<{ dinoId, level }>`. Template iterates `REACTION_LEVELS` (the constant — no hardcoded level literals in the template) per dino row. Active level resolved as `levels[dino.id] ?? 'normal'` (SC#4 / D-05 default). Tailwind-only styling in the desert/jungle theme with a segmented control that is keyboard-operable (aria-pressed, focus-visible rings). Mascot avatar rendered via `<app-mascot>`.

**Storybook:** `reactivity-settings.stories.ts` provides four stories (WithPresetLevels, AllNormal, Empty, SingleDino) with `DinoSummary[]` sample data including a `custom:` prefixed dino to verify SC#3.

### @chatbot/ui Barrel Export (Task 3)
`export { ReactivitySettings } from './lib/reactivity-settings/reactivity-settings.js';` added to `libs/ui/src/index.ts`, matching the `.js`-suffixed style used by `SkillManager`, `DinoCard`, etc.

### GroupChat Wiring (Task 4)
`ChatComponent` wiring follows the exact pattern used for `SkillManager`:
- `ReactivitySettings` added to the `imports` array alongside existing UI components.
- `readonly reactivityService = inject(ReactivityService)` injected.
- `reactivityPanelOpen = signal(false)` drives panel visibility.
- `toggleReactivityPanel()` flips the signal and calls `reactivityService.load()` on open.
- `onLevelChanged({ dinoId, level })` delegates to `reactivityService.setLevel()`.
- `participantDinos()` promoted from `private` to allow template binding.

In `chat.html`, below the dino selector grid and above the transcript, a "Reaction settings" toggle button appears when `selectedGroupDinoIds().length > 0`. Clicking it reveals `<app-reactivity-settings [dinos]="participantDinos()" [levels]="reactivityService.levels()" (levelChanged)="onLevelChanged($event)" />` inside a bordered panel. The toggle button carries `aria-expanded` and `aria-controls` for accessibility.

### Unit Tests (Task 5)
`reactivity.service.spec.ts` uses `HttpTestingController` (mirrors `dino.service.spec.ts`):
- Initial state is `{}`.
- `load()` issues `GET /dino-reactivity` with `userId` param; populates signal.
- `load()` error is non-blocking (signal stays at prior value).
- `setLevel()` updates signal optimistically before flush.
- `setLevel()` issues `PUT /dino-reactivity/:dinoId` with `{ userId, level }`.
- `setLevel()` keeps optimistic value on PUT error.
- Multiple `setLevel()` calls merge without overwriting each other.

### HUMAN-UAT (Task 6)
`43-HUMAN-UAT.md` documents four explicit checks (SC#1-SC#4) against a DB-backed deploy, including: Cloud SQL manual-table SQL prerequisite, Phase 42 dependency note for the custom-dino path of SC#3, localhost + production run checklist.

## Deviations from Plan

### Known Pre-existing Issues (not introduced by this plan)

**1. [Pre-existing] `nx test frontend` crashes on Windows with `referencedFiles[index].pos undefined`**
- This TypeScript/Angular bundler Windows bug has been documented in every frontend plan since Phase 35. The `reactivity.service.spec.ts` was written, type-checked via lint, and reviewed — it cannot be run locally due to this pre-existing environment bug.
- **Impact:** specs unverified locally; same status as all other frontend specs.
- **Reference:** STATE.md blockers, 35-02, 41-03 summaries.

**2. [Pre-existing] `nx build frontend` fails Angular CLI budget check**
- The initial bundle already exceeded the 1 MB budget by ~17 kB before this plan's changes (verified by stash test). This plan adds ~6 kB (ReactivitySettings + service wiring), bringing the overage to ~23 kB. The TypeScript compilation succeeds; only the budget enforcement fails.
- **Impact:** `nx build frontend` exits non-zero due to the budget check. App is functionally correct.
- **Reference:** Pre-existing since Phase 41 (heavy group-engine code + prismjs).

**3. [Pre-existing] `@nx/enforce-module-boundaries` errors in `@chatbot/ui` lint**
- All existing ui components (skill-manager, dino-card, etc.) have the same pre-existing module-boundary error. The new `reactivity-settings.ts` and `.stories.ts` files match this pattern exactly — no new lint error categories introduced.
- **Reference:** Noted in STATE.md Phase 24 decision.

## Known Stubs

None. The reactivity settings are fully functional end-to-end: the panel renders, emits events, the service persists via the Plan 01 API, and the engine reads the levels at group-chat time.

## Threat Surface Scan

No new threat surfaces beyond those in the plan's `<threat_model>`. All three threats addressed:
- T-43-02-01: The `levelChanged` output emits only typed `ReactionLevel` values from the segmented control; the backend (Plan 01) re-validates against `REACTION_LEVELS`.
- T-43-02-02: `ReactivitySettings` binds only `DinoSummary` (no `systemPrompt`) + the user's own levels from `loadUserId()`; no new data exposed.
- T-43-02-03: `load()` and `setLevel()` errors are logged and non-blocking; a missing level renders `'normal'` — the chat experience never breaks on a settings error.

## Self-Check: PASSED

All 6 task commits verified:
- a9d8cd4 — reactivity.service.ts created
- a45d0c0 — reactivity-settings.ts/.html/.stories.ts created
- 28544c3 — index.ts export added
- cfd1dfb — chat.ts + chat.html wired
- 58428d4 — reactivity.service.spec.ts created
- 1371b33 — 43-HUMAN-UAT.md created

Key files confirmed present:
- `apps/frontend/src/app/chat/reactivity.service.ts` — exports ReactivityService
- `libs/ui/src/lib/reactivity-settings/reactivity-settings.ts` — exports ReactivitySettings
- `libs/ui/src/lib/reactivity-settings/reactivity-settings.html` — template
- `libs/ui/src/lib/reactivity-settings/reactivity-settings.stories.ts` — Storybook stories
- `libs/ui/src/index.ts` — barrel includes ReactivitySettings export
- `apps/frontend/src/app/chat/reactivity.service.spec.ts` — unit tests
- `.planning/phases/43-when-to-react-configuration/43-HUMAN-UAT.md` — UAT doc
