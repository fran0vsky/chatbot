---
phase: 42-custom-dino-creator
verified: 2026-06-18T00:00:00Z
status: gaps_found
score: 1/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "An 'add dino' flow lets the user supply name, avatar image, description, a personality prompt ('how it reacts'), and pick tools from the existing catalogue; the created dino appears in the dino picker (CDINO-01)"
    status: failed
    reason: "No creation UI exists anywhere in the frontend. No 'add dino' button or form in the dino picker, no Angular component for custom dino creation, no NgRx actions/effects/selectors for custom dino CRUD. DinoService.fetchDinos() calls GET /api/dinos which returns only built-in DINOS — custom dinos are never fetched from GET /api/custom-dinos. Plans 02, 03, and 04 (UI, avatar upload, end-to-end) were never executed."
    artifacts:
      - path: "libs/ui/src/lib/dino-picker/dino-picker.ts"
        issue: "Renders only the dino[] passed in — no 'add dino' affordance. No input or output for custom dino creation."
      - path: "libs/ui/src/lib/dino-picker/dino-picker.html"
        issue: "Iterates over dinos with @for, shows empty-state message. No 'add dino' button or link."
      - path: "apps/frontend/src/app/chat/dino.service.ts"
        issue: "fetchDinos() and loadDinos() call GET /api/dinos (built-in registry only). No methods for custom-dino CRUD or GET /api/custom-dinos."
    missing:
      - "Angular creation/edit form component (name, avatar, description, persona prompt, tool checkboxes, model dropdown)"
      - "Angular deletion confirmation UI"
      - "DinoService methods: createCustomDino, listCustomDinos, updateCustomDino, deleteCustomDino"
      - "Merged dino list in frontend (built-in + custom) fed to DinoPicker"
      - "'Add dino' entry in DinoPicker that opens the creation flow"
      - "GET /api/dinos must accept userId query param and append custom dinos to the built-in list"

  - truth: "Chatting with a custom dino uses its authored prompt + selected tools, resolved server-side — the client still cannot widen a toolset, and a custom dino cannot reference tools outside the catalogue (CDINO-02)"
    status: failed
    reason: "The agents.service.ts resolves a dino with getDino(dinoId) which only looks up the built-in DINOS registry. A 'custom:...' dinoId returns undefined from getDino(), so the agent loop runs with no system prompt and all tools — it does not load the custom dino's persona, systemPrompt, or toolNames from the DB. The group-agents.service.ts also calls getDino() only. No async resolver that branches on the 'custom:' prefix exists in either service."
    artifacts:
      - path: "apps/backend/src/app/agents/agents.service.ts"
        issue: "Line 140: const dino = dinoId ? getDino(dinoId) : undefined; — getDino() is synchronous and only knows the built-in DINOS array. A custom: id returns undefined; the agent loop then runs without system prompt or tool gating."
      - path: "apps/backend/src/app/agents/group-agents.service.ts"
        issue: "Line 119: roster.push(getDino(id)); — same synchronous getDino() only. Custom dino ids silently produce undefined, breaking group chat roster construction."
      - path: "apps/backend/src/app/agents/dinos.controller.ts"
        issue: "GET /dinos returns DINOS.map(toDinoSummary) — built-in list only. No userId query param, no custom dino merge."
    missing:
      - "Async resolver function: resolveDino(id, userId) — returns a built-in Dino from getDino() OR a custom dino mapped to the Dino shape loaded from DB via CustomDinoService"
      - "Thread of async resolver through agents.service.streamAgent (replace synchronous getDino call)"
      - "Thread of async resolver through group-agents.service roster build"
      - "Merged GET /api/dinos endpoint: accepts userId query param, appends toDinoSummary-shaped custom dinos"

  - truth: "Custom dinos persist in the DB scoped to the anonymous user id, and can be edited and deleted (CDINO-03)"
    status: failed
    reason: "The DB schema (customDinos table) and the full CRUD service (CustomDinoService) are correctly implemented and wired into the AgentsModule. The REST API endpoints (POST/GET/PUT/DELETE /api/custom-dinos) are live and substantive. HOWEVER the frontend has no UI to invoke edit or delete — only the backend half of this truth exists. Without the creation/edit/delete UI, users cannot in practice edit or delete their custom dinos through the app."
    artifacts:
      - path: "apps/frontend/src/app/chat/dino.service.ts"
        issue: "No updateCustomDino or deleteCustomDino methods. Backend endpoints exist but are unreachable from the UI."
    missing:
      - "Frontend edit and delete flows (UI + service calls)"

  - truth: "A custom dino can be selected into a group chat and participates via the Phase 41 engine (CDINO-04)"
    status: failed
    reason: "Custom dinos are not resolvable in the group-agents.service.ts (getDino only) and do not appear in the picker (no merged list). A user cannot select a custom dino into group chat. No resolution path for 'custom:...' ids exists in the group engine."
    artifacts:
      - path: "apps/backend/src/app/agents/group-agents.service.ts"
        issue: "Line 119: roster.push(getDino(id)) — synchronous, built-in only. A custom dino id would push undefined, crashing or silently dropping the dino from the group."
    missing:
      - "Async resolver threaded through group-agents.service roster build"
      - "Custom dinos appearing in the frontend picker so they can be selected into group chat"
