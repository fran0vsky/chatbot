---
phase: 27-ngrx-state-refactor
verified: 2026-05-30T00:00:00Z
status: human_needed
score: 3/4 must-haves verified (4th requires manual regression sweep)
overrides_applied: 0
human_verification:
  - test: "Full regression sweep: serve the app and exercise every flow"
    expected: "Send/stream a message, stop mid-stream, regenerate, edit-and-resend, theme toggle (persists on reload), new chat, switch/delete/rename/pin session, dino picker, Explore view, Groupchat (dino names appear on responses), Arena (dino names revealed after vote), Leaderboard — all behave identically to pre-NgRx baseline"
    why_human: "Static analysis confirms dispatch wiring is correct but cannot observe runtime rendering, streaming behavior, or Redux DevTools action firing"
  - test: "Open Redux DevTools and confirm actions fire for each interaction"
    expected: "Actions such as [UI] Toggle Theme, [Session] New Chat, [Dino] Set Active Dino, [Session] Append Message etc. appear in DevTools on each user interaction"
    why_human: "DevTools observation is a browser-only, runtime check"
---

# Phase 27: NgRx State Refactor — Verification Report

**Phase Goal:** Move frontend app state to NgRx and expose a whitelisted catalogue of dispatchable app actions — the foundation the voice assistant drives.
**Verified:** 2026-05-30
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Active dino, theme, chat session, and message list are managed via NgRx with typed actions/selectors | VERIFIED | `app.state.ts` declares `AppState` with `ui`/`dino`/`session` feature keys. `ui.actions.ts`, `dino.actions.ts`, `session.actions.ts` define typed `createAction` creators. All three feature selectors exist. `app.config.ts` registers `provideStore(reducers)` + `provideEffects(appEffects)`. |
| 2 | A documented whitelist of dispatchable actions exists | VERIFIED | `action-catalogue.ts` exports `ACTION_CATALOGUE` (7 entries: `change_theme`, `new_chat`, `switch_chat`, `read_last_message`, `send_message`, `set_active_view`, `select_dino`), `AppActionName`, `APP_ACTION_NAMES`, and `dispatchCatalogued`. Spec `action-catalogue.spec.ts` asserts whitelist membership and rejection paths (9/9 confirmed passing per REVIEW resolution note). |
| 3 | ChatComponent reads state via selectors and mutates only by dispatching actions | VERIFIED | `chat.ts` injects `Store` (line 85). All migrated state (`messages`, `sessions`, `isDayMode`, `historyOpen`, `mobileSidebarOpen`, `activeView`, `pickerOpen`, `dinos`, `activeDinoId`, `activeDino`) is read via `store.selectSignal(...)`. Every mutation method dispatches: `toggleTheme` → `UiActions.toggleTheme()`, `setActiveView` → `UiActions.setActiveView()`, `switchToSession` → `SessionActions.switchSession()`, `onSend` → `SessionActions.appendMessage()`, `pickDino` → `DinoActions.setActiveDino()`, streaming pipeline commits via `appendMessage`/`setMessages`/`upsertActiveSession`. |
| 4 | No behavioral regression: all existing flows work through the store | UNCERTAIN — needs human | Code-level: CR-01 regression (dino lookups via dead `DinoService.dinos` signal) was identified in code review and fixed in commit `fe75507` — both `dinoById` and `groupDinoById` now read from `this.dinos()` (the `selectRoster` store signal), confirmed at `chat.ts:207` and `chat.ts:238`. WR-01..04 hardened in `bf1c9a2`. No debt markers in store files. Runtime behavior (Groupchat dino names, Arena reveal, streaming stop/regenerate/edit-and-resend, theme persistence on reload) cannot be confirmed without serving the app. |

