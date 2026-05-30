---
phase: 27-ngrx-state-refactor
plan: 01
subsystem: frontend-state
tags: [ngrx, state-management, refactor, angular, voice-assistant-prep]
requires:
  - 19-01 (dino picker / explore + DinoService + HistoryService boundaries)
provides:
  - NgRx store (ui/dino/session slices) as the frontend state foundation
  - ACTION_CATALOGUE whitelist + dispatchCatalogued safety gate (Phase 29 entry point)
  - selectLastAssistantMessage selector (Phase 29 "read last message")
affects:
  - apps/frontend ChatComponent (now store-driven)
tech-stack:
  added:
    - "@ngrx/store@21.1.0"
    - "@ngrx/effects@21.1.0"
    - "@ngrx/store-devtools@21.1.0"
    - "zod@4.4.3"
  patterns:
    - "Classic action/reducer/selector NgRx (not SignalStore) — named, enumerable action surface for the assistant"
    - "Effects wrap existing services (DinoService HTTP, HistoryService localStorage, theme DOM) — side effects out of the component"
    - "store.selectSignal in component; mutate only via store.dispatch"
key-files:
  created:
    - apps/frontend/src/app/store/app.state.ts
    - apps/frontend/src/app/store/reducers.ts
    - apps/frontend/src/app/store/effects.ts
    - apps/frontend/src/app/store/ui/ui.actions.ts
    - apps/frontend/src/app/store/ui/ui.reducer.ts
    - apps/frontend/src/app/store/ui/ui.selectors.ts
    - apps/frontend/src/app/store/ui/ui.effects.ts
    - apps/frontend/src/app/store/dino/dino.actions.ts
    - apps/frontend/src/app/store/dino/dino.reducer.ts
    - apps/frontend/src/app/store/dino/dino.selectors.ts
    - apps/frontend/src/app/store/dino/dino.effects.ts
    - apps/frontend/src/app/store/session/session.actions.ts
    - apps/frontend/src/app/store/session/session.reducer.ts
    - apps/frontend/src/app/store/session/session.selectors.ts
    - apps/frontend/src/app/store/session/session.effects.ts
    - apps/frontend/src/app/store/action-catalogue.ts
    - apps/frontend/src/app/store/action-catalogue.spec.ts
  modified:
    - apps/frontend/src/app/app.config.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
    - apps/frontend/src/app/chat/chat.spec.ts
    - apps/frontend/src/app/chat/dino.service.ts
    - package.json
decisions:
  - "Classic @ngrx/store + effects chosen over SignalStore (NGX-02 / Phase 29 need a named, enumerable action surface)"
  - "Migrated only ui/dino/session slices; streaming/knowledge/skill/arena/groupchat stay component signals (bounded refactor)"
  - "activeSessionId tracks ChatService thread id (ChatService stays thread authority; store syncs via setActiveSessionId)"
  - "Theme persistence + DOM class application moved from ChatComponent.applyTheme into ui.effects"
  - "zod 4.4.3 used for catalogue param schemas; destructive intents absent by construction (AST-03)"
metrics:
  tasks_completed: 6
  tasks_total: 7
  commits: 6
  files_created: 17
  files_modified: 6
  duration: ~1 session
  completed_date: 2026-05-30
---

# Phase 27 Plan 01: NgRx State Refactor Summary

NgRx (classic store + effects, v21.1.0) is now the frontend state foundation for the assistant-relevant, persistent slices — `ui` (theme, activeView, panel flags), `dino` (roster, activeDinoId), `session` (sessions, activeSessionId, messages) — and ChatComponent reads them via `store.selectSignal` and mutates them only by dispatching actions. A zod-validated `ACTION_CATALOGUE` whitelist plus `dispatchCatalogued` gate gives Phase 29's voice assistant a safe, named, enumerable action surface (destructive capabilities are structurally absent).

## What shipped (Tasks 1–6)

1. **Install + wire NgRx** — `@ngrx/store`, `@ngrx/effects`, `@ngrx/store-devtools` (21.1.0) and `zod` (4.4.3) installed with `--legacy-peer-deps`. `app.config.ts` registers `provideStore(reducers)` + `provideEffects(appEffects)`; `provideStoreDevtools` is dev-only (skipped when `environment.production`). `app.state.ts` declares root `AppState` + `ui/dino/session` feature keys.
2. **UI slice** — theme / activeView / mobileSidebarOpen / historyOpen / pickerOpen with actions, reducer, per-field selectors. `ui.effects`: hydrates theme on `initUi`, and on `setTheme`/`toggleTheme` persists to `localStorage` (`desert-theme`) and applies the `day-mode`/`night-mode` class to `documentElement` (logic moved out of `ChatComponent.applyTheme`). Initial theme reads localStorage, defaults `night`.
3. **Dino slice** — roster / loaded / activeDinoId. `selectActiveDino` joins activeDinoId with roster. `dino.effects.loadDinos$` calls the new `DinoService.fetchDinos()` observable boundary (HTTP stays in the service) and maps to success/failure with the same graceful empty-roster degradation.
4. **Session slice** — sessions / activeSessionId / messages. Actions: load(+success), newChat, switchSession, deleteSession, renameSession, togglePin, appendMessage, setMessages, upsertActiveSession, setActiveSessionId. `selectLastAssistantMessage` added for Phase 29. `session.effects`: load on init + persist mutating actions through `HistoryService` (store is the in-memory source of truth, HistoryService the durable localStorage boundary — unchanged behavior).
5. **ChatComponent refactor** — injects `Store`; migrated state read via `selectSignal`; every migrated mutation (theme, view, panels, sessions, dino pick, messages) now dispatches actions. The send/stream pipeline (`onSend`/`dispatchRequest`/`handleStreamEvent`/`commitTurn`/`onStop`/`onRegenerate`/`onEditAndResend`) is preserved but writes the message list via `appendMessage`/`setMessages`/`upsertActiveSession` instead of mutating `this.messages`. `chat.html` updated to signal accessors (`messages()`, `sessions()`, `isDayMode()`).
6. **Action catalogue** — `ACTION_CATALOGUE` maps 7 intents (`change_theme`, `new_chat`, `switch_chat`, `read_last_message`, `send_message`, `set_active_view`, `select_dino`) → `{ description, zod params, create() }`. `dispatchCatalogued(store, name, params)` validates against the schema and dispatches only on success; unknown names and invalid params are rejected without dispatching. `AppActionName`/`APP_ACTION_NAMES` expose the whitelist. Spec asserts whitelist membership, absence of destructive intents, valid-action production, and rejection paths — **8/8 passing**.

