---
phase: 41-autonomous-dino-minds
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - apps/backend/src/app/agents/group-agents.service.spec.ts
  - apps/backend/src/app/agents/group-agents.service.ts
  - apps/backend/src/app/agents/group/decision.spec.ts
  - apps/backend/src/app/agents/group/decision.ts
  - apps/backend/src/app/agents/group/governor.spec.ts
  - apps/backend/src/app/agents/group/governor.ts
  - apps/frontend/src/app/chat/groupchat.service.spec.ts
  - libs/shared-types/src/lib/group.types.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Group Engine v3 removes the central director and gives every participant dino an autonomous answer/react/silent decision on its own model. The pure-function layer (`decision.ts`, `governor.ts`) is well-factored, side-channel failures degrade to heuristic/silent per the project rule, and `process.env['VAR']` / `Logger` / no-`any` conventions are followed. No security vulnerabilities and no data-loss risks were found.

The defects are correctness/robustness issues centered on a single substantive bug: the `hasPriorDinoThisRound` flag is computed against the **entire** transcript (including persisted prior-turn history), not against the current round, so its name, the prompt text it drives, and the heuristic stance it produces are all wrong on any turn after the first. The remaining warnings concern the answer-cap react fallback, mention matching, and a couple of comment/contract drifts.

## Warnings

### WR-01: `hasPriorDinoThisRound` is computed over the whole transcript, not the current round

**File:** `apps/backend/src/app/agents/group-agents.service.ts:258`
**Issue:** The flag is computed as `state.transcript.some((m) => m.role === 'dino')`. The transcript is seeded with `initConversationState(history ?? [], ...)` (line 218), so it contains dino messages from **all prior user turns**. On the second and later user turns, `hasPriorDinoThisRound` is `true` for the very first dino in round 0 even though no dino has spoken *this round*. This propagates three ways:
- `buildDecisionPrompt(..., hasPriorDinoThisRound)` then tells the dino "At least one dino has already spoken this round" (decision.ts:116-118) when none has — a factually wrong prompt that biases the model toward react/reply stances.
- `heuristicDecision(profile, hasPriorDinoThisRound)` picks a targeted stance (`disagree_with_agent` / `build_on_agent`) for the first speaker of the turn (decision.ts:207-219) — a reply-to-nobody.
- The answer-cap fallback (line 281) uses it to choose `react` vs `silent`.

The unit tests only exercise the first turn (empty history), so the bug is invisible to the suite. The variable name explicitly claims "this round," making this a logic error, not just naming.

**Fix:** Track round-local dino activity. For example, compute it from the count of dino turns produced since the round started, not from the full transcript:
```ts
// before the dino loop:
const dinoTurnsBeforeRound = state.transcript.filter((m) => m.role === 'dino').length;
// inside the loop:
const hasPriorDinoThisRound =
  state.transcript.filter((m) => m.role === 'dino').length > dinoTurnsBeforeRound;
```
or simpler, `const hasPriorDinoThisRound = answersThisRound > 0;` (a reaction does not push to transcript, so answersThisRound is the in-round dino-speech signal the prompt actually means).

### WR-02: Answer-cap fallback can emit a `react` to a dino's own just-finished message

**File:** `apps/backend/src/app/agents/group-agents.service.ts:280-284`
**Issue:** When a dino hits `dinoAtAnswerCap`, its `answer` is downgraded to `react` pinned to `this.lastMessageId(state)`. Because answers are pushed to the transcript as they complete (line 361), the last message at this point may be **this same dino's** previous answer in an earlier round, producing a dino reacting to itself. The condition guarding the downgrade (`hasPriorDinoThisRound`) does not exclude the dino's own messages. Combined with WR-01, the targeting is unreliable.
**Fix:** Pin the fallback reaction to the most recent message authored by *another* speaker, or fall through to `silent` when the only recent turns are the dino's own:
```ts
const lastOther = [...state.transcript].reverse().find(
  (m) => !(m.role === 'dino' && m.dinoId === dino.id),
);
decision = lastOther
  ? { action: 'react', emoji: '👍', replyToMessageId: lastOther.id }
  : { action: 'silent' };
```

### WR-03: `@mention` matching uses an unescaped dino name inside a `RegExp`

**File:** `apps/backend/src/app/agents/group-agents.service.ts:134`
**Issue:** `new RegExp(`@${dino.name}\\b`, 'i')` interpolates the dino's display name directly into a regex. Any dino whose name contains regex metacharacters (`.`, `(`, `+`, `?`, `[`, etc.) will either match incorrectly or throw `SyntaxError` from the `RegExp` constructor — and that throw is **not** caught here, so a single bad name would break mention parsing for the whole turn (it runs before the try/catch decision loop). Also, `\b` after a name ending in a non-word character (e.g. `T-Rex` or a name ending in `!`) will not behave as intended.
**Fix:** Escape the name before building the pattern:
```ts
const escaped = dino.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`@${escaped}(?:\\b|$)`, 'i');
```

### WR-04: Empty-response answers silently consume a round slot without counting