**Score:** 3/4 truths machine-verified; 1 truth requires human runtime confirmation.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/frontend/src/app/store/app.state.ts` | Root AppState + feature keys | VERIFIED | Exports `AppState`, `UI_FEATURE_KEY`, `DINO_FEATURE_KEY`, `SESSION_FEATURE_KEY` |
| `apps/frontend/src/app/store/action-catalogue.ts` | Whitelist + `dispatchCatalogued` | VERIFIED | Exports `ACTION_CATALOGUE`, `AppActionName`, `APP_ACTION_NAMES`, `dispatchCatalogued` with zod validation |
| `apps/frontend/src/app/store/reducers.ts` | `ActionReducerMap<AppState>` | VERIFIED | Maps all three feature keys to typed reducers |
| `apps/frontend/src/app/store/effects.ts` | Barrel of all app effects | VERIFIED | Registers `hydrateThemeOnInit$`, `persistTheme$`, `loadDinos$`, `loadSessionsOnInit$`, `persistSessions$` |
| `apps/frontend/src/app/store/ui/ui.actions.ts` | UI slice actions | VERIFIED | `initUi`, `setTheme`, `toggleTheme`, `setActiveView`, `toggleMobileSidebar`, `closeMobileSidebar`, `toggleHistory`, `closeHistory`, `openPicker`, `closePicker` |
| `apps/frontend/src/app/store/ui/ui.selectors.ts` | UI selectors | VERIFIED | `selectTheme`, `selectIsDayMode`, `selectActiveView`, `selectMobileSidebarOpen`, `selectHistoryOpen`, `selectPickerOpen` |
| `apps/frontend/src/app/store/ui/ui.effects.ts` | Theme hydrate + persist | VERIFIED | `hydrateThemeOnInit$` on `initUi`; `persistTheme$` on `setTheme`/`toggleTheme` — writes localStorage + applies DOM class |
| `apps/frontend/src/app/store/dino/dino.actions.ts` | Dino slice actions | VERIFIED | `loadDinos`, `loadDinosSuccess`, `loadDinosFailure`, `setActiveDino` |
| `apps/frontend/src/app/store/dino/dino.selectors.ts` | Dino selectors | VERIFIED | `selectRoster`, `selectDinosLoaded`, `selectActiveDinoId`, `selectActiveDino` (join) |
| `apps/frontend/src/app/store/dino/dino.effects.ts` | Dino load effect | VERIFIED | `loadDinos$` dispatches → `DinoService.fetchDinos()` → `loadDinosSuccess`/`loadDinosFailure` |
| `apps/frontend/src/app/store/session/session.actions.ts` | Session slice actions | VERIFIED | `loadSessions`, `loadSessionsSuccess`, `newChat`, `switchSession`, `deleteSession`, `renameSession`, `togglePin`, `appendMessage`, `setMessages`, `upsertActiveSession`, `setActiveSessionId` |
| `apps/frontend/src/app/store/session/session.selectors.ts` | Session selectors incl. `selectLastAssistantMessage` | VERIFIED | All selectors present; `selectLastAssistantMessage` returns shallow copy (WR-03 fix applied) |
| `apps/frontend/src/app/store/session/session.effects.ts` | Session load + persist effects | VERIFIED | `loadSessionsOnInit$` hydrates from `HistoryService.loadSessions()`; `persistSessions$` routes `upsertActiveSession`/`deleteSession`/`renameSession`/`togglePin` to `HistoryService` |
| `apps/frontend/src/app/app.config.ts` | Store providers registered | VERIFIED | `provideStore(reducers)`, `provideEffects(appEffects)`, `provideStoreDevtools` (dev-only via `environment.production` guard) |
| `apps/frontend/src/app/chat/chat.ts` | ChatComponent refactored | VERIFIED | Injects `Store`; all migrated state via `selectSignal`; all mutations via `dispatch`; `dinoById`/`groupDinoById` read `this.dinos()` (store signal, not `DinoService`) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `chat.ts` | `Store` | `inject(Store)` | WIRED | Line 85: `private readonly store = inject(Store)` |
| `chat.ts` | `ui/ui.selectors` | `store.selectSignal(selectIsDayMode)` etc. | WIRED | Lines 89–98: 9 selector signals declared |
| `chat.ts` | `ui/ui.actions` | `store.dispatch(UiActions.*)` | WIRED | `toggleTheme` (506), `setActiveView` (181), `openPicker` (252/556), `closePicker` (256), `toggleHistory` (510), `closeHistory` (514), `toggleMobileSidebar` (172), `closeMobileSidebar` (175), `initUi` (446) |
| `chat.ts` | `session/session.actions` | `store.dispatch(SessionActions.*)` | WIRED | `appendMessage` (602), `setMessages` (621/643), `upsertActiveSession` (581), `newChat` (565), `switchSession` (524), `deleteSession` (531), `renameSession` (541), `togglePin` (549), `setActiveSessionId` (451/638), `loadSessions` (448) |
| `chat.ts` | `dino/dino.actions` | `store.dispatch(DinoActions.*)` | WIRED | `loadDinos` (447), `setActiveDino` (248/522) |
| `action-catalogue.ts` | feature actions | `ACTION_CATALOGUE[name].create(params)` | WIRED | All 7 entries call slice action creators: `UiActions.setTheme/toggleTheme/openPicker/setActiveView`, `SessionActions.switchSession/setActiveSessionId`, `DinoActions.setActiveDino` |
| `app.config.ts` | `reducers` + `appEffects` | `provideStore` + `provideEffects` | WIRED | Both barrel imports present and registered |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `chat.ts` `messages` | `selectMessages` | `session.reducer` ← `appendMessage`/`setMessages`/`switchSession`; hydrated by `loadSessionsOnInit$` from `HistoryService.loadSessions()` | Yes — HistoryService reads localStorage | FLOWING |
| `chat.ts` `dinos` | `selectRoster` | `dino.reducer` ← `loadDinosSuccess`; `loadDinos$` effect calls `DinoService.fetchDinos()` (HTTP) | Yes — HTTP fetch from backend | FLOWING |
| `chat.ts` `isDayMode` | `selectIsDayMode` | `ui.reducer` ← hydrated from `localStorage['desert-theme']` in initial state; `hydrateThemeOnInit$` + `persistTheme$` keep it synced | Yes — localStorage read | FLOWING |
| `chat.ts` `sessions` | `selectSessions` | `session.reducer` ← `loadSessionsSuccess`; persisted via `persistSessions$` | Yes — HistoryService localStorage | FLOWING |
| `dinoById` / `groupDinoById` | `this.dinos()` | `selectRoster` store signal (CR-01 fix: was dead `DinoService.dinos` signal, now reads store) | Yes — same roster as above | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for streaming/UI behaviors — requires a running Angular dev server. The following were confirmed statically:

| Behavior | Check | Result |
|----------|-------|--------|
| `action-catalogue.spec.ts` produces valid actions | Confirmed 9/9 by REVIEW resolution note (`bf1c9a2`) and spec content reviewed | PASS (static) |
| `dispatchCatalogued` rejects unknown names | Spec test line 84–89: asserts `ok: false` + zero dispatched | PASS (static) |
| `read_last_message` does NOT dispatch `setActiveView` | Spec test lines 109–118: asserts type is `[Assistant] Read Last Message Requested` | PASS (static) |
| No TBD/FIXME/XXX markers in store files | grep across `apps/frontend/src/app/store/` | PASS — zero matches |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| NGX-01 | Frontend application state (active dino, theme, chat session, message list) is managed via NgRx with typed actions and selectors | SATISFIED | Three typed slices (`ui`/`dino`/`session`) with actions, reducers, selectors, and effects. ChatComponent reads all migrated state exclusively via `store.selectSignal`. |
| NGX-02 | A whitelisted catalogue of dispatchable app actions exists (change theme, new chat, switch chat, read/listen last message, send message) | SATISFIED | `ACTION_CATALOGUE` contains all 5 named intents from the requirement plus `set_active_view` and `select_dino`. `dispatchCatalogued` validates params via zod before dispatching. Destructive actions are structurally absent. |

Both NGX-01 and NGX-02 are marked `[x]` in `REQUIREMENTS.md` and fully implemented.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `action-catalogue.ts:27-30` | `read_last_message` emits a no-op marker action | Info | Intentional documented stub; Phase 29 adds the listener. The WR-02 fix is in place (no longer dispatches `setActiveView`). |
| `action-catalogue.ts:19-22` | `send_message` emits a marker action `[Assistant] Send Message Requested` | Info | Intentional documented boundary; Phase 29 adds the ChatComponent listener. Both stubs are documented in SUMMARY and REVIEW as intentional Phase 29 items. |

No TBD/FIXME/XXX markers found. No empty implementations that affect live data paths. The two marker actions are intentional Phase 29 integration points, not regressions.

---

### Human Verification Required

#### 1. Full Regression Sweep

**Test:** Serve the app (`pnpm nx serve frontend`) and exercise every flow:
- Send a message and receive a streaming response
- Stop streaming mid-response
- Regenerate a response
- Edit-and-resend a user message
- Toggle theme (day/night) and confirm it persists after a page reload
- Open the history panel, switch sessions, delete a session, rename a session, pin a session
- Start a new chat via the dino picker; pick a different dino
- Navigate to Explore, Groupchat, Arena, Leaderboard views via the sidebar
- In Groupchat: select 2+ dinos, send a prompt — confirm each dino's name appears next to its response
- In Arena: start a battle, vote — confirm both dino names/personas are revealed after voting

**Expected:** All behaviors are identical to the pre-NgRx baseline. No visual regressions, no silent empty-roster failures in Groupchat or Arena.

**Why human:** Runtime rendering, streaming SSE behavior, localStorage persistence across reloads, and Redux DevTools observation cannot be verified by static grep. The CR-01 fix (`fe75507`) routes `dinoById`/`groupDinoById` through the store signal — the fix is structurally correct, but Groupchat and Arena reveal require a live run to confirm dino names appear.

#### 2. Redux DevTools Confirmation

**Test:** With Redux DevTools open, perform: theme toggle, new chat, switch session, send message.

**Expected:** Actions `[UI] Toggle Theme`, `[Session] New Chat`, `[Session] Switch Session`, `[Session] Append Message` appear in the DevTools action log in order.

**Why human:** DevTools is a browser extension observable only at runtime.

---

### Gaps Summary

No gaps blocking the phase goal. The two unresolved items (Task 7 manual regression sweep) are `type="manual" autonomous="false"` from the PLAN — they are human verification items by design, not implementation gaps.

The CR-01 critical regression (dead `DinoService.dinos` signal) was found by code review and fixed in `fe75507`. The WR-01..04 warnings were hardened in `bf1c9a2`. The REVIEW status is `resolved`.

---

_Verified: 2026-05-30_
_Verifier: Claude (gsd-verifier)_