## Scope boundary (as planned)

Migrated to NgRx: `ui`, `dino`, `session`. **Kept as component signals** (intentionally out of scope): transient streaming state (`streamingText`/`streamingReasoning`/`streamingToolCalls`/`isStreaming`/`reasoningCollapsed`/`streamingError`/`streamingReasoningDurationMs`), knowledge files, skill-panel state, and arena/groupchat selection signals. `activeSessionId` continues to derive from `ChatService.currentThreadId`; the store is kept consistent via `setActiveSessionId` dispatches on init / thread reset / session switch.

## Verification

- `nx lint frontend` — **GREEN**
- `nx build frontend --configuration=development` — **GREEN** (caught + fixed an unused `HistoryService` injection during Task 5)
- `action-catalogue.spec.ts` — **8/8 passing** (run via `vitest run --environment jsdom`)
- `nx run-many -t lint,test --projects=frontend` — **lint GREEN; test target CRASHES** with a pre-existing TS `referencedFiles` bug in `@angular/build:unit-test`. **This crash is NOT caused by this plan** — it was reproduced on the pre-NgRx baseline (commit 2003446) after reverting all Phase 27 changes. See `deferred-items.md`. The catalogue spec was therefore verified via direct vitest; the `chat.spec` TestBed spec compiles under the build pipeline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed now-unused `HistoryService` injection in ChatComponent**
- **Found during:** Task 5 (surfaced by `nx build`, masked in `nx test` by the pre-existing crash)
- **Issue:** persistence moved to `session.effects`, leaving `private readonly historyService = inject(HistoryService)` unused → `TS6133` build error.
- **Fix:** removed the field + its import.
- **Commit:** 8bc3045

**2. [Rule 3 - Blocking] Added `DinoService.fetchDinos()` observable boundary**
- **Found during:** Task 3
- **Issue:** `DinoService.loadDinos()` mutates internal signals and returns `void`; the effect needs an Observable.
- **Fix:** added `fetchDinos(): Observable<DinoSummary[]>` so HTTP stays in the service (frontend rule) and the effect consumes it. `loadDinos()` left intact for backward compatibility.
- **Commit:** 431ec96

**3. [Rule 3 - Blocking] `import '@angular/compiler'` at top of action-catalogue.spec**
- **Found during:** Task 6 (verifying the spec under direct vitest)
- **Issue:** `@ngrx/store`'s partially-compiled `ActionsSubject` needs JIT when loaded outside the Angular build pipeline.
- **Fix:** added the compiler import as a JIT fallback guard (harmless under the real unit-test runner).
- **Commit:** 566c0b2

**Commit-order note:** slices (Tasks 2/3/4) were committed before the Task-1 store-wiring commit so each intermediate commit compiles (`app.state.ts`/`reducers.ts` import the slice reducer types). Functionally equivalent to the plan's 1→4 order.

## Known Stubs

- `read_last_message` catalogue entry currently emits a harmless `setActiveView({view:'chats'})` action so `create()` always yields a valid `Action`; the actual "read" is performed by the assistant reading `selectLastAssistantMessage`. Resolved/finalized in Phase 29 when the assistant wiring lands. Documented intentional placeholder.
- `send_message` emits a marker action `[Assistant] Send Message Requested` (ChatComponent owns the streaming pipeline); the listener is added in Phase 29.

## Threat Flags

None. The new surface (ACTION_CATALOGUE) is a *narrowing* control, not a new attack surface — it mitigates T-27-01 by construction (whitelist + zod validation + absence of destructive intents).

## Remaining checkpoint — Task 7 (manual, NOT done)

**Task 7: Regression sweep — human verification required.** Serve the app and exercise EVERY flow: send/stream, stop, regenerate, edit-and-resend, theme toggle (persists on reload), new chat, switch/delete/rename/pin session, dino picker, Explore, groupchat, arena, leaderboard. Confirm no behavior changed vs pre-refactor, and open Redux DevTools to confirm actions fire for each interaction. This is `type="manual" autonomous="false"` and was not executed by the agent.

## Self-Check: PASSED

All 17 created store files + the SUMMARY exist on disk; all 6 per-task commits (d4181df, 431ec96, a29b668, a8a7709, 8bc3045, 566c0b2) exist in git history.
