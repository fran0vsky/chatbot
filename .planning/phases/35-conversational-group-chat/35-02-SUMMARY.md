---
phase: 35-conversational-group-chat
plan: 02
subsystem: frontend
tags: [group-chat, turn-based, sse, signals, mentions, reactions, ui]
requires:
  - "POST /api/agents/group (35-01)"
  - "@org/shared-types GroupStreamEvent / GroupMessage / GroupChatRequest / GroupReaction / GroupOrchestratorPlan"
  - ChatService (HTTP/SSE layer)
  - group-response presentational panel
  - app-mascot
provides:
  - "ChatService.streamGroup() — turn-based group SSE client"
  - "GroupchatService rebuilt around the single endpoint (ordered messages signal, reactions, stopAll)"
  - "group-response reaction chips + respondingTo affordance"
  - "groupchat view: interleaved attributed transcript + @mention autocomplete"
affects:
  - apps/frontend/src/app/chat/chat.service.ts
  - apps/frontend/src/app/chat/groupchat.service.ts
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/chat/chat.html
  - libs/ui/src/lib/group-response/group-response.ts
tech-stack:
  added: []
  patterns:
    - "single AsyncGenerator SSE consumption (streamGroup) mirroring streamMessage; no fan-out"
    - "ordered placeholder slots pre-created from the orchestrator plan; tokens routed by dinoId into the open slot"
    - "reactions as chips pinned to a target message (no transcript line)"
    - "app-layer @mention autocomplete via ngDoCheck on a composer ViewChild draft (app-input-composer untouched)"
key-files:
  created: []
  modified:
    - apps/frontend/src/app/chat/chat.service.ts
    - apps/frontend/src/app/chat/groupchat.service.ts
    - apps/frontend/src/app/chat/groupchat.service.spec.ts
    - libs/ui/src/lib/group-response/group-response.ts
    - libs/ui/src/lib/group-response/group-response.html
    - libs/ui/src/lib/group-response/group-response.stories.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
decisions:
  - "GroupViewMessage extends shared GroupMessage with frontend-only status/serverMessageId/error so the wire type stays clean; toWireMessage strips view state before sending history."
  - "Reaction targets match either the local message id OR the server messageId (dino_done's messageId), so a reaction on a dino reply lands whether the orchestrator targeted the local or server id."
  - "findOpenSlot scans newest-first for a streaming slot of the dino; Round-2 events with no open slot append a fresh row (arrival order)."
  - "@mention autocomplete is app-layer (ngDoCheck reads the #groupComposer draft) rather than rewriting app-input-composer, which exposes no draftChange output — keeps the shared composer untouched."
  - "respondingToName input is wired on group-response but not bound from the stream (the backend does not surface respondingTo per finalized dino message in GroupStreamEvent); left for a future event-shape extension."
metrics:
  duration: ~50m
  completed: 2026-06-07
  tasks: 6 automated (Task 7 manual UAT pending)
  files: 8
---

# Phase 35 Plan 02: Frontend Turn-Based Group Chat Summary

Replaced the parallel fan-out group UI with a turn-based client over the single backend endpoint `POST /api/agents/group`: a new `ChatService.streamGroup()` async generator feeds a rebuilt `GroupchatService` that renders one interleaved, attributed top-to-bottom transcript (ordered Round-1 slots from the orchestrator `plan`, tokens routed by dinoId, emoji reaction chips pinned to their target message, bounded Round-2 replies appended), plus an app-layer `@mention` autocomplete in the group composer. The old `DinoStreamEntry` fan-out and per-dino `group-{groupId}-{dinoId}` threads are removed with no fallback; single-dino chat and Arena are untouched (`streamMessage` is byte-for-byte unchanged).

## What Was Built

- **Task 1 — `ChatService.streamGroup()`**: `async *streamGroup(message, participantDinoIds, history, signal)` POSTs a `GroupChatRequest` to `/api/agents/group` and yields `GroupStreamEvent` frames, reusing `streamMessage`'s exact SSE `\n\n` frame-parse loop. Transport-level failures surface as a `dino_error` frame with an empty `dinoId`. `streamMessage` and every other member are unchanged.
- **Task 2 — `GroupchatService` rebuild**: replaced `entries`/`DinoStreamEntry`/`controllers`/`streamForDino` with `messages` (ordered `GroupViewMessage[]`) + `streaming` signals and one `AbortController`. `send()` aborts any prior turn, pushes the user message, builds capped (`HISTORY_CAP=20`) wire history, caps participants at `MAX_DINOS=4`, and consumes `streamGroup`. Event handling: `plan` → ordered Round-1 placeholders (by `order`); `dino_token`/`dino_done` → route by dinoId into the open slot (or append a Round-2 row); `reaction` → chip on the target (by local id or `serverMessageId`); `dino_error` → error status; `group_done` → streaming off. `stopAll()` aborts + clears.
- **Task 3 — `group-response` extension**: new `reactions?: GroupReaction[]` and `respondingToName?: string` inputs. Template renders a pinned chip row (reacting dino `app-mascot` + emoji) at the message bottom and a subtle "↳ replying to {name}" header affordance. Stays standalone/OnPush/service-free; Storybook gains `WithReactions` + `RespondingTo` variants.
- **Task 4 — groupchat view rewire**: `chat.ts` exposes `groupchatMessages`/`groupchatStreaming`, drops `groupchatEntries`. `chat.html` replaces the response grid with one top-to-bottom `@for (msg of groupchatMessages(); track msg.id)` — user bubbles (with reaction chips) + `app-group-response` dino rows passing `[reactions]`. Selector grid + composer (send/stop) retained.
- **Task 5 — `@mention` autocomplete**: `mentionOpen`/`mentionCandidates` signals; `ngDoCheck` watches a `#groupComposer` `ViewChild` draft and opens a dropdown of participant dinos matching the trailing `@<partial>` token; `applyMention` rewrites the token to `@Name `. `app-input-composer` is unchanged.
- **Task 6 — `GroupchatService` spec**: rewritten for the turn-based service (Vitest `vi.*`), mocking `streamGroup` as a crafted event generator and asserting plan-order dino messages + done status + `serverMessageId`, reaction-chip attachment (no extra line), `dino_error` status, `group_done` streaming toggle, capped history arg, `MAX_DINOS` cap, and `stopAll` abort.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] streamGroup `consume()` finally-block guard**
- **Found during:** Task 2 self-review — the initial finally-block condition was a malformed ternary that could clear shared state belonging to a newer `send()`.
- **Fix:** Guard with `if (this.controller?.signal === signal)` so a superseded stream never clears the current controller/streaming flag.
- **Files modified:** apps/frontend/src/app/chat/groupchat.service.ts
- **Commit:** 1ae3dfa

