---
phase: 43-when-to-react-configuration
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - apps/backend/src/app/agents/agents.module.ts
  - apps/backend/src/app/agents/group-agents.service.spec.ts
  - apps/backend/src/app/agents/group-agents.service.ts
  - apps/backend/src/app/agents/group/decision.spec.ts
  - apps/backend/src/app/agents/group/decision.ts
  - apps/backend/src/app/agents/reactivity.controller.ts
  - apps/backend/src/app/agents/reactivity.service.spec.ts
  - apps/backend/src/app/agents/reactivity.service.ts
  - apps/backend/src/app/database/schema.ts
  - apps/frontend/src/app/chat/chat.html
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/chat/reactivity.service.spec.ts
  - apps/frontend/src/app/chat/reactivity.service.ts
  - libs/shared-types/src/lib/dino.types.ts
  - libs/ui/src/index.ts
  - libs/ui/src/lib/reactivity-settings/reactivity-settings.html
  - libs/ui/src/lib/reactivity-settings/reactivity-settings.stories.ts
  - libs/ui/src/lib/reactivity-settings/reactivity-settings.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 43 adds per-(user × dino) "when-to-react" configuration: a new `dino_reactivity`
table, a `ReactivityService` + thin REST controller on the backend, a `ReactionLevel`
nudge/clamp threaded into the group engine, a smart frontend `ReactivityService`, and a
presentational `ReactivitySettings` component.

The slice is well-structured and the graceful-degradation story (null-db → `{}` → every
dino defaults to `'normal'`) is solid and well-tested. The validation in
`ReactivityService.setLevel` correctly throws `BadRequestException` on bad input. No
Critical security or correctness defects were found.

However, there is one genuine logic bug carried into this phase (the
`hasPriorDinoThisRound` flag spans the whole transcript, not the current round) that the
new `level` nudge now amplifies, plus several robustness/consistency warnings around input
validation, server-side enum trust, and frontend logging conventions.

No structural-findings block was supplied, so all findings below are narrative.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `hasPriorDinoThisRound` is computed over the entire transcript, not the current round

**File:** `apps/backend/src/app/agents/group-agents.service.ts:275`
**Issue:** The flag is computed as:
```ts
const hasPriorDinoThisRound = state.transcript.some((m) => m.role === 'dino');
```
`state.transcript` is seeded with prior `history` (line 235) plus this turn's dino answers,
so it contains dino messages from *previous user turns* and *previous rounds*. The variable
name and its consumers treat it as "has any dino spoken in THIS round." In round 0 of any
conversation that has prior group history, the very first dino to decide already sees
`hasPriorDinoThisRound === true`, so it is told "At least one dino has already spoken this
round" (`buildDecisionPrompt`, decision.ts:146) and the per-dino-cap downgrade reacts with
`'👍'` instead of staying silent (line 310). Phase 43 widens the blast radius: the `'rarely'`
nudge steers a dino toward "react/silent" precisely based on this (now misleading) signal,
so the new feature behaves differently than documented for any non-first turn.
**Fix:** Track per-round state, e.g. set a local flag inside the round loop:
```ts
for (let roundIndex = 0; roundIndex < MAX_ROUNDS; roundIndex++) {
  let dinoSpokeThisRound = false;
  for (const dino of order) {
    const hasPriorDinoThisRound = dinoSpokeThisRound;
    // ...after a successful answer:
    dinoSpokeThisRound = true;
  }
}
```
Reactions arguably should also flip the flag depending on intended semantics — decide and
document which.

### WR-02: Controller trusts `body` shape with no validation pipe; malformed body risks a raw 500

**File:** `apps/backend/src/app/agents/reactivity.controller.ts:25-30`
**Issue:** No global `ValidationPipe` is registered in this app (confirmed in
`arena.controller.ts:38` comment). `setLevel` reads `body.userId` and `body.level` directly
off an untyped `SetReactivityRequest`. `ReactivityService.setLevel` validates `level`
against `REACTION_LEVELS` (good), but `userId` is never validated and a non-string `level`
(e.g. a number or array) would be passed straight into the `.includes` check / DB insert.
A request with no JSON body yields `{}` so `body.level` is `undefined` → caught by the enum
check, but a non-object body (e.g. `"foo"`) makes `body.level` throw or pass a garbage value.
The CLAUDE.md backend rule "Never let raw errors bubble up to the client" is at risk.
**Fix:** Validate the contract in the controller (mirroring `arena.controller.ts`):
```ts
if (!body || typeof body.level !== 'string') {
  throw new BadRequestException('level is required');
}
```
Service-side, also guard `typeof level !== 'string'` before the `.includes` check.

### WR-03: `getLevels` casts DB `level` to `ReactionLevel` without validating it