---

# Phase 42: Custom Dino Creator Verification Report

**Phase Goal:** Users create their own dinos — name, avatar image, description, personality/reaction prompt, and tool subset — persisted per user, selectable in the picker, and able to join group chats.
**Verified:** 2026-06-18
**Status:** gaps_found
**Re-verification:** No — initial verification

## Context: Plans Executed vs. Plans Required

Phase 42 requires 4 plans per the CONTEXT doc's scope:
- Plan 01: Data + contract layer (DB table, CRUD service, REST API, shared types) — **EXECUTED**
- Plan 02: Avatar upload endpoint (GCS bucket) — **NOT EXECUTED**
- Plan 03: Chat-loop resolution (async resolver, registry merge, dinos endpoint merge) — **NOT EXECUTED**
- Plan 04: Creation/edit/delete UI + end-to-end UAT — **NOT EXECUTED**

ROADMAP.md records "1/1 plans complete" and marks the phase "Complete 2026-06-18". This verification contradicts that — the phase plan count is mislabeled as 1 when 4 are required to reach the stated goal. Only Plan 01 shipped.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Add dino" flow exists; created dino appears in picker (CDINO-01) | FAILED | No creation UI anywhere in frontend. DinoPicker has no "add" affordance. DinoService only calls /api/dinos (built-ins). |
| 2 | Custom dino chat uses authored prompt + tools, resolved server-side (CDINO-02) | FAILED | agents.service.ts line 140 calls synchronous getDino() which only resolves built-ins. Custom: ids return undefined. |
| 3 | Custom dinos persist, can be edited and deleted (CDINO-03) | FAILED | Backend CRUD is complete and wired. Frontend has zero UI or service methods for create/edit/delete — back-end half only. |
| 4 | Custom dino can join group chat via Phase 41 engine (CDINO-04) | FAILED | group-agents.service.ts line 119 uses getDino() (built-ins only). Custom dinos cannot be added to the group roster. |

**Score:** 0/4 truths verified as fully working end-to-end.

