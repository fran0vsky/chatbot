---
phase: 35-conversational-group-chat
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - libs/shared-types/src/lib/group.types.ts
  - libs/shared-types/src/index.ts
  - libs/shared-types/src/lib/chat.types.ts
  - apps/backend/src/app/agents/group-agents.service.ts
  - apps/backend/src/app/agents/group-agents.controller.ts
  - apps/backend/src/app/agents/agents.module.ts
  - apps/backend/src/app/agents/group-agents.service.spec.ts
  - apps/frontend/src/app/chat/chat.service.ts
  - apps/frontend/src/app/chat/groupchat.service.ts
  - apps/frontend/src/app/chat/groupchat.service.spec.ts
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/chat/chat.html
  - libs/ui/src/lib/group-response/group-response.ts
  - libs/ui/src/lib/group-response/group-response.html
  - libs/ui/src/lib/group-response/group-response.stories.ts
  - libs/ui/src/lib/history-panel/history-panel.ts
  - libs/ui/src/lib/history-panel/history-panel.html
  - libs/ui/src/lib/history-panel/history-panel.stories.ts
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 35 implements turn-based conversational group chat: a backend orchestrator
(plan call, concurrent Round 1, sequential Round 2, @mention forcing, defensive
plan parsing) over SSE, and a frontend `GroupchatService` consuming the
multiplexed stream with persistence round-trip.

The defensive parsing, cost-ceiling clamps, and persistence mapping are largely
solid and well-tested. However, two correctness defects undermine the central
promise of the feature: **Round-1 streaming is fully buffered before any event
reaches the client** (defeating the "concurrent live multiplexing" the whole
design is built around), and the **frontend abort path leaves stale streaming
state** under stream-read failures. Several robustness gaps (per-answerer abort
not propagated, `respondingTo` never plumbed to the UI, transcript-mutation
during concurrency, error-row attribution) round out the findings.

## Critical Issues

### CR-01: Round-1 events are fully buffered, not streamed — live multiplexing is defeated

**File:** `apps/backend/src/app/agents/group-agents.service.ts:367-378`, `435-467`
**Issue:** `streamGroup` does `const round1Results = await this.runConcurrent(...)`
and only *after* the `await` resolves does it `for (const event of round1Results.events) yield event`.
`runConcurrent` itself `await Promise.all(...)` over every answerer's generator,
**collecting all `dino_token`/`dino_done` events into an in-memory array** and
returning only when the slowest answerer has finished. No event is yielded to the
controller (and thus to the SSE client) until *every* Round-1 answerer completes.

