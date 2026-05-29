---
phase: 24-arena-leaderboard
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - apps/backend/src/app/arena/elo.ts
  - apps/backend/src/app/arena/elo.spec.ts
  - apps/backend/src/app/arena/arena.service.ts
  - apps/backend/src/app/arena/arena.service.spec.ts
  - apps/backend/src/app/arena/arena.controller.ts
  - apps/backend/src/app/arena/arena.module.ts
  - apps/backend/src/app/database/schema.ts
  - apps/backend/src/app/app.module.ts
  - libs/shared-types/src/lib/arena.types.ts
  - libs/shared-types/src/index.ts
  - apps/frontend/src/app/chat/arena.service.ts
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/chat/chat.html
  - libs/ui/src/lib/leaderboard/leaderboard.ts
  - libs/ui/src/lib/leaderboard/leaderboard.html
  - libs/ui/src/lib/leaderboard/leaderboard.stories.ts
  - libs/ui/src/index.ts
  - libs/ui/src/lib/history-panel/history-panel.ts
  - libs/ui/src/lib/history-panel/history-panel.html
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 24 ships the Dino Arena and Elo leaderboard. The pure Elo math in `elo.ts` is
correct and well-tested, the null-DB graceful-degradation paths are sound, and the
Angular layer follows OnPush/standalone conventions. However, the write path
(`POST /api/arena/vote` → `recordVote`) has serious correctness and integrity
defects rooted in **a complete absence of input validation** and a
**non-atomic read-modify-write upsert**:

- The `@Body() vote: ArenaVote` is never validated — `ArenaVote` is a plain
  interface and there is no global `ValidationPipe` in `main.ts`. An invalid
  `result` value flows straight into a `switch` with no `default`, leaving the
  Elo score terms `undefined` and persisting `NaN` ratings to the database.
- `recordVote` does a read (`loadOrDefault`) then an absolute-value upsert. Two
  concurrent votes touching the same dino produce a lost update; ratings/counters
  are silently corrupted.
- The "identities hidden until vote" invariant is enforced only on the client —
  the matchup endpoint hands real `dinoId`s to the browser, and the vote endpoint
  trusts whatever the client posts.

The Elo formulas, the leaderboard merge/sort, and the frontend streaming/abort
logic are otherwise solid.

## Critical Issues

### CR-01: Unvalidated `result` produces `NaN` ratings persisted to the DB

**File:** `apps/backend/src/app/arena/elo.ts:56-69` (consumed via `arena.service.ts:65`, exposed at `arena.controller.ts:23`)
**Issue:** `ArenaVote` is a plain TypeScript interface and there is **no global
`ValidationPipe`** (`main.ts` never calls `app.useGlobalPipes(...)`, and no
class-validator decorators exist anywhere in the backend). The controller binds
`@Body() vote: ArenaVote` with zero runtime validation. `updateElo` then switches
on `vote.result`:

```ts
switch (result) {
  case 'a': sa = 1; sb = 0; break;
  case 'b': sa = 0; sb = 1; break;
  case 'draw': sa = 0.5; sb = 0.5; break;
  // no default
}
return { ra: Math.round(ra + K_FACTOR * (sa - ea)), ... };
```

A POST with `result: "winner"` (or missing `result`) skips every case, leaving
`sa`/`sb` `undefined`. `K_FACTOR * (undefined - ea)` is `NaN`, `Math.round(NaN)` is
`NaN`, and `NaN` is written into the `integer` rating columns. This is silent data
corruption of the shared leaderboard reachable by any unauthenticated client.

**Fix:** Validate at the boundary. Convert `ArenaVote` to a class DTO with
class-validator and enable a global pipe, and/or harden `updateElo`:
```ts
// elo.ts — make the switch total / fail loud
default:
  throw new Error(`updateElo: invalid result "${result as string}"`);
```
```ts
// main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```
```ts
// arena vote DTO (backend-only)
class ArenaVoteDto {
  @IsString() @IsNotEmpty() aDinoId!: string;
  @IsString() @IsNotEmpty() bDinoId!: string;
  @IsIn(['a', 'b', 'draw']) result!: 'a' | 'b' | 'draw';
}
```

### CR-02: Non-atomic read-modify-write upsert — lost updates under concurrency

