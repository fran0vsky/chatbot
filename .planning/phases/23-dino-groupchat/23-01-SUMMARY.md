---
phase: 23-dino-groupchat
plan: 01
subsystem: frontend
tags: [groupchat, fan-out, streaming, angular, parallel-sse]
dependency_graph:
  requires: [19-01]
  provides: [GRP-01, GRP-02]
  affects: [frontend/chat, ui/group-response, ui/history-panel]
tech_stack:
  added:
    - GroupchatService (Angular injectable, parallel SSE fan-out)
    - GroupResponse (presentational Angular component, ngx-markdown)
  patterns:
    - N parallel async-generator loops (one AbortController per dino)
    - Signal-based per-dino reactive state (entries signal array)
    - activeView union extension (chats | explore | knowledge | groupchat)
key_files:
  created:
    - apps/frontend/src/app/chat/groupchat.service.ts
    - apps/frontend/src/app/chat/groupchat.service.spec.ts
    - libs/ui/src/lib/group-response/group-response.ts
    - libs/ui/src/lib/group-response/group-response.html
    - libs/ui/src/lib/group-response/group-response.stories.ts
  modified:
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
    - libs/ui/src/lib/history-panel/history-panel.ts
    - libs/ui/src/lib/history-panel/history-panel.html
    - libs/ui/src/index.ts
decisions:
  - "Groupchat v1 is single-turn per send (multi-turn group history deferred)"
  - "Each dino stream uses shared ChatService.streamMessage with its own AbortController"
  - "Cap of 4 dinos enforced client-side in GroupchatService.MAX_DINOS (DoS mitigation T-23-01)"
  - "groupDinoById() method bridges signal entries back to DinoSummary for template rendering"
  - "HistoryPanel activeView and viewChange types widened to include groupchat"
metrics:
  duration_seconds: 546
  completed_date: "2026-05-29"
  tasks_completed: 3
  tasks_total: 4
  files_created: 5
  files_modified: 5
---

# Phase 23 Plan 01: Dino Groupchat — Parallel Fan-out Summary

**One-liner:** Groupchat mode fans one prompt to N independently-streaming dino SSE streams, each attributed in its own GroupResponse panel, with per-dino failure isolation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GroupchatService — parallel fan-out | e43f65a | groupchat.service.ts, groupchat.service.spec.ts |
| 2 | GroupResponse presentational panel | 1b91c42 | group-response.ts/html/stories.ts, index.ts |
| 3 | Groupchat view in chat shell | 98b449b | chat.ts, chat.html, history-panel.ts/html |

## Task 4: Deferred (Manual UAT)

**Task 4 (type="manual", autonomous="false"):** Smoke test requires a live API key and manual browser interaction. Not automated.

Steps deferred to the user:
1. `npm exec nx serve frontend` (with `OPENROUTER_API_KEY` in `.env`)
2. Navigate to Group chat via sidebar
3. Select 3 dinos; send "Explain recursion in one line."
4. Verify 3 attributed panels stream in parallel with distinct voices
5. Optionally: kill network for one model, confirm only that panel shows an error

## Architecture

**GroupchatService** (`providedIn: root`):
- `send(prompt, dinoIds[])`: initialises per-dino entries, kicks off N parallel async loops (one per dinoId), each reading from `ChatService.streamMessage` with its own `AbortController`
- `stopAll()`: aborts all controllers and clears the map
- `entries` signal: reactive array of `{ dinoId, threadId, text, status, error }`
- Cap: `MAX_DINOS = 4` (T-23-01 DoS mitigation)

**GroupResponse** (presentational, no services):
- Inputs: `dino: DinoSummary`, `text: string`, `status: GroupResponseStatus`, `error?: string`
- Renders mascot + name header, live status badge, markdown body via `ngx-markdown`, typing indicator while idle/pre-token
- OnPush, Tailwind only, Storybook story covers all four states

**Groupchat view** (in `ChatComponent`):
- Multi-select grid of dino chips (disabled when cap reached)
- `InputComposer` wired to `onGroupSend()` → `GroupchatService.send()`
- Responsive `app-group-response` grid bound to `groupchatEntries` signal
- Single-dino chat path completely untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Angular template type narrowing for viewChange event**
- **Found during:** Task 3
- **Issue:** `$event as 'chats' | ...'groupchat'` is not valid Angular template syntax
- **Fix:** HistoryPanel `viewChange` output type widened to match the full union; event binding uses `$event` directly
- **Files modified:** history-panel.ts, history-panel.html
- **Commit:** 98b449b

**2. [Rule 1 - Bug] Spec lint error: generator without yield**
- **Found during:** Task 3 lint pass
- **Issue:** `neverEnds` async generator in the spec never yields, failing ESLint `require-yield`
- **Fix:** Added a never-reached yield after the abort-wait
- **Files modified:** groupchat.service.spec.ts
- **Commit:** 98b449b

### Pre-existing Infrastructure Issues (Not fixed — out of scope)

1. **`@angular/build:unit-test` executor fails** with TypeScript 5.9 + Angular 21 (`Cannot destructure property 'pos' of 'file.referencedFiles[index]'`). This is a pre-existing failure confirmed by reverting all changes and re-running; spec correctness verified by code review.
2. **`@nx/enforce-module-boundaries` errors** in `@chatbot/ui` lint: 14 pre-existing errors about buildable library boundaries. Not introduced by this plan.

## Known Stubs

None — the groupchat flow is fully wired: GroupchatService → ChatService.streamMessage → GroupResponse. No placeholder data flows to the UI.

**Multi-turn group history:** v1 is single-turn per send. Multi-turn per-dino history is a known future enhancement (documented in plan design_decisions).

## Threat Surface Scan

No new network endpoints introduced (reuses existing `/api/agents/chat`). The DoS cap (T-23-01) is implemented as `GroupchatService.MAX_DINOS = 4`.

## Self-Check: PASSED

Files exist:
- apps/frontend/src/app/chat/groupchat.service.ts: FOUND
- apps/frontend/src/app/chat/groupchat.service.spec.ts: FOUND
- libs/ui/src/lib/group-response/group-response.ts: FOUND
- libs/ui/src/lib/group-response/group-response.html: FOUND
- libs/ui/src/lib/group-response/group-response.stories.ts: FOUND

Commits:
- e43f65a: FOUND (Task 1)
- 1b91c42: FOUND (Task 2)
- 98b449b: FOUND (Task 3)