**File:** `apps/backend/src/app/agents/group-agents.service.ts:343-347`
**Issue:** When a streamed answer produces empty text it is treated as a silent pass (`continue`) and `answersThisRound` is **not** incremented and `recordAnswer` is **not** called. That is correct for the caps, but it means a dino that consistently returns empty strings (e.g. a flaky free model echoing nothing) costs a full generation call every round, up to `MAX_ROUNDS`, with no progress and no answer recorded — the zero-answer early-stop (`shouldStopRounds`) only triggers if *every* dino in the round is empty/silent. This is a robustness gap rather than a hard bug, but it lets a degenerate model burn the full per-dino generation budget invisibly.
**Fix:** Log the empty-response case via the injected `Logger` so it is observable, and consider counting an empty answer toward `dinoAtAnswerCap` so a repeatedly-empty dino is throttled out of later rounds.

### WR-05: `confidence` clamp default of 0.6 silently rewrites caller intent

**File:** `apps/backend/src/app/agents/group/decision.ts:59-62`
**Issue:** `clamp01` returns `0.6` for any non-finite input (`NaN`, `Infinity`). In `heuristicDecision` (line 202) it is called on `profile.confidence`, and in `parseDecision` it is only reached when the value is already a `number`. A `number` can still be `NaN`/`Infinity` (e.g. model emits `{"confidence": NaN}` after a tolerant parse path, or a profile is misconfigured), in which case a meaningless 0.6 confidence is fabricated and surfaced to the UI as if the dino self-reported it. A clamp that invents a non-zero default is surprising for a function named `clamp01`.
**Fix:** Return a neutral/explicit value for non-finite input and let the caller decide, or document that 0.6 is the deliberate "unknown confidence" sentinel. At minimum, keep the sentinel out of `parseDecision`'s output for genuinely invalid model input (prefer `undefined`).

### WR-06: Spec asserts a cap bound that does not match the documented worst case

**File:** `apps/backend/src/app/agents/group-agents.service.spec.ts:256-257`
**Issue:** The test asserts `decideAction.mock.calls.length <= 4 * MAX_ROUNDS` (12) and comments "decideAction runs at most MAX_GROUP_DINOS (4) × MAX_ROUNDS." With all-answer decisions the run actually stops at `MAX_TOTAL_ANSWERS = 8` (4 in round 0 + 4 in round 1, then `atTotalAnswerCap` returns before any round-2 decision), so the real count is 8, never approaching 12. The assertion passes but does not actually pin the decision-call ceiling it claims to, so a regression that let decisions run an extra round (up to 12) would slip through silently. The test gives false confidence about the cost ceiling — Success Criterion #4.
**Fix:** Add a case that isolates the decision-call ceiling (e.g. all dinos `silent` so no answers cap the loop, asserting decisions stop at the round cap), and tighten this assertion to the true bound for the all-answer scenario.

## Info

### IN-01: `decideAction` instantiates `ChatOpenAI` per call

**File:** `apps/backend/src/app/agents/group-agents.service.ts:160-164`
**Issue:** A new `ChatOpenAI` client is constructed for every decision call (up to 12 per turn). Not a correctness issue, but it duplicates config and ignores any shared client construction used elsewhere. Consider a small factory/cache keyed by model.

### IN-02: Missing `OPENROUTER_API_KEY` is not validated

**File:** `apps/backend/src/app/agents/group-agents.service.ts:162`
**Issue:** If `process.env['OPENROUTER_API_KEY']` is undefined, every decision call fails and silently degrades to heuristic (per the side-channel rule, which is fine) — but there is no startup-time or first-use warning, so a misconfigured deploy looks like "all dinos are acting heuristically" with no signal. Consider logging once when the key is absent.

### IN-03: `confidence: 0` on garbage parse is indistinguishable from a real low-confidence silent

**File:** `apps/backend/src/app/agents/group/decision.ts:152`
**Issue:** A garbage/unparseable decision returns `{ action: 'silent', confidence: 0 }`. Downstream, `confidence: 0` is a legitimate value, so consumers cannot tell "model failed to produce JSON" from "model deliberately reported zero confidence." Prefer omitting `confidence` (leave `undefined`) on the failure path.

### IN-04: Deprecated `DinoTurnDecision` / `GroupOrchestratorPlan` retained only for an empty event

**File:** `libs/shared-types/src/lib/group.types.ts:20-47`
**Issue:** The engine always emits `plan: { round1: [], round2: [] }` (service line 231) and the frontend `applyEvent` `plan` branch returns early when `answerers.length === 0` (groupchat.service.ts:281), so these types exist solely to type an always-empty payload. The frontend spec at lines 47-84/107-118 still feeds **non-empty** plans through `applyEvent`, testing a code path the v3 backend can no longer produce. Not a bug, but dead-shaped contract surface that will mislead future readers; consider collapsing `GroupPlanEvent` to a marker once the legacy slot-layout path is confirmed unreachable.

### IN-05: Comment claims `GroupReaction` "(D-06)" carries a target but the type has none

**File:** `libs/shared-types/src/lib/group.types.ts:75-79`
**Issue:** `GroupReaction` is documented as "pinned to a target message (D-06)" but the interface has only `dinoId` and `emoji` — the target lives on `GroupReactionEvent.targetMessageId` instead. The comment is misleading. Tighten the doc to say the pin target is carried by the event, not the reaction record.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