**File:** `apps/backend/src/app/agents/reactivity.service.ts:39` (and `reactivity.controller.ts:18`)
**Issue:** `acc[row.dinoId] = row.level as ReactionLevel;` blindly trusts whatever string is
stored. The `level` column is `text('level').notNull()` (schema.ts:139) with no DB-level
enum/check constraint, and there is "no auto-migration runner" per project memory — the
column is a free-form text field. A stale or manually-inserted row with e.g. `'loud'` flows
through `getLevels` into the engine, where `levels[dino.id] as ReactionLevel` (line 278) is
neither `'never'` nor a known `LEVEL_NUDGE` key, so it silently degrades to no-nudge — but
the GET `/dino-reactivity` response then returns an invalid `ReactionLevel` to the typed
frontend, breaking the type contract. `setLevel` validates on write but `getLevels` does not
filter on read.
**Fix:** Filter unknown levels on read:
```ts
if ((REACTION_LEVELS as readonly string[]).includes(row.level)) {
  acc[row.dinoId] = row.level as ReactionLevel;
}
```

### WR-04: Frontend uses `console.error`, violating the project "no console.log" rule

**File:** `apps/frontend/src/app/chat/reactivity.service.ts:46, 67`
**Issue:** Two `console.error(...)` calls. `apps/frontend/CLAUDE.md` states "No `console.log`
— avoid logging in frontend code." While `console.error` is not literally `console.log`, the
intent of the rule is no console logging in frontend code. The sibling services this claims
to mirror (MemoryService/SkillService) should be checked for consistency, but the rule as
written is violated.
**Fix:** Remove the console calls or route through a proper logging abstraction / silent
degrade, consistent with the documented degraded-mode behavior.

### WR-05: Optimistic `setLevel` is never reverted on server rejection, can desync from persisted state

**File:** `apps/frontend/src/app/chat/reactivity.service.ts:55-69`
**Issue:** `setLevel` optimistically writes the signal then PUTs. On error it deliberately
keeps the optimistic value (documented as "degraded mode"). That is defensible for transient
infra failures, but the backend also throws `BadRequestException` (HTTP 400) for an invalid
level — a real rejection, not a degraded write. In that case the UI keeps showing a value the
server explicitly refused, and a later `load()` will silently overwrite it, surprising the
user. Because the segmented control only emits known `ReactionLevel`s this is unlikely today,
but the contract is fragile.
**Fix:** Distinguish 4xx (revert optimistic update to the prior value) from 5xx/network
(keep optimistic value). Capture the previous level before the optimistic update so it can be
restored.

## Info

### IN-01: `tolerantJsonParse` only succeeds when the model returns pure JSON

**File:** `apps/backend/src/app/agents/group/decision.ts:157-163`
**Issue:** It strips code fences then `JSON.parse`s the whole string. If a model prepends or
appends any prose (common with free models), the parse throws and the dino silently goes
`silent`. This is safe-by-design (degrades to silence) but means real decisions are lost to
chatter. The decision call has a heuristic fallback only on *throw/abort* (group-agents
.service.ts:184), not on a parse-to-silent, so a chatty prose-wrapping model is effectively
muted rather than falling back to its heuristic.
**Fix (optional):** Extract the first `{...}` JSON object substring before parsing, e.g. via
a balanced-brace scan, before degrading to silent.

### IN-02: `agents.module.ts` exports `ReactivityService` with a now-stale comment

**File:** `apps/backend/src/app/agents/agents.module.ts:19-20`
**Issue:** The comment "ReactivityService exported so GroupAgentsService can inject it after
constructor injection" describes a sequencing concern that does not apply — `GroupAgentsService`
and `ReactivityService` are providers in the same module, so the export is unnecessary for
intra-module injection. The export only matters if another module consumes `ReactivityService`;
no such consumer is in this changeset.
**Fix:** Drop the export if unused, or correct the comment to state the real reason.

### IN-03: Reactivity panel reads `reactivityService.levels()` but `participantDinos()` is a method call in the template

**File:** `apps/frontend/src/app/chat/chat.html:200`
**Issue:** `[dinos]="participantDinos()"` calls a non-memoized method (chat.ts:512) on every
change-detection pass. With OnPush this is bounded, but it allocates a new array each CD cycle
and breaks referential stability for the `@Input`. Minor; consider a `computed()` for
consistency with the rest of the component's signal-based state.
**Fix:** Convert `participantDinos` to a `computed()` signal.

### IN-04: Duplicated `'normal'` default literal across three layers

**File:** `apps/backend/src/app/agents/group-agents.service.ts:278`, `libs/ui/.../reactivity-settings.ts:47`, `apps/frontend/.../reactivity.service.ts:29`
**Issue:** The `'normal'` default is repeated as a literal in the engine, the presentational
component, and implicitly via `{}` in the service. The shared-types module already owns
`REACTION_LEVELS`; consider exporting a `DEFAULT_REACTION_LEVEL = 'normal'` constant so the
default lives in one place and cannot drift.
**Fix:** Add and consume `DEFAULT_REACTION_LEVEL` from `@org/shared-types`.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