The result: the user sees nothing during Round 1, then all dinos' full answers
appear at once. This is the opposite of the documented behavior ("Round 1
answerers run CONCURRENTLY, events multiplexed (D-03)" / "renders strictly in
plan order via the dino-tagged events"). Concurrency still saves wall-clock time
vs. sequential, but the streaming UX — the entire reason for the token-level
`dino_token` protocol and the frontend placeholder/`appendToken` machinery — is
lost. The `findOpenSlot`/`appendToken` token-accumulation code on the frontend
becomes dead in practice because tokens arrive only as a final lump preceding
`dino_done`.
**Fix:** Multiplex live instead of buffering. Drain the concurrent generators
through a shared queue and yield as events arrive, e.g.:
```ts
// Pseudocode: race generators, yield each event the moment it is produced.
private async *runConcurrentLive(decisions, ...): AsyncGenerator<GroupStreamEvent, Answer[]> {
  const answers: Answer[] = [];
  const pending = new Map<number, Promise<...>>();
  const gens = decisions.map((d) => this.runAnswerer(d, ...));
  // For each gen, kick off next(); on resolution yield the value and re-arm next().
  // Collect the generator return value into `answers` when a gen reports done.
  // ...standard async-generator merge...
}
```
Then in `streamGroup`: `const answers = yield* this.runConcurrentLive(...)`.

### CR-02: Frontend leaves `streaming` stuck `true` and state stale when the stream read throws

**File:** `apps/frontend/src/app/chat/groupchat.service.ts:213-239`, `281-284`
**Issue:** `consume()` clears `_streaming` in its `finally` block **only if
`this.controller?.signal === signal`**. But `streamGroup` (chat.service) swallows
read errors by yielding a `dino_error` frame and *returning normally* in most
paths — except when `signal.aborted` is true mid-read, where it `return`s with no
terminal event. More importantly, `_streaming` is also set to `false` inside
`applyEvent` on `group_done` (line 282). If the backend stream ends WITHOUT a
`group_done` (e.g. the server crashes mid-turn, the connection drops, or any path
where the controller errors before emitting `group_done`), the `finally` guard
*does* run and clears streaming — good. However, the persist effect in
`chat.ts:200-207` fires on the **falling edge of `groupchatStreaming`**. Because
`group_done` flips streaming to false *inside* the event loop while `consume`'s
`finally` will flip it again, and because a missing `group_done` is a real
failure mode (CR-01 buffering raises the odds of mid-turn aborts), the transcript
can be persisted with placeholder rows still in `status: 'streaming'`. Those
rows then round-trip through `groupMessageToChatMessage` (which drops `status`)
and reload as `status: 'done'` with empty `text`, silently saving blank dino
answers into history.
**Fix:** Make `group_done` and the `finally` path converge on a single
settle routine that (a) marks any lingering `status === 'streaming'` rows as
`error`, and (b) only persists after the transcript is settled. Guard
`persistGroupSession` against transcripts containing streaming/empty dino rows:
```ts
private settle(): void {
  this._messages.update((list) =>
    list.map((m) =>
      m.role === 'dino' && m.status === 'streaming'
        ? { ...m, status: 'error', error: 'Interrupted.' }
        : m,
    ),
  );
  this._streaming.set(false);
}
```

## Warnings

### WR-01: `signal` is never forwarded to `streamAgent`, so per-answerer aborts do not cancel in-flight LLM calls

**File:** `apps/backend/src/app/agents/group-agents.service.ts:283-293`
**Issue:** `runAnswerer` accepts `signal` but the `streamAgent(...)` call passes
`signal` in position 4 — good — yet `runConcurrent` (line 447-464) `await`s
`Promise.all` over every answerer and **never checks `signal.aborted`** while
draining. When the client disconnects (`req.on('close')` → `controller.abort()`),
the controller loop stops yielding, but every concurrent `streamAgent` generator
keeps being pulled (`while (!next.done) ... await gen.next()`) until it naturally
finishes, because nothing inside the drain loop breaks on abort. The cost ceiling
still holds, but aborted turns keep burning the full set of LLM calls server-side.
**Fix:** In `runConcurrent`'s per-answerer loop, `if (signal.aborted) { await gen.return?.(); break; }` between pulls, and verify `streamAgent` actually honors the
forwarded `AbortSignal`.

### WR-02: Transcript array is read concurrently while Round-2 mutates it; Round-1 answerers share a pre-user-message transcript inconsistently

**File:** `apps/backend/src/app/agents/group-agents.service.ts:326-348`, `362-389`
**Issue:** The user message is pushed to `transcript` at line 343 *after* the plan
event but *before* Round 1. `runConcurrent` passes the same `transcript` reference
into every `runAnswerer`, which calls `buildAttributedHistory(transcript, ...)`
synchronously at generator construction (line 280) — so Round 1 is consistent.
But Round 2 (line 417) pushes into the *same* array that Round-1 answer objects
were derived from, and `buildAttributedHistory` is recomputed per Round-2 answerer
against the now-mutated array. This is correct only because Round 2 is sequential;
if CR-01 is fixed by interleaving, the shared mutable `transcript` becomes a real
hazard. Flagging now because the fix for CR-01 will expose it.
**Fix:** Snapshot the transcript (`[...transcript]`) at the point each answerer's
history is built, and append Round-1 results to a fresh array before Round 2.

### WR-03: `respondingTo` is parsed, typed, and stored but never surfaced to the user

**File:** `apps/backend/src/app/agents/group-agents.service.ts:74`; `apps/frontend/src/app/chat/chat.html:170-176`; `libs/ui/src/lib/group-response/group-response.ts:38`
**Issue:** The backend coerces `respondingTo` onto each decision and the
orchestrator prompt strongly pushes Round-2 dinos to set it (D-05). `GroupResponse`
exposes a `respondingToName` input and renders a "↳ replying to {name}" affordance.
But `GroupReactionEvent`/`GroupDinoDoneEvent` never carry `respondingTo`, the
frontend never stores it on `GroupViewMessage`, and `chat.html` never binds
`[respondingToName]`. The entire D-05 "replying to" feature is dead end-to-end —
the component input and stories exist but nothing drives them in the app.
**Fix:** Add `respondingTo?: string` to `GroupDinoDoneEvent` (and emit it from
`runAnswerer`), store it on the view message, resolve it to a name in `chat.html`
via `groupDinoById(msg.respondingTo)?.name`, and bind `[respondingToName]`.

### WR-04: Transport-level errors render no user-visible feedback in group mode

**File:** `apps/frontend/src/app/chat/chat.service.ts:167,173,208`; `apps/frontend/src/app/chat/groupchat.service.ts:342-364`
**Issue:** On fetch failure / non-OK response / read error, `streamGroup` yields
`{ type: 'dino_error', dinoId: '', message }`. `markDinoError` explicitly drops
these: `if (dinoId.length === 0) return list; // transport-level error, no slot`.
So a network failure, a 500, or a dropped connection produces **no visible row,
no toast, nothing** — the spinner just stops (and only if `group_done` or the
`finally` clears it). The user cannot distinguish "all dinos stayed silent" from
"the request failed."
**Fix:** Surface transport errors as a dedicated banner/row in the group view
(a synthetic system message or an error state on the transcript), rather than
silently discarding the only signal the user gets.

### WR-05: Persisted blank/streaming dino rows round-trip as empty "done" messages

**File:** `apps/frontend/src/app/chat/groupchat.service.ts:170-179`; `chat.ts:371-384`
**Issue:** `groupMessageToChatMessage` maps any `role: 'dino'` row to an
`assistant` ChatMessage regardless of `status`. A placeholder created by the
`plan` event that never received tokens (answerer errored, or turn aborted) has
`text: ''` and `status: 'streaming'`/`'error'`. Persistence drops `status`, so on
reload `chatMessageToGroupMessage` resurrects it as `status: 'done'` with empty
text — a blank dino bubble permanently saved. Combined with CR-02, interrupted
turns pollute history.
**Fix:** In `groupMessageToChatMessage` / `persistGroupSession`, skip dino rows
whose `status !== 'done'` or whose `text.trim()` is empty.

### WR-06: `parseMentions` builds a `RegExp` from unescaped dino names (ReDoS / wrong-match risk)

**File:** `apps/backend/src/app/agents/group-agents.service.ts:163-170`
**Issue:** `new RegExp(\`@${dino.name}\\b\`, 'i')` interpolates the dino name
directly into a regex. Dino names are currently registry-controlled, but this is a
latent injection: a name containing regex metacharacters (`.`, `+`, `(`, `[`,
`?`) would mis-match or, with an adversarial future name, enable catastrophic
backtracking against attacker-supplied `message`. Also `\b` after a name ending in
a non-word char (e.g. punctuation/emoji) silently never matches.
**Fix:** Escape the name before interpolation:
```ts
const safe = dino.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`@${safe}(?:\\b|$)`, 'i');
```

### WR-07: `answers` ordering and fallback `messageId` are non-deterministic / collidable

**File:** `apps/backend/src/app/agents/group-agents.service.ts:447-466`, `461`
**Issue:** `runConcurrent` pushes into `answers` in *completion* order (whoever's
`Promise.all` task resolves first), not plan order, then `streamGroup` appends
them to the transcript in that arbitrary order — so the Round-2 history a replier
sees has Round-1 answers in a non-deterministic sequence. Separately, the fallback
messageId `\`${decision.dinoId}-${Date.now()}\`` (line 461, used when no
`dino_done` arrived) omits the random suffix used everywhere else and can collide
for the same dino within a millisecond, and points reactions at the wrong row.
**Fix:** Sort `answers` by the answerer's plan `order` before appending to the
transcript; always generate ids with the random-suffix helper, factored into one
function.

## Info

### IN-01: `tag` parameter in `runConcurrent` is dead — it is always the identity function

**File:** `apps/backend/src/app/agents/group-agents.service.ts:374`, `442`, `453`
**Issue:** `runConcurrent` takes a `tag: (event) => event` callback that is only
ever called with the identity passed from `streamGroup` (`(event) => event`).
`runAnswerer` already tags events with `dinoId`. Dead abstraction.
**Fix:** Remove the `tag` parameter and its call site.

### IN-02: `react`/`silent` decisions in Round 1 with `action !== 'react'` and stray emojis are silently ignored without logging

**File:** `apps/backend/src/app/agents/group-agents.service.ts:350-360`
**Issue:** Only `action === 'react' && emoji` produces output in Round 1's
pre-emit loop; `silent` is correctly dropped, but a `react` decision whose emoji
was stripped (coerced away) vanishes with no trace. Minor observability gap given
the orchestrator output is untrusted.
**Fix:** `this.logger.debug` dropped reactions, or rely on existing coercion tests.

### IN-03: `firstEmoji` uses code-point split, which can split multi-codepoint emoji (ZWJ sequences, flags)

**File:** `apps/backend/src/app/agents/group-agents.service.ts:39-46`
**Issue:** `[...trimmed][0]` takes the first Unicode code point, which breaks
ZWJ-joined emoji (👨‍👩‍👧), flags (regional-indicator pairs), and skin-tone
modifiers — yielding a partial/garbled glyph rather than "a single emoji." The
test only covers `👍🔥` (two separable emoji), masking this.
**Fix:** Use `Intl.Segmenter('und', { granularity: 'grapheme' })` to take the
first grapheme cluster, falling back to the code-point split.

### IN-04: HistoryPanel `groupedSessions` getter recomputes on every change-detection pass

**File:** `libs/ui/src/lib/history-panel/history-panel.ts:55-112`
**Issue:** `groupedSessions` is a template-bound getter doing per-call allocation,
date math, and five sorts. With OnPush this is bounded but still runs on every CD
tick the component participates in. Not a correctness bug (and perf is out of v1
scope), noting only as a maintainability smell — a `computed()` over a `sessions`
signal would memoize it.
**Fix:** Convert to a memoized `computed()` if `sessions` becomes a signal input.

### IN-05: `history-panel.stories.ts` `argTypes.activeView` options omit the new views

**File:** `libs/ui/src/lib/history-panel/history-panel.stories.ts:8-14`
**Issue:** The control lists only `['chats', 'knowledge']` while the component's
`activeView` union now includes `'groupchat' | 'arena' | 'leaderboard'`. The
Storybook control can't exercise the group/arena states it's meant to document.
**Fix:** Extend the options array to the full union.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
