---
phase: 27-ngrx-state-refactor
reviewed: 2026-05-30T10:57:02Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - apps/frontend/src/app/app.config.ts
  - apps/frontend/src/app/chat/chat.html
  - apps/frontend/src/app/chat/chat.spec.ts
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/chat/dino.service.ts
  - apps/frontend/src/app/store/action-catalogue.spec.ts
  - apps/frontend/src/app/store/action-catalogue.ts
  - apps/frontend/src/app/store/app.state.ts
  - apps/frontend/src/app/store/dino/dino.actions.ts
  - apps/frontend/src/app/store/dino/dino.effects.ts
  - apps/frontend/src/app/store/dino/dino.reducer.ts
  - apps/frontend/src/app/store/dino/dino.selectors.ts
  - apps/frontend/src/app/store/effects.ts
  - apps/frontend/src/app/store/reducers.ts
  - apps/frontend/src/app/store/session/session.actions.ts
  - apps/frontend/src/app/store/session/session.effects.ts
  - apps/frontend/src/app/store/session/session.reducer.ts
  - apps/frontend/src/app/store/session/session.selectors.ts
  - apps/frontend/src/app/store/ui/ui.actions.ts
  - apps/frontend/src/app/store/ui/ui.effects.ts
  - apps/frontend/src/app/store/ui/ui.reducer.ts
  - apps/frontend/src/app/store/ui/ui.selectors.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
  critical_resolved: 1
status: issues_found
resolution_note: "CR-01 fixed in commit fe75507 (dinoById/groupDinoById now resolve from store roster). WR-01..WR-04 + info findings remain open for user disposition."
---

# Phase 27: Code Review Report

**Reviewed:** 2026-05-30T10:57:02Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

This is an NgRx refactor whose acceptance bar is "identical behavior, better architecture."
The store slices (ui / dino / session), reducers, selectors, effects, and the
`ACTION_CATALOGUE` safety boundary are well-structured and largely faithful to the
pre-refactor logic. The catalogue gate correctly rejects unknown intents and invalid
params, the theme hydrate/persist effects preserve init timing, and `upsertInList`
mirrors `HistoryService.upsertSession`.

However, the refactor introduced **one behavioral regression that breaks the Arena and
Group-chat features**: the dino lookup used by those views (`DinoService.getById`) now
reads a signal that is no longer populated, because dino loading moved into an NgRx
effect that only writes the store. This is a BLOCKER for the "identical behavior" bar.

## Critical Issues

### CR-01: Dino roster no longer populated in `DinoService` — Arena reveal and Group-chat panels silently break

**File:** `apps/frontend/src/app/chat/chat.ts:449`, `apps/frontend/src/app/chat/dino.service.ts:41-44`, `apps/frontend/src/app/store/dino/dino.effects.ts:12-24`

**Issue:**
Pre-refactor, `ngOnInit` called `this.dinoService.loadDinos()`, which populated the
service-level `dinos` signal (verified against `git show <base>^:.../chat.ts:431`).
After the refactor, `ngOnInit` instead dispatches `DinoActions.loadDinos()`
(`chat.ts:449`). The `loadDinos$` effect calls `dinoService.fetchDinos()` and writes the
roster **only into the NgRx store** (`dino.effects.ts:16-21` → `loadDinosSuccess` →
`dinoReducer`). The legacy `DinoService.loadDinos()` method that sets
`this.dinos.set(list)` is now dead — nothing in production calls it (confirmed via
grep: only `dino.service.spec.ts` references it).

Consequently `DinoService.dinos` stays empty forever, and `getById` (`dino.service.ts:43`)
always returns `undefined`. The template uses `getById` (via `dinoById` /
`groupDinoById`, `chat.ts:208-210, 239-241`) in two live paths:

- **Group chat** (`chat.html:158-159`): `@let responseDino = groupDinoById(entry.dinoId); @if (responseDino) {`
  → `responseDino` is always undefined → the `<app-group-response>` for every dino is
  skipped → group-chat answers never render.
- **Arena reveal** (`chat.html:209, 213, 252, 298, 300`): `dinoById(panel.dinoId)` is
  undefined → after voting the panels stay anonymous ("Dino A"/"Dino B"), the persona
  footer never shows, and the per-dino rating line (`@if (panelDinoRev && panelRating)`)
  never renders.

Note the active-chat header (`chat.html:387 activeDino()`) is fine because it reads the
store selector `selectActiveDino`, which is populated by the effect. Only the
service-signal consumers regress — which makes this easy to miss in a smoke test of the
default Chats view.

**Fix:** Make the dino roster flow to the same place the template reads it. Two viable options:

Option A — route `getById` through the store (preferred, single source of truth):
```ts
// dino lookups in chat.ts should use the store roster, not the service signal.
// e.g. read selectRoster into a signal and look up there:
private readonly roster = this.store.selectSignal(selectRoster);

groupDinoById(id: string): DinoSummary | undefined {
  return this.roster().find((d) => d.id === id);
}
dinoById(id: string): DinoSummary | undefined {
  return this.roster().find((d) => d.id === id);
}
```

Option B — have the effect also hydrate the service signal so `getById` keeps working:
```ts
// dino.effects.ts
map((roster) => {
  dinoService.dinos.set(roster);   // keep the signal in sync
  dinoService.loaded.set(true);
  return DinoActions.loadDinosSuccess({ roster });
}),
// and mirror the empty roster in the catchError branch
```
Option A is cleaner (eliminates the now-orphaned `DinoService.loadDinos()` and the
dual source of truth). Whichever is chosen, add a regression test that renders a
group-chat entry / arena reveal and asserts the dino name appears.

