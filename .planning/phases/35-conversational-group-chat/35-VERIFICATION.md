---
phase: 35-conversational-group-chat
verified: 2026-06-07T14:00:00Z
status: human_needed
score: 4/4 must-haves verified (code-complete); 2 live UATs pending human execution
overrides_applied: 0
re_verification:
  previous_status: null
  note: "Initial verification. Code review 35-REVIEW.md (CR-01, CR-02) fixed in commit 940bd36; fixes re-verified in source here."
human_verification:
  - test: "35-02 Task 7 — turn-based conversation live UAT: select 2-4 dinos, send a message, then @mention a specific dino on a follow-up, observe a Round-2 dino volunteer a dissent."
    expected: "Round-1 answerers stream concurrently top-to-bottom in plan order; an @mentioned dino always replies; at least sometimes a non-addressed dino volunteers in Round 2 naming who it responds to; emoji reaction chips pin to their target message."
    why_human: "Requires a live OpenRouter orchestrator call + token streaming over SSE; concurrency timing, orchestrator participation quality, and the streaming UX cannot be verified by static analysis."
  - test: "35-03 Task 6 — persist/reopen live UAT: complete a group conversation, navigate away, reopen the group thread from the history panel."
    expected: "The completed group thread appears in the history panel with the group indicator; reopening restores the full interleaved transcript top-to-bottom AND the exact participant dino selection, switching the view to groupchat."
    why_human: "Requires a real completed turn persisting to localStorage and a full reopen round-trip in the running app; localStorage state + view switching cannot be exercised statically (frontend Vitest runner is broken in this environment)."
---

# Phase 35: Conversational Group Chat Verification Report

**Phase Goal:** Replace the parallel fan-out with a turn-based, real-chat group conversation where each dino decides whether and how to participate.
**Verified:** 2026-06-07
**Status:** human_needed (code-complete; 2 live UATs pending)
**Re-verification:** No — initial verification (code review CR-01/CR-02 fixes re-verified in source)

## Goal Achievement

### Observable Truths (the 4 ROADMAP Success Criteria = GRP2-01..04)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 (GRP2-01) | Each selected dino independently answers / emoji-reacts / stays silent — a prompt may yield several replies, one, a reply + reaction, or none | ✓ VERIFIED | Orchestrator returns per-dino `action: answer\|react\|silent` (`group.types.ts:10-22`). Only `answer` dinos call `streamAgent`; `react` emits a no-LLM `reaction` event (`group-agents.service.ts:351-360`); `silent` dinos produce nothing. `parseOrchestratorPlan` clamps + falls back to all-answer (`:85-109`). |
| 2 (GRP2-02) | @mention forces that dino to respond; a non-addressed competent dino may volunteer | ✓ VERIFIED (code) | `parseMentions` matches names case-insensitively (`:163-170`); `applyMentionForcing` overrides forced dinos to `answer` and appends absent ones (`:248-264`), applied in `streamGroup` regardless of orchestrator output (`:333-337`). Orchestrator prompt strongly favors Round-2 volunteering with `respondingTo` (`:209`). Frontend autocomplete: `mentionOpen`/`mentionCandidates`/`applyMention` (`chat.ts:153-156,447-452`) + dropdown (`chat.html:185-204`). *Volunteer-dissent quality needs live UAT.* |
| 3 (GRP2-03) | Dinos respond to each other (bounded inter-dino), thread reads top-to-bottom with per-dino attribution | ✓ VERIFIED | Round 1 concurrent multiplex via `runConcurrentStream` (`:438-497`); Round 2 sequential so repliers see Round-1 answers (`:391-424`), clamped to `MAX_INTER_DINO_REPLIES=2` (`:394-396`). Attributed history via `buildAttributedHistory` (`:118-140`). Frontend renders one interleaved transcript top-to-bottom with mascot+name via `app-group-response` (`chat.html:149-180`). |
| 4 (GRP2-04) | Group conversations saved in history panel and reopen with full transcript | ✓ VERIFIED (code) | `toSession()` builds an `isGroup` `ConversationSession` with roster (`groupchat.service.ts:128-141`); persisted on falling edge of streaming (`chat.ts:200-207,371-382`). Reopen branches on `session.isGroup` → `loadGroupSession` restoring messages + roster + view (`chat.ts:391-408`). Panel group indicator at `history-panel.html:312`. Types extended: `ChatMessage.dinoId/reactions`, `ConversationSession.isGroup/participantDinoIds`. *Round-trip needs live UAT.* |

**Score:** 4/4 truths verified at the code level. #2 and #4 carry live-UAT items for behavioral confirmation.

### Critical-Defect Fix Verification (from 35-REVIEW.md, fixed in 940bd36)