Note: The Plan 01 deliverables (schema, service, controller, shared types, unit tests) are themselves correctly implemented and substantive — they satisfy the "data half" of CDINO-01 and CDINO-03. But none of the 4 success criteria can be called TRUE because the frontend and resolver wiring required to make them observable is absent.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/app/database/schema.ts` | customDinos pgTable + inferred types | VERIFIED | Table defined at L104; CustomDinoRow / NewCustomDinoRow exported at L136-137 |
| `apps/backend/src/app/agents/custom-dinos.service.ts` | CRUD service + graceful degradation | VERIFIED | Full CRUD, null-db guards, custom: prefix, toCustomDinoSummary allowlist |
| `apps/backend/src/app/agents/custom-dinos.controller.ts` | REST endpoints + GET /models | VERIFIED | POST/GET/PUT/DELETE /custom-dinos + GET /models, thin delegation to service |
| `apps/backend/src/app/agents/model-catalogue.ts` | MODEL_CATALOGUE + isAllowedModel | VERIFIED | 5 free/cheap models, isAllowedModel O(1) via Set |
| `libs/shared-types/src/lib/dino.types.ts` | CustomDino + request/response + CuratedModel | VERIFIED | All 4 types added, no `any`, exported |
| `apps/backend/src/app/agents/agents.module.ts` | CustomDinoService + CustomDinosController registered | VERIFIED | Both in providers/controllers lists |
| `apps/backend/src/app/agents/custom-dinos.service.spec.ts` | Unit tests for validation, degradation, prefix, projection | VERIFIED | 18 test cases covering all invariants |
| **MISSING** `resolveDino(id, userId)` async resolver | Async lookup: built-in OR custom from DB | MISSING | No such function in agents.service or anywhere else |
| **MISSING** Merged GET /api/dinos with userId | Built-ins + user's custom dinos | MISSING | dinos.controller.ts returns DINOS.map(toDinoSummary) only |
| **MISSING** Frontend creation/edit/delete UI | Angular components for "add a dino" | MISSING | No creator component, no DinoService CRUD methods |
| **MISSING** Frontend dino list merge | Custom dinos appear alongside built-ins in picker | MISSING | DinoPicker receives only built-in list; no "add dino" button |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| CustomDinosController | CustomDinoService | Constructor injection, NestJS DI | WIRED | Confirmed in agents.module.ts and controller constructor |
| AgentsModule | CustomDinoService + CustomDinosController | providers/controllers arrays | WIRED | agents.module.ts L14 |
| agents.service.streamAgent | Custom dino resolution | async resolveDino() | NOT_WIRED | Line 140 uses synchronous getDino() — custom: ids return undefined |
| group-agents.service | Custom dino resolution | async resolveDino() | NOT_WIRED | Line 119 uses synchronous getDino() — custom: ids silently return undefined |
| GET /api/dinos | Custom dino merge | userId query param + CustomDinoService.list() | NOT_WIRED | dinos.controller.ts has no CustomDinoService injection and no userId param |
| Frontend DinoService | GET /api/custom-dinos | HTTP call in DinoService | NOT_WIRED | DinoService has no custom-dino methods; only loadDinos() → /api/dinos |
| DinoPicker | Custom dino creation flow | "add dino" entry / event | NOT_WIRED | No such output, button, or route in dino-picker.ts or .html |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `dino-picker.html` | `dinos` input | DinoService.dinos signal (populated via loadDinos → /api/dinos) | Real built-in dinos only; custom dinos never included | STATIC (custom dinos excluded) |
| `agents.service.ts` streamAgent | `dino` local var | getDino(dinoId) from built-in DINOS array | Built-in dinos real; custom: ids → undefined → no system prompt, all tools | DISCONNECTED for custom dinos |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points that can be invoked without a live server and DB. The REST endpoints require a running NestJS instance and Postgres; the Angular frontend requires a browser. Static code analysis is the appropriate verification mode here.

### Probe Execution

No probe scripts exist for Phase 42. SKIPPED.

### Requirements Coverage

REQUIREMENTS.md (v2.2 section, line 184) notes: "Mentor-feedback requirements (MEM2-01, GRP3-01..04, CDINO-01..04, UAT-01) for Phases 40–44 are captured in the ROADMAP phase details and will be formalized here when each phase is discussed/planned." CDINO-01 through CDINO-04 are therefore defined by the ROADMAP Phase 42 Success Criteria, which are the four truths above.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CDINO-01 | 42-01-PLAN | "add dino" flow with name/avatar/description/prompt/tools; created dino appears in picker | BLOCKED | No creation UI; picker unchanged; /api/dinos not merged |
| CDINO-02 | 42-01-PLAN | Chat uses authored prompt + tools, resolved server-side | BLOCKED | getDino() in agents.service does not handle custom: ids |
| CDINO-03 | 42-01-PLAN (data half) | Custom dinos persist, can be edited and deleted | PARTIAL | Backend CRUD fully present; no frontend edit/delete UI |
| CDINO-04 | (deferred to Plan 03/04) | Custom dino joinable in group chat via Phase 41 engine | BLOCKED | getDino() in group-agents.service does not handle custom: ids; picker does not show custom dinos |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/backend/src/app/agents/agents.service.ts` | 140 | `getDino(dinoId)` — synchronous built-in-only lookup | Blocker | Custom: ids silently return undefined; agent runs without system prompt or tool gating — security gap (T-42-01-02 and T-42-01-04 not mitigated at chat time) |
| `apps/backend/src/app/agents/group-agents.service.ts` | 119 | `roster.push(getDino(id))` — synchronous built-in-only | Blocker | Custom: ids push undefined into the group roster, causing runtime errors or silent exclusion |
| `apps/backend/src/app/agents/dinos.controller.ts` | 9 | `DINOS.map(toDinoSummary)` — no userId, no custom dino merge | Blocker | GET /api/dinos never returns custom dinos; picker can never show them |

No `TBD`, `FIXME`, or `XXX` debt markers found in the Plan 01 modified files.

### Human Verification Required

None required at this stage — the gaps are structural and observable via static analysis. Human UAT is gated on the gaps being closed first (Plans 02–04 need to ship).

---

## Gaps Summary

**Root cause: Plans 02, 03, and 04 were never executed.** The ROADMAP records "1/1 plans complete" but the context document and the plan itself explicitly state this is a 4-plan phase. Plan 01 delivered an accurate, well-implemented data + contract layer — the Drizzle schema, CRUD service, REST controller, model catalogue, shared types, and unit tests are all correct and substantive.

What is absent is everything that makes the goal observable:

1. **No async resolver** — `agents.service.ts` and `group-agents.service.ts` both call `getDino()`, which is synchronous and built-in-only. A `custom:...` dinoId silently returns undefined, meaning any chat or group chat initiated with a custom dino runs with no system prompt and no tool gating — a security regression relative to built-in dinos.

2. **No merged /api/dinos endpoint** — `DinosController.list()` returns built-ins only. Custom dinos never appear in the picker regardless of frontend changes.

3. **No frontend creation/edit/delete UI** — `DinoPicker` has no "add dino" affordance; `DinoService` has no custom-dino methods; no Angular component for the creation/edit form exists anywhere.

4. **CDINO-03 is partially satisfied** — the backend persistence is genuine. Editing/deleting is only possible via raw API calls, not through the app.

**All four roadmap success criteria (CDINO-01 through CDINO-04) are BLOCKED.** The phase goal is not achieved. The three missing plans should be structured as gaps for `/gsd:plan-phase --gaps`.

---

_Verified: 2026-06-18_
_Verifier: Claude (gsd-verifier)_