## Warnings

### WR-01: Dual source of truth for sessions — store list and `HistoryService` can drift

**File:** `apps/frontend/src/app/store/session/session.effects.ts:26-53`, `apps/frontend/src/app/store/session/session.reducer.ts:23-35`

**Issue:** The session list now lives in two places that are mutated independently: the
reducer maintains an in-memory list (`upsertInList`, `filter`, `map`), while
`persistSessions$` separately calls `HistoryService`, which re-reads localStorage,
mutates, and rewrites. They start from the same hydrated state and apply equivalent
logic, so they agree today. But the effect discards `HistoryService`'s return value
(previously assigned to `this.sessions`), so any divergence — e.g. another tab writing
localStorage, or a future `HistoryService` change — would silently desync the visible
list from the persisted one. Pre-refactor there was a single list (`this.sessions` was
always the value returned by `HistoryService`).

**Fix:** Treat the store as the only read model and `HistoryService` as a pure write
sink (drop its return-value contract), and document that localStorage is write-through
only. Alternatively, have `loadSessions`/`loadSessionsSuccess` re-run after each persist
so the store is reconciled from the durable source. At minimum, add a comment asserting
the equivalence invariant so a future edit to one path flags the other.

### WR-02: `read_last_message` catalogue intent has a side effect (navigates to Chats)

**File:** `apps/frontend/src/app/store/action-catalogue.ts:73-81`

**Issue:** The intent is documented as a "no-op marker" for reading the last assistant
message, but `create()` returns `UiActions.setActiveView({ view: 'chats' })`. The
`setActiveView` reducer also forces `mobileSidebarOpen: false` (`ui.reducer.ts:38-42`).
So a voice assistant asking "read my last message" while the user is on the Arena,
Leaderboard, or Knowledge view will yank them back to Chats and close the sidebar — an
observable, surprising mutation for an intent that claims to mutate nothing.

**Fix:** Emit a genuinely inert marker action (mirroring the `send_message` pattern)
instead of reusing `setActiveView`:
```ts
const readLastMessageAction = (): Action => ({ type: '[Assistant] Read Last Message Requested' });
// ...
create: () => readLastMessageAction(),
```

### WR-03: `selectLastAssistantMessage` returns mutable store reference; loop unguarded against undefined elements

**File:** `apps/frontend/src/app/store/session/session.selectors.ts:27-35`

**Issue:** The selector returns `messages[i]` directly (a live reference into store
state). NgRx state is meant to be immutable; a consumer that mutates the returned
`ChatMessage` would corrupt the store and bypass change detection. Lower severity but
worth hardening since this is the surface a future voice assistant reads.

**Fix:** Return a shallow copy: `return { ...messages[i] };`. (The `.role` access is
safe given `ChatMessage` is always defined per the array type.)

### WR-04: `dispatchCatalogued` default `params = {}` lets zero-arg-looking calls reach schemas that require fields

**File:** `apps/frontend/src/app/store/action-catalogue.ts:116-118`

**Issue:** `params` defaults to `{}`. For entries with required params (`switch_chat`,
`send_message`, `select_dino`) this is harmless — zod rejects `{}`. But the default
masks caller bugs: a voice integration that forgets to pass params for `select_dino`
gets a generic "Invalid params" rather than a clear "missing params" signal, and the
default invites accidental reliance on it. Since this is the sole dispatch surface for
an untrusted future caller, defaulting to "empty object" rather than forcing an explicit
argument weakens the boundary's intent.

**Fix:** Either drop the default (force callers to pass `params` explicitly) or treat
`undefined`/non-object params as an explicit rejection before `safeParse`:
```ts
if (params === undefined || typeof params !== 'object' || params === null) {
  return { ok: false, error: `Missing params for ${name}` };
}
```

## Info

### IN-01: Dead code — `DinoService.loadDinos()` is now unreachable in production

**File:** `apps/frontend/src/app/chat/dino.service.ts:26-39`

**Issue:** Once the effect owns roster loading (see CR-01), the imperative `loadDinos()`
method is only exercised by its own spec. It duplicates the fetch logic in
`fetchDinos()` plus the effect's `catchError`. Leaving it invites a future caller to
re-introduce the dual-load path.

**Fix:** Remove `loadDinos()` (and its now-obsolete spec) if CR-01 is resolved via
Option A; the `dinos`/`loaded` signals can also be deleted if `getById` moves to the
store.

### IN-02: Unused exported selectors (acceptable, flagged for awareness)

**File:** `apps/frontend/src/app/store/dino/dino.selectors.ts:8-11`, `apps/frontend/src/app/store/session/session.selectors.ts:20-35`

**Issue:** `selectDinosLoaded`, `selectActiveSession`, and `selectLastAssistantMessage`
are not consumed by any reviewed file. They are clearly seeded for Phase 29 (voice
assistant) and documented as such, so this is intentional — noting only so it is not
mistaken for accidental dead code. No action required this phase.

### IN-03: `scrollToBottom` uses `setTimeout(0)` without cleanup

**File:** `apps/frontend/src/app/chat/chat.ts:849-851`

**Issue:** Pre-existing pattern (not introduced by this refactor), but worth noting: the
`setTimeout` callback can fire after the component is destroyed, dereferencing
`messageEnd`. It is guarded by optional chaining so it won't throw, and this is unchanged
from before — included only for completeness, not a regression of this phase.

---

_Reviewed: 2026-05-30T10:57:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