**File:** `apps/backend/src/app/arena/arena.service.ts:57-91, 184-207`
**Issue:** `recordVote` reads current ratings with `loadOrDefault`, computes new
absolute values in JS, then upserts with `onConflictDoUpdate({ set: { rating:
row.rating, wins: row.wins, ... } })` — i.e. it writes absolute values, not SQL
increments. Two votes for the same dino arriving concurrently both read rating
`R`, both compute from `R`, and the second upsert overwrites the first. One
vote's rating change and counter increments are silently lost. Because the
counters are also absolute (`rowA.games + 1`), `games` can stall while votes are
accepted, permanently desynchronising the leaderboard. The vote endpoint is
unauthenticated and fire-and-forget, so this is easy to trigger.

**Fix:** Make the write atomic. Either wrap load+update in a single
`db.transaction(...)` with row locking (`SELECT ... FOR UPDATE`), or push the
mutation into SQL using `sql` increments for counters and computing the rating
inside a transaction:
```ts
await db.transaction(async (tx) => {
  const a = await tx.select().from(dinoRatings)
    .where(eq(dinoRatings.dinoId, vote.aDinoId)).for('update');
  // ...compute updateElo from locked rows, then upsert within the same tx
});
```
For counters specifically, prefer `set: { games: sql`${dinoRatings.games} + 1` }`
rather than a JS-computed absolute.

### CR-03: `recordVote` does not reject `aDinoId === bDinoId` (self-match corrupts its own row)

**File:** `apps/backend/src/app/arena/arena.service.ts:50-91`
**Issue:** `getMatchup` deliberately guarantees two distinct dinos
(arena.service.ts:36-41), but `recordVote` never re-checks. Since the vote body is
client-supplied and unvalidated (see CR-01), a client can POST
`{ aDinoId: 'rexford', bDinoId: 'rexford', result: 'a' }`. Both `loadOrDefault`
calls read the same row, two `EloUpdate` results are computed for the same key,
and the two `upsertRating` calls race on the same primary key — last write wins,
so wins/losses/games for that dino are corrupted (e.g. a dino recorded as both
winner and loser of the same match, or only one of the two increments surviving).
Combined with CR-02 the row is left in an internally inconsistent state.

**Fix:** Reject self-matches early in `recordVote`:
```ts
if (vote.aDinoId === vote.bDinoId) {
  this.logger.warn('recordVote: aDinoId === bDinoId — ignored');
  return;
}
```
Also validate that both ids exist in the registry (`DINOS`) before writing, so
arbitrary client-supplied ids cannot seed junk rows in `dino_ratings`.

## Warnings

### WR-01: "Blind until vote" fairness invariant is enforced only client-side

**File:** `apps/frontend/src/app/chat/arena.service.ts:52-60`; `apps/backend/src/app/arena/arena.controller.ts:16-25`
**Issue:** The phase's core invariant is that dino identities stay hidden until a
vote is cast. The matchup endpoint returns the real `aDinoId`/`bDinoId` to the
browser immediately (they sit in `ArenaPanelEntry.dinoId` from the first SSE
token), and reveal is gated purely by `phase() === 'voted'` in the template. Any
user with devtools can read identities before voting, and the vote endpoint
accepts whatever pairing/result the client sends with no link back to the issued
matchup. For a cosmetic leaderboard this is low severity, but the documented
invariant ("the core privacy/fairness invariant") is not actually guaranteed by
the server.
**Fix:** If the invariant must hold, issue an opaque `matchId` from
`GET /matchup`, persist the real pairing server-side keyed by `matchId`, return
only anonymous panel labels to the client, and have `POST /vote` submit
`{ matchId, result }` so the server resolves the true dinos and rejects unknown or
already-voted matchIds. At minimum, document that v1 reveal is advisory/cosmetic.

### WR-02: `getMatchup` can dereference `ids[0]` on an empty registry

**File:** `apps/backend/src/app/arena/arena.service.ts:32-34`
**Issue:** The `ids.length < 2` guard returns `{ aDinoId: ids[0], bDinoId: ids[0] }`.
If `DINOS` were ever empty, `ids[0]` is `undefined`, returning an object whose
ids are `undefined` and silently violating the `string` contract. The comment
admits "should never happen," but the guard does not actually handle the
length-0 case it pretends to cover, and it also produces an `a === b` matchup
that `recordVote` cannot safely process (see CR-03).
**Fix:** Throw on `ids.length < 2` rather than returning a degenerate pair:
```ts
if (ids.length < 2) {
  throw new Error('Arena requires at least two dinos in the registry');
}
```

### WR-03: Vote silently swallowed when DB is down, but UI reports success