| Defect | Status | Evidence |
| ------ | ------ | -------- |
| CR-01: Round-1 buffered, not streamed | ✓ FIXED | `runConcurrent` replaced by `runConcurrentStream` (`group-agents.service.ts:438-497`) — a true async-generator multiplexer: one in-flight `next()` promise per generator, `Promise.race` yields each `dino_token`/`dino_done` the moment it arrives (`:467-486`). `streamGroup` consumes via `yield* this.runConcurrentStream(...)` (`:367`). Answers folded into transcript in PLAN order, not completion order (`:379-389`) — also closes WR-07 ordering. Pending generators `return()`ed on abort (`:490-494`) — also addresses WR-01 for Round 1. |
| CR-02: stream without group_done left rows stuck 'streaming' → blank persisted | ✓ FIXED | `consume()`'s `finally` calls `settleOpenSlots()` (`groupchat.service.ts:232-242`); streaming rows with partial text → `done`, empty → `error` (`:250-262`), preventing blank `done` bubbles in persistence. Partially mitigates WR-05 (empty rows no longer persist as blank done). |

### Regression Check (single-dino chat / Arena untouched)

| Area | Status | Evidence |
| ---- | ------ | -------- |
| `agents.service.ts` (single-dino loop) | ✓ UNCHANGED | Last commit touching it is `fdfd10d` (Phase 33); no Phase 35 commit modifies it. Group answerers reuse `streamAgent` verbatim (`group-agents.service.ts:283-293`). |
| `ChatService.streamMessage` | ✓ UNCHANGED | 35-02 commit `e7f2dde` is additive (+83/-1); `streamGroup` added alongside, `streamMessage` signature/body intact (`chat.service.ts:62`). |
| Arena | ✓ UNCHANGED | No Arena files in any Phase 35 commit; ArenaService warning in test run is pre-existing DB-unavailable behavior, not a regression. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `libs/shared-types/src/lib/group.types.ts` | Group contracts | ✓ VERIFIED | All exports present (DinoTurnDecision, GroupOrchestratorPlan, GroupReaction, GroupMessage, GroupChatRequest, GroupStreamEvent union). |
| `apps/backend/src/app/agents/group-agents.service.ts` | Turn-based engine | ✓ VERIFIED | Orchestrator + concurrent R1 + sequential R2 + mention forcing + attributed history. Cost ceiling documented (`:15-27`, 1+4+2=7). |
| `apps/backend/src/app/agents/group-agents.controller.ts` | SSE endpoint | ✓ VERIFIED | POST /api/agents/group, HTTP-only, abort on req close (`:29-31`), wired in `agents.module.ts:11-12`. |
| `apps/frontend/src/app/chat/chat.service.ts` (`streamGroup`) | SSE consume | ✓ VERIFIED | fetch + `\n\n` frame parse yielding GroupStreamEvent (`:143-210`). |
| `apps/frontend/src/app/chat/groupchat.service.ts` | Turn-based client | ✓ VERIFIED | Ordered `messages` signal, send/stopAll, reaction chips, persist/reopen, settleOpenSlots. Old fan-out (`DinoStreamEntry[]`, per-dino threads) removed — no fallback. |
| `libs/ui/src/lib/group-response/group-response.ts` | Attributed row | ✓ VERIFIED (with caveat) | Renders mascot+name+body+status+reactions. `respondingToName` input EXISTS but is not bound in chat.html (WR-03, below). |
| `libs/shared-types/src/lib/chat.types.ts` | +dinoId/+reactions/+isGroup/+participantDinoIds | ✓ VERIFIED | Consumed by toSession/loadSession round-trip. |
| `libs/ui/src/lib/history-panel/history-panel.ts/.html` | Group indicator | ✓ VERIFIED | `@if (session.isGroup)` indicator (`history-panel.html:312`). |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| GroupAgentsController POST /agents/group | GroupAgentsService.streamGroup | SSE write loop, abort on close | ✓ WIRED (`controller:39-50`) |
| streamGroup answerers | AgentsService.streamAgent | injected service, attributed history, re-tag dinoId | ✓ WIRED (`service:283-293`) |
| GroupAgentsService orchestrator | ChatOpenAI(OpenRouter) gpt-4o-mini | structured-JSON call + parseOrchestratorPlan | ✓ WIRED (`service:228-235`) |
| ChatComponent.onGroupSend | GroupchatService.send | composer (send) event | ✓ WIRED (`chat.html:212`, `chat.ts:357-361`) |
| GroupchatService.send | ChatService.streamGroup → POST | GroupChatRequest over SSE | ✓ WIRED (`groupchat.service.ts:113,220`) |
| chat.html transcript | app-group-response | @for over messages() with [reactions] | ✓ WIRED — but `[respondingToName]` NOT bound (WR-03) |
| GroupchatService on completion | HistoryService upsert (via store) | toSession() ConversationSession | ✓ WIRED (`chat.ts:371-382`) |
| sessionSelected handler | loadSession + setActiveView('groupchat') | branch on session.isGroup | ✓ WIRED (`chat.ts:391-408`) |