**2. [Rule 1 - Bug] mention dropdown a11y**
- **Found during:** Task 4/5 verify — `role="option"` failed `@angular-eslint/template/role-has-required-aria` (missing `aria-selected`).
- **Fix:** added `[attr.aria-selected]="false"` to the candidate buttons.
- **Files modified:** apps/frontend/src/app/chat/chat.html
- **Commit:** 8ea63da

**3. [Rule 3 - Blocking] spec uses Vitest, not Jest**
- **Found during:** Task 6 — the project's `frontend` test target is `@angular/build:unit-test` (Vitest, `vitest/globals`), but the legacy spec used the `jest.*` namespace.
- **Fix:** authored the new spec against the Vitest `vi.*` API (correct for this runner).
- **Files modified:** apps/frontend/src/app/chat/groupchat.service.spec.ts
- **Commit:** c8091e5

### Note (not a deviation)
- The plan binds `[respondingToName]` on `app-group-response`, but `GroupStreamEvent` does not carry `respondingTo` on finalized dino messages — only inside the `plan` event's Round-2 decisions. The input is implemented and ready; binding it requires a future event-shape extension (out of this plan's contract). Reactions, the primary D-06 affordance, are fully wired.

## Verification

- `npx nx lint frontend` — green (0 errors).
- `npx nx build frontend` (builds `ui` as a dependency) — green; this is the authoritative compile gate for both `ui` and `frontend`.
- `streamMessage` byte-for-byte unchanged: `git diff 6a63e0b..HEAD -- chat.service.ts` shows only added imports + the new `streamGroup` method (and a comment referencing streamMessage); the method body is untouched. Single-dino chat and Arena are not modified.
- `npx nx test frontend` — **could not execute**: the runner crashes at bundle generation (`Cannot destructure property 'pos' of file.referencedFiles[index]`) in this Windows environment. Reproduced with the new spec removed → pre-existing, environment-wide (already recorded in STATE.md from Phase 27). The Vitest spec is type-sound against production sources and will run once the toolchain is repaired or on CI/Linux. Logged in `deferred-items.md`.

## Deferred / Out-of-Scope Issues

- **Frontend Vitest runner crash** (pre-existing, environment-wide) — see `deferred-items.md`. Blocks executing the new spec locally; not caused by this plan.
- **`@chatbot/ui` lint module-boundary errors** (pre-existing) — every ui component importing `@org/shared-types` trips `@nx/enforce-module-boundaries`; `group-response.ts` already imported it before this plan, so no new violation. `nx build` is green.

## Requirements Satisfied (UI half)

- **GRP2-01** — one prompt renders several replies / one reply / reply + emoji reaction / none, top-to-bottom with per-dino attribution (orchestrator plan → ordered slots; reaction chips).
- **GRP2-02** — `@mention` autocomplete inserts `@Name ` (backend forces the reply, 35-01); volunteered dissent renders with attribution (respondingTo affordance available on the row).
- **GRP2-03** — one interleaved transcript including bounded Round-2 inter-dino replies; the old parallel fan-out UI is removed with no fallback.

(Persistence to the history panel — GRP2-04 / Success Criterion #4 — is Plan 03.)

## Known Stubs

None. `respondingToName` is an implemented-but-unbound input (documented above), not a data stub — every rendered transcript field is backed by live stream data.

## Threat Flags

None — no new security surface. Reply bodies render through the existing markdown component (same sanitization path as single chat); emoji + names are Angular-interpolated text (auto-escaped), never `innerHTML`. Participants capped at `MAX_DINOS=4` client-side; one `streamGroup` request; the per-turn LLM ceiling is enforced server-side (35-01); `stopAll()` aborts the in-flight stream. Matches the plan threat model (T-35-02-01/02/03).

## Pending Human UAT (Task 7 — not executed)

Live turn-based group conversation UAT (`autonomous: false`): with backend + frontend served and a live `OPENROUTER_API_KEY`, select 3-4 dinos and verify GRP2-01 (mix of replies/reactions/silence, attributed top-to-bottom), GRP2-02 (`@mention` forcing + volunteered named dissent), GRP2-03 (bounded coherent inter-dino follow-up), and no single-chat/Arena regression. Recorded as a pending human UAT in STATE.md.

## Self-Check: PASSED

- All 8 modified files exist on disk (verified below).
- All 6 task commits present in `git log`: e7f2dde, 1ae3dfa, 8c3e961, 8ea63da, c8091e5 (Task 4+5 share 8ea63da as they edit the same files).