**File:** `apps/frontend/src/app/chat/arena.service.ts:75-96`; `apps/backend/src/app/arena/arena.service.ts:50-55, 92-97`
**Issue:** `recordVote` no-ops (and `vote()` catches all errors) when the DB is
unavailable, yet the controller still returns `204 No Content` and the frontend
unconditionally transitions to `phase = 'voted'` and shows post-vote ratings.
The user is told their vote counted when it did not. Graceful degradation is fine,
but the UI gives no signal that ratings are not being persisted, which is
misleading (e.g. ratings shown post-vote will be the DEFAULT_RATING fallback,
implying a "reset").
**Fix:** Surface a "ratings unavailable" state when the leaderboard fetch returns
all-default rows or the vote response indicates non-persistence, or have the
endpoint return a small body (e.g. `{ persisted: boolean }`) the client can react
to.

### WR-04: `phase` is set to `'voted'` before the vote request resolves

**File:** `apps/frontend/src/app/chat/arena.service.ts:75-83`
**Issue:** `vote()` calls `this.phase.set('voted')` (and `stopAll()`) synchronously
before awaiting the POST. Identities are revealed in the template the instant the
button is clicked, regardless of whether the vote actually reached the server. If
the intent is "reveal only after a successful vote," this reveals on click. It
also means a rapid double-click or a failed request still reveals. Functionally it
matches the cosmetic model but contradicts the "revealed after your vote"
copy in `chat.html:179`.
**Fix:** Reveal after the POST resolves (move `phase.set('voted')` into the
`try` after `firstValueFrom`), or accept the optimistic reveal and update the
copy/intent accordingly.

### WR-05: `streamForPanel` reads stale panel text via `this.panels().find(...)` inside token handler

**File:** `apps/frontend/src/app/chat/arena.service.ts:153-159`
**Issue:** On each `token` event the code computes the new text as
`(this.panels().find(e => e.panel === panel)?.text ?? '') + event.text` and passes
it to `updatePanel`, which itself reads `this.panels()` again via `.update`. Two
panels stream in parallel; each `updatePanel` is a full `signal.update` that maps
the whole array. While signals are synchronous so this is currently correct, the
pattern reads the signal twice per token (once to build the patch, once inside
`update`) and is fragile — a future async tweak would reintroduce lost tokens.
The sibling `'done'` case correctly uses `event.response` (authoritative) instead.
**Fix:** Accumulate inside the `update` callback so the read and write are atomic:
```ts
this.panels.update(list => list.map(e =>
  e.panel === panel ? { ...e, text: e.text + event.text } : e));
```

## Info

### IN-01: `DinoRating` interface duplicates the Drizzle row shape

**File:** `libs/shared-types/src/lib/arena.types.ts:7-14`; `apps/backend/src/app/database/schema.ts:106`
**Issue:** `DinoRating` (shared) and `DinoRatingRow = typeof dinoRatings.$inferSelect`
(backend, minus `updatedAt`) describe the same six fields. `loadOrDefault` and
`getLeaderboard` hand-map every field between them. Drift risk if a column is
added.
**Fix:** Acceptable given the shared lib cannot import Drizzle types; consider a
single mapper helper to centralise the field copy.

### IN-02: `ArenaVote.promptId` is declared but never used

**File:** `libs/shared-types/src/lib/arena.types.ts:18-19`; `apps/frontend/src/app/chat/arena.service.ts:79`
**Issue:** `promptId?` is documented as "not persisted" and is never set by the
frontend (`votePayload` omits it) nor read by the backend. Dead field.
**Fix:** Remove it, or wire it into the matchId scheme from WR-01.

### IN-03: `streamingReasoningDurationMs` signal declared but never set meaningfully

**File:** `apps/frontend/src/app/chat/chat.ts:100, 776`
**Issue:** `streamingReasoningDurationMs` is only ever `set(undefined)` in
`clearStreaming` and never assigned a real value; the `done` handler passes
`event.reasoningDurationMs` directly to `commitTurn`. The signal is effectively
dead. (Pre-existing, outside the arena feature, but in a reviewed file.)
**Fix:** Remove the unused signal or populate it during streaming.

### IN-04: `DatabaseModule.onModuleDestroy` is an empty no-op — pool is never closed

**File:** `apps/backend/src/app/database/database.module.ts` (referenced by `app.module.ts`)
**Issue:** `onModuleDestroy` is implemented but does nothing (comment says cleanup
"happens via the provider's lifecycle," which is not actually wired). The `pg`
`Pool` is never `end()`-ed on shutdown, leaking connections across hot reloads /
graceful shutdowns. Pre-existing infra, surfaced because `app.module.ts` is in
scope.
**Fix:** Inject the connection token and call `pool?.end()` in `onModuleDestroy`.

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