### Behavioral / Compile Gates

| Gate | Command | Result | Status |
| ---- | ------- | ------ | ------ |
| Backend test suite | `node apps/backend/vitest.run.mjs` | 11 files, 115/115 pass | ✓ PASS |
| Frontend compile | `npx nx build frontend` | Success (benign prismjs CommonJS warnings only) | ✓ PASS |
| Frontend lint | `npx nx lint frontend` | 0 errors, 1 warning | ✓ PASS |
| Backend lint | `npx nx lint backend` | 0 errors, 1 warning | ✓ PASS |
| Frontend unit tests | `npx nx test frontend` | Bundle-gen crash (`Cannot destructure property 'pos'`) | ? SKIP — pre-existing environment bug (deferred-items.md), specs authored + type-sound (293+207 lines), verified by reading |

### Known Limitations (open code-review warnings — NOT phase blockers)

| ID | Limitation | Impact | Defeats a success criterion? |
| -- | ---------- | ------ | ---------------------------- |
| WR-03 | `respondingTo` plumbed in types + GroupResponse `respondingToName` input + orchestrator prompt, but never carried on the stream events nor bound in chat.html (`chat.html:170-176` omits `[respondingToName]`) → the "↳ replying to {name}" affordance is dead end-to-end. | Cosmetic: a Round-2 reply still renders with full mascot+name attribution; only the explicit "replying to X" label is absent. | No — SC#2/#3 attribution is satisfied by mascot+name. |
| WR-04 | Transport-level `dino_error` with empty `dinoId` is discarded (`groupchat.service.ts:369`) → a network failure / 500 / dropped connection shows no user-visible row or toast; the spinner just stops. | UX gap: user cannot distinguish "all silent" from "request failed." | No — does not defeat any of the 4 criteria; happy path unaffected. |
| WR-06 | `parseMentions` interpolates unescaped dino names into a `RegExp` (`group-agents.service.ts:166`). | Latent: names are registry-controlled today; an adversarial future name with regex metachars could mis-match or backtrack. | No — current registry names are safe. |
| WR-02 | Shared mutable `transcript` is safe today (Round 2 sequential) but becomes a hazard if Round 1 interleaving mutates it; flagged for future. | None today. | No. |
| WR-05 | `groupMessageToChatMessage` maps any dino row to assistant; partial CR-02 mitigation reduces blank persistence but does not skip empty rows on save. | Minor: an errored row could still persist if not settled. | No. |
| WR-07 (ordering) | Closed by the CR-01 fix (answers folded in plan order). messageId fallback still uses Date.now without random suffix in the runConcurrentStream return path (`:478` adds suffix; collision risk low). | Negligible. | No. |
| IN-01..05 | Dead `tag` param removed in rewrite (IN-01 n/a now); silent dropped-react logging (IN-02), multi-codepoint emoji split (IN-03), getter perf (IN-04), stories argTypes (IN-05). | Maintainability / minor. | No. |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| GRP2-01 | 35-01, 35-02 | ✓ SATISFIED (code) | Truth #1 |
| GRP2-02 | 35-01, 35-02 | ✓ SATISFIED (code; volunteer quality → UAT) | Truth #2 |
| GRP2-03 | 35-01, 35-02 | ✓ SATISFIED | Truth #3 |
| GRP2-04 | 35-03 | ✓ SATISFIED (code; round-trip → UAT) | Truth #4 |

No orphaned requirements: GRP2-01..04 are all claimed across the three plans and defined inline in ROADMAP (not REQUIREMENTS.md, as noted in CONTEXT).

### Gaps Summary

No goal-blocking gaps. All 4 success criteria are achieved in source, the two critical code-review defects (CR-01 live multiplexing, CR-02 stale-row settle) are fixed and re-verified in commit 940bd36, and single-dino chat / Arena are confirmed untouched. Backend tests (115/115), frontend build, and both lint targets are green.

The phase is **code-complete** but cannot be marked fully verified until the two autonomous:false live UATs run (turn-based conversation behavior; persist/reopen round-trip) — these exercise live LLM orchestration, concurrent SSE streaming, and localStorage round-tripping that static analysis and the (environment-broken) frontend test runner cannot confirm. Open warnings (notably WR-03's dead "replying to" affordance and WR-04's silent transport errors) are recorded as known limitations and do not defeat any success criterion.

---

_Verified: 2026-06-07_
_Verifier: Claude (gsd-verifier)_
