---
phase: 35-conversational-group-chat
plan: 03
subsystem: frontend
tags: [group-chat, persistence, localStorage, history-panel, signals, reopen]
requires:
  - "@org/shared-types ConversationSession / ChatMessage / GroupReaction / GroupMessage"
  - "GroupchatService (35-02) — ordered messages signal + streaming signal"
  - "HistoryService localStorage store (desert-chat-history)"
  - "NgRx session feature (upsertActiveSession / loadSessions)"
  - "app-mascot (libs/ui)"
provides:
  - "ChatMessage += dinoId? + reactions?; ConversationSession += isGroup? + participantDinoIds? (persisted group threads)"
  - "GroupchatService.toSession()/loadSession()/startNewSession() — group transcript <-> ConversationSession round-trip + stable groupSessionId"
  - "ChatComponent: auto-persist on group turn completion + openSession() reopen branch"
  - "HistoryPanel group-thread indicator (participant-mascot cluster + N badge)"
affects:
  - libs/shared-types/src/lib/chat.types.ts
  - apps/frontend/src/app/chat/groupchat.service.ts
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/chat/chat.html
  - libs/ui/src/lib/history-panel/history-panel.ts
tech-stack:
  added: []
  patterns:
    - "additive optional type extensions → no migration; existing single-chat sessions stay valid"
    - "stable groupSessionId reused across turns so re-saving updates the same ConversationSession in place"
    - "persist on the falling edge of groupchatStreaming() via an injection-context effect (no polling)"
    - "reopen branches on session.isGroup → groupchat view + roster restore; single-chat keeps switchToSession"
    - "group transcript persists to the SAME localStorage store as single chats (D-08) — no DB, no migration"
key-files:
  created:
    - .planning/phases/35-conversational-group-chat/35-03-SUMMARY.md
  modified:
    - libs/shared-types/src/lib/chat.types.ts
    - apps/frontend/src/app/chat/groupchat.service.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
    - libs/ui/src/lib/history-panel/history-panel.ts
    - libs/ui/src/lib/history-panel/history-panel.html
    - libs/ui/src/lib/history-panel/history-panel.stories.ts
    - apps/frontend/src/app/chat/groupchat.service.spec.ts
decisions:
  - "Group sessions reuse the existing SessionActions.upsertActiveSession path (it only touches the sessions list, never the active chat message list) — single-dino save/switch is byte-for-byte unchanged."
  - "Persist fires on the falling edge of groupchatStreaming() (true→false) via a constructor effect tracking a prevGroupStreaming flag — consistent with the existing voice effects, no polling."
  - "Reopen wiring moved from an inline template expression to onSessionSelected() in chat.ts so the isGroup branch is type-checked and not reliant on void-truthiness in the template."
  - "groupMessageToChatMessage maps role 'user'→'user' and 'dino'→'assistant'+dinoId; chatMessageToGroupMessage mints fresh ids on reopen (ids are view-local; reactions target by id at runtime, so a fresh id is correct)."
  - "HistoryPanel cluster capped at 3 mascots with a +N overflow badge; panel stays presentational (no injected services), Mascot is a same-lib relative import (no new module-boundary violation)."
metrics:
  duration: ~35m
  completed: 2026-06-07
  tasks: 5 automated (Task 6 manual UAT pending)
  files: 8
---

# Phase 35 Plan 03: Durable Group Chat Persistence Summary

Made group conversations durable (D-08 / GRP2-04 / Success Criterion #4). A completed turn-based group thread now saves as a single interleaved, attributed `ConversationSession` in the same localStorage store as normal chats — no DB table, no migration — carrying who said what plus pinned emoji reactions and the participant roster. The history panel lists group threads alongside single chats, visually distinguished by a participant-mascot cluster, and reopening one restores the full top-to-bottom transcript and the exact dino selection back into the groupchat view. The previously ephemeral groupchat is now persistent; single-dino save/reopen is unchanged.

## What Was Built

- **Task 1 — Type extensions (additive, no migration).** `ChatMessage` += optional `dinoId?: string` and `reactions?: GroupReaction[]` (group-thread attribution); `ConversationSession` += optional `isGroup?: boolean` and `participantDinoIds?: string[]` (saved roster). `GroupReaction` imported from `./group.types.js` (NodeNext `.js` specifier — the lib uses module resolution that requires the extension; the `typecheck` target is the compile gate, not `build`). Existing single-chat values remain type-valid.
- **Task 2 — GroupchatService persistence API.** Added a stable `groupSessionId` (minted on the first `send` of a fresh thread, reused across turns), `groupSessionCreatedAt`, and a tracked `participantDinoIds` roster. New public methods: `toSession(title)` builds `{ id: groupSessionId, title, isGroup: true, participantDinoIds, messages: mapped, createdAt }`; `loadSession(session)` adopts the saved id + roster, restores the `messages` signal, and returns the roster; `startNewSession()` resets to a fresh empty thread. Private `groupMessageToChatMessage`/`chatMessageToGroupMessage` mappers preserve role/dinoId/reactions/text/createdAt. The Plan 02 streaming logic is untouched beyond assigning/reusing `groupSessionId` in `send`.
- **Task 3 — Persist-on-completion + reopen in ChatComponent.** A constructor `effect()` watches `groupchatStreaming()`; on the true→false falling edge with ≥1 user message it calls `persistGroupSession()` — which seeds the title from the first user message, dispatches `SessionActions.upsertActiveSession({ session: toSession(title) })` (the same store/HistoryService path single chat uses), then `SessionActions.loadSessions()` to refresh the panel. The stable id means re-saving updates in place (no duplicate entry). `openSession(session)` switches to the groupchat view, restores the transcript + roster via `loadSession`, and closes the sidebar. `chat.html`'s `(sessionSelected)` now calls `onSessionSelected($event)` which branches on `session.isGroup` — group → `openSession`, else → the unchanged `setActiveView('chats'); switchToSession; closeMobileSidebar` path.
- **Task 4 — HistoryPanel group indicator.** The session-row title now renders a participant-mascot cluster (`@for` over `clusterDinoIds(session)`, `app-mascot [dinoId] size="sm"`, capped at 3 with a `+N` overflow badge from `extraParticipantCount`) when `session.isGroup`. `Mascot` added to the standalone imports; the panel stays presentational (no injected services). Added a `WithGroupThread` Storybook variant with an `isGroup` session and a 4-dino roster.
- **Task 5 — Persistence + reopen tests.** Extended `groupchat.service.spec.ts` (Vitest `vi.*`) with a `seedTranscript()` helper driving a full turn (plan → two dino answers → a reaction on the user message → group_done) and cases for: `toSession` (isGroup, roster, stable id across calls, dino→assistant+dinoId mapping, reaction preserved), `loadSession` (restores the signal, returns the roster), a full round-trip equality check (order/attribution/reactions), and reopen adopting the session id so re-saving updates in place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NodeNext import specifier for GroupReaction**
- **Found during:** Task 1 — `import { GroupReaction } from './group.types'` failed `TS2307: Cannot find module` under the shared-types `typecheck` target (the lib's barrel uses `.js` specifiers / NodeNext resolution).
- **Fix:** imported from `./group.types.js`.
- **Files modified:** libs/shared-types/src/lib/chat.types.ts
- **Commit:** 64c66fd

**2. [Rule 1 - Quality] Reopen branch extracted from the template**
- **Found during:** Task 3 — the planned inline `(sessionSelected)` expression relied on `||` void-truthiness chaining, which is fragile and untyped.
- **Fix:** introduced `onSessionSelected(session)` in chat.ts that branches on `session.isGroup` with proper typing; the template calls it directly. Single-chat behavior is identical.
- **Files modified:** apps/frontend/src/app/chat/chat.ts, apps/frontend/src/app/chat/chat.html
- **Commit:** 5b91624

## Verification

- `npx nx typecheck @org/shared-types` — green (the project's compile gate; it has a `typecheck` target, not `build`).
- `npx nx run-many -t lint,build --projects=frontend` — green (build compiles `ui` as a dependency; authoritative compile gate for both `ui` and `frontend`).
- `npx nx lint ui` — fails only with the pre-existing `@nx/enforce-module-boundaries` ("Buildable libraries cannot import from non-buildable libraries") and pre-existing empty-arrow-function errors on files unrelated to this plan (documented Phase 24 / Plan 02). The `@org/shared-types` import in `history-panel.ts` pre-dates this plan; the new `Mascot` import is a same-lib relative path and adds no violation. `nx build frontend` (which type-checks the whole ui+frontend graph) is green.
- `npx nx test frontend` — **could not execute**: the runner crashes at bundle generation with `Cannot destructure property 'pos' of 'file.referencedFiles[index]' as it is undefined` (angular-compiler esbuild plugin). This is the pre-existing, environment-wide Windows toolchain crash documented since Phase 27 and again in 35-02-SUMMARY.md / deferred-items.md — NOT caused by this plan's spec. The new cases use the same `vi.*` API and patterns as the existing green-on-CI cases in the same file and are type-sound against production sources (the spec compiles under the frontend build graph). They will run once the toolchain is repaired or on CI/Linux.

## Deferred / Out-of-Scope Issues

- **Frontend Vitest runner crash** (pre-existing, environment-wide) — blocks executing the spec locally on this Windows machine; see phase `deferred-items.md`.
- **`@chatbot/ui` lint module-boundary + empty-arrow-function errors** (pre-existing) — affect all ui components; not introduced here. `nx build` is the green compile gate.

## Requirements Satisfied

- **GRP2-04 / Success Criterion #4** — group conversations are saved in the history panel and reopen with the full attributed transcript (who said what + pinned emoji reactions) and the original participant roster, using one interleaved localStorage `ConversationSession` (D-08), no DB change, no migration, replacing the previously ephemeral groupchat. Single-dino history is unaffected.

## Known Stubs

None. All persisted fields (dinoId, reactions, roster, isGroup) are backed by live transcript data; reopen restores from the saved session.

## Threat Flags

None — no new security surface. Group transcripts persist to the same `desert-chat-history` localStorage store as single chats (identical device-local trust model, T-35-03-01 accept). Reopen mappers default missing `dinoId`/`reactions`/`participantDinoIds` safely and never enter the group branch for non-group sessions (T-35-03-02). Reopened text renders through the same Angular-interpolated / markdown path as live messages — persistence stores plain text + emoji only, no new HTML sink (T-35-03-03). Matches the plan threat model.

## Pending Human UAT (Task 6 — not executed, autonomous: false)

Live persistence UAT (BLOCKING for phase verification). With backend + frontend served and a live `OPENROUTER_API_KEY`:
1. Hold a multi-turn group conversation with 3 dinos (include ≥1 emoji reaction and one inter-dino reply). Open the history panel and confirm the group thread appears, visually distinct (participant-mascot cluster).
2. Switch to a single chat, then reopen the saved group thread from the panel. Confirm it returns to the groupchat view with the FULL transcript top-to-bottom (attribution + reaction chips intact) and the original participant selection restored (GRP2-04).
3. Send another message in the reopened group thread — confirm dinos still see prior context and the session updates in place (no duplicate panel entry).
4. Confirm single-dino chat history save/reopen still works unchanged.

## Self-Check: PASSED

- All 8 modified/created files exist on disk.
- All 5 task commits present in git log: 64c66fd, 2d901ff, 5b91624, 371022f, 4196508.
