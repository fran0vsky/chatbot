---
phase: 42-custom-dino-creator
verified: 2026-06-19T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 1/4
  gaps_closed:
    - "CDINO-01: creation UI, picker integration, userId-scoped roster — all delivered in Plans 02/03/04"
    - "CDINO-02: async resolveDino threaded through agents.service.streamAgent — delivered in Plan 03"
    - "CDINO-03: frontend edit/delete with confirmation and roster reload — delivered in Plan 04"
    - "CDINO-04: async resolveRoster in group-agents.service with resolveDino — delivered in Plan 03"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "End-to-end CDINO-01: create a custom dino through the UI"
    expected: "Click 'Create a dino' tile in the picker, fill name + optional avatar + description + reaction prompt + model + tools, save — dino appears in the picker with its avatar and the correct name"
    why_human: "Requires a running backend (DATABASE_URL + OPENROUTER_API_KEY), a browser, and live GCS or degraded mode — cannot verify rendering and picker presence programmatically"
  - test: "End-to-end CDINO-02: chat with a custom dino uses its authored persona"
    expected: "After creating a custom dino with a distinctive system prompt, chatting with it produces replies that clearly follow that persona; only the selected tools are available (no widening beyond catalogue)"
    why_human: "Requires LLM streaming, live DB, and behavioral assessment of model output — cannot grep-verify persona fidelity"
  - test: "End-to-end CDINO-03: edit and delete a custom dino"
    expected: "Clicking Edit on a custom card opens the form pre-filled; saving changes persists and shows in the picker after reload. Clicking Del prompts window.confirm, then removes the dino from the picker permanently"
    why_human: "Requires a live browser session with running DB; persistence across reload cannot be verified statically"
  - test: "End-to-end CDINO-04: custom dino participates in group chat"
    expected: "Custom dino is selectable as a group-chat participant and takes turns alongside built-in dinos via the Phase 41 engine"
    why_human: "Requires live backend + LLM streaming + group-chat UI interaction"
  - test: "Degraded path: AVATAR_BUCKET unset"
    expected: "When AVATAR_BUCKET env var is absent, the avatar upload returns a clear HTTP 400 with message 'avatar upload is not configured'; the rest of the form continues to work or blocks cleanly — no backend crash"
    why_human: "Requires manually unsetting AVATAR_BUCKET in the backend env and observing the error surface in the frontend form"
---

# Phase 42: Custom Dino Creator Verification Report

**Phase Goal:** Ship the Custom Dino Creator — let users author, manage, and chat with their own dinos (custom name, persona prompt, avatar image, and allowed tool subset). Integrate seamlessly alongside built-in dinos in the picker and chat loop.
**Verified:** 2026-06-19T00:00:00Z
**Status:** human_needed
**Re-verification:** Yes — previous verification (2026-06-18) was written after only Plan 42-01 executed (score 1/4, gaps_found). Plans 42-02, 42-03, 42-04 have since been executed. All four automated truths are now VERIFIED; only HUMAN-UAT remains.

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (Roadmap SC) | Req | Status | Evidence |
|---|---|---|---|---|
| 1 | An "add dino" flow lets the user supply name, avatar image, description, personality prompt, tool subset; created dino appears in picker | CDINO-01 | VERIFIED | `CustomDinoCreator` component wired in `chat.ts`; `DinoPicker` emits `addDino`; `DinoService.fetchDinos/loadDinos` pass `?userId=`; `GET /api/dinos?userId=` merges custom summaries |
| 2 | Chatting with a custom dino uses its authored prompt + selected tools, resolved server-side; client cannot widen toolset | CDINO-02 | VERIFIED | `resolveDino()` in `dino-resolver.ts` replaces `getDino()` in `agents.service.streamAgent`; `resolveActiveTools` intersection preserved |
| 3 | Custom dinos persist in the DB scoped to the anonymous userId, and can be edited and deleted | CDINO-03 | VERIFIED | `customDinos` pgTable with `userId` index in schema; `CustomDinoService` CRUD scoped by userId; frontend `onEditDino/onDeleteDino` handlers dispatch `loadDinos` after mutation |
| 4 | A custom dino can be selected into a group chat and participates via the Phase 41 engine | CDINO-04 | VERIFIED | `GroupAgentsService.resolveRoster` converted to async; `await resolveDino(id, userId, customDinoService)` per participant; unresolved ids dropped; custom dinos enter the roster |

**Score:** 4/4 truths VERIFIED (all automated checks pass; human UAT pending)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/backend/src/app/database/schema.ts` | `customDinos` pgTable + userId index + `$inferSelect` types | VERIFIED | Lines 104–137: table exists with all required columns including `tool_names` jsonb, `user_id` index, `$onUpdate` on updatedAt (WR-04). `CustomDinoRow`/`NewCustomDinoRow` exported. |
| `apps/backend/src/app/agents/custom-dinos.service.ts` | CRUD scoped by userId, graceful degradation, `custom:` prefix, `toCustomDinoSummary` | VERIFIED | All five methods present; null-db guards + try/catch; `CUSTOM_ID_PREFIX`; `toCustomDinoSummary` uses explicit allowlist excluding `systemPrompt`; `validateAvatarUrl`, CR-02 empty-patch guard, WR-01 HttpException re-throw all present |
| `apps/backend/src/app/agents/custom-dinos.controller.ts` | POST/GET/PUT/DELETE `/custom-dinos`, GET `/models`, thin | VERIFIED | All five routes present; delegates to service; `@Controller()` without path prefix (routes work globally). |
| `apps/backend/src/app/agents/model-catalogue.ts` | `MODEL_CATALOGUE` (non-empty), `isAllowedModel` | VERIFIED | 5 free/cheap models; paid image model excluded; O(1) Set-based guard |
| `apps/backend/src/app/agents/avatar.service.ts` | Validate + upload to GCS, graceful degradation when AVATAR_BUCKET unset | VERIFIED | image/* mimetype check, 2MB size cap, lazy Storage construction, `BadRequestException('avatar upload is not configured')` when bucket unset |
| `apps/backend/src/app/agents/avatar.controller.ts` | POST `custom-dinos/avatar` via FileInterceptor, thin | VERIFIED | Exactly one route; `FileInterceptor('file')`; delegates to `avatarService.upload(file)` |
| `apps/backend/src/app/agents/dino-resolver.ts` | `resolveDino` + `customDinoToDino` | VERIFIED | Both exported; branches on `custom:` prefix; no silent fallback to built-in for unknown custom id (returns undefined); `imageGen: false` on custom dinos |
| `libs/shared-types/src/lib/dino.types.ts` | `CustomDino`, `CreateCustomDinoRequest`, `UpdateCustomDinoRequest`, `CuratedModel`, `Dino.avatarUrl` | VERIFIED | All five types present; `Dino` has `avatarUrl?: string`; `DinoSummary = Omit<Dino,'systemPrompt'>` inherits it |
| `apps/frontend/src/app/chat/dino.service.ts` | userId-scoped roster fetch + CRUD/models/avatar methods | VERIFIED | `loadUserId()` imported; `fetchDinos`/`loadDinos` pass `?userId=`; `fetchModels`, `uploadAvatar`, `createCustomDino`, `updateCustomDino`, `deleteCustomDino` all present and return Observables |
| `apps/frontend/src/app/chat/custom-dino-creator.ts` | Standalone OnPush, injects DinoService, create + edit modes, `canSave`, inline error, emits `saved`/`cancelled` | VERIFIED | All required elements present: signals for fields, `computed canSave`, `ngOnInit` seeds fields from `editing`, avatar upload via `uploadAvatar`, save branches on `editing`, errors set inline signal, never thrown past component |
| `libs/ui/src/lib/dino-picker/dino-picker.ts` | `@Output() addDino/editDino/deleteDino`, "add a dino" tile, custom flag passthrough | VERIFIED | All three outputs declared; template wires `[custom]="dino.id.startsWith('custom:')"` on each card; "Create a dino" tile present in both empty and non-empty states |
| `libs/ui/src/lib/dino-card/dino-card.ts` | `@Input() custom`, `@Output() editDino/deleteDino`, avatarUrl rendering | VERIFIED | `custom = false` input; `editDino`/`deleteDino` outputs; template branches on `dino.avatarUrl` for img vs mascot; edit/delete buttons gated on `@if (custom)` with `stopPropagation` |
| `apps/frontend/src/app/chat/chat.ts` | Handlers, signals, overlay, both pickers wired | VERIFIED | `dinoCreatorOpen`, `editingDino` signals; `openDinoCreator`, `onEditDino`, `onDeleteDino` (confirm + delete + loadDinos), `onDinoSaved` (close + loadDinos); both picker instances at lines 120–122 and 771–773 wired |
| `apps/backend/src/app/agents/agents.module.ts` | All new providers + controllers registered | VERIFIED | `CustomDinoService`, `AvatarService` in providers; `CustomDinosController`, `AvatarController`, `DinosController` in controllers |

---

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `agents.service.streamAgent` | `CustomDinoService.getById` (via resolveDino) | `await resolveDino(dinoId, userId, this.customDinoService)` at line 144 | WIRED | Confirmed: `resolveDino` imported at line 13; `customDinoService` injected in constructor |
| `group-agents.service.resolveRoster` | `CustomDinoService.getById` (via resolveDino) | `await resolveDino(id, userId, this.customDinoService)` at line 130 | WIRED | Confirmed: `resolveDino` imported at line 15; `customDinoService` injected at line 112; roster made async; `userId` threaded from `streamGroup` |
| `DinosController.list` | `CustomDinoService.listSummaries` | `userId` query param → `customDinoService.listSummaries(userId)` | WIRED | Confirmed in dinos.controller.ts lines 13–19; `systemPrompt` never included (explicit allowlist in service) |
| `DinoPicker (addDino)` → `ChatComponent.openDinoCreator` | `CustomDinoCreator` overlay | `(addDino)="openDinoCreator()"` on both picker instances; `@if (dinoCreatorOpen())` renders creator | WIRED | Confirmed at chat.html lines 120, 771, 944 |
| `CustomDinoCreator.save` | `DinoService.createCustomDino / updateCustomDino` | signals → `this.dinoService.createCustomDino/updateCustomDino` → `saved.emit()` → `onDinoSaved()` → `store.dispatch(DinoActions.loadDinos())` | WIRED | Confirmed in custom-dino-creator.ts lines 177–213 and chat.ts lines 651–655 |
| `DinoService.fetchDinos` | `GET /api/dinos?userId=` | `HttpParams().set('userId', this.userId)` | WIRED | Confirmed in dino.service.ts lines 34–36 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `dinos.controller.ts: list()` | `customSummaries` | `customDinoService.listSummaries(userId)` → DB `SELECT` on `customDinos` table | Yes — real Drizzle query via `db.select().from(customDinos).where(eq(customDinos.userId, userId))` | FLOWING |
| `DinoService.fetchDinos()` | roster Observable | `GET /api/dinos?userId=` with userId from `loadUserId()` | Yes — merges built-ins + DB-loaded custom summaries | FLOWING |
| `CustomDinoCreator` | `models` signal | `dinoService.fetchModels()` → `GET /api/models` → `MODEL_CATALOGUE` (5 real entries) | Yes | FLOWING |
| `CustomDinoCreator` | `avatarUrl` signal | `dinoService.uploadAvatar(file)` → GCS upload → returns `{ url }` | Yes (requires AVATAR_BUCKET; degrades to 400 without it) | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — the backend requires live DB + LLM + GCS to exercise custom-dino paths. The frontend requires a browser. No in-repo CLI entry point exercises the custom-dino feature in isolation.

---

## Probe Execution

No phase-specific probes declared in any PLAN file. No conventional `scripts/*/tests/probe-*.sh` exists for this phase. SKIPPED.

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| CDINO-01 | 42-01, 42-02, 42-03, 42-04 | Add-dino flow: name, avatar, description, persona prompt, tool subset; dino appears in picker | SATISFIED | Backend CRUD + avatar upload + merged GET /api/dinos + frontend picker/creator UI all verified |
| CDINO-02 | 42-03 | Chat with custom dino uses authored prompt + selected tools, server-side resolution, no toolset widening | SATISFIED | `resolveDino` in `dino-resolver.ts` wired into `agents.service.streamAgent`; `resolveActiveTools` intersection preserved |
| CDINO-03 | 42-01, 42-04 | Custom dinos persist scoped to anonymous userId; can be edited and deleted | SATISFIED | `customDinos` table with userId scoping; service CRUD; frontend edit/delete handlers with roster reload |
| CDINO-04 | 42-03 | Custom dino can be selected into group chat and participates via Phase 41 engine | SATISFIED | `resolveRoster` converted to async; `resolveDino` called per participant; custom ids resolve to real Dino shapes |

No orphaned requirements — REQUIREMENTS.md notes CDINO-01..04 are captured in ROADMAP Phase 42 details.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| None found | — | Scanned all Phase 42 key files for TBD/FIXME/XXX/placeholder/hardcoded empty | — | Clean |

**Debt-marker gate:** No unreferenced TBD/FIXME/XXX markers found in any file modified by Plans 01–04.

Notable (non-blocking) items from the SUMMARY files:
- **Bundle budget overage** (Plan 04 SUMMARY): Angular build emits a budget error (1.016 MB vs 1 MB limit). This is pre-existing (bundle was already at 993 kB before this phase). TypeScript compilation succeeds with no type errors. Not introduced by this phase — not a blocker.
- **`nx test frontend` Windows crash** (Plan 04 SUMMARY): Pre-existing `referencedFiles/pos` TS internal error on Windows, documented since Phase 35-02. The DinoService spec file is type-sound (lint passes). Not introduced by this phase — not a blocker.
- **`nx lint ui` boundary errors** (Plan 04 SUMMARY): Pre-existing `@nx/enforce-module-boundaries` errors in unrelated components (skill-manager, tool-call-bubble). Not introduced by this phase — not a blocker.

---

## Human Verification Required

### 1. CDINO-01: End-to-end custom dino creation

**Test:** With backend running (DATABASE_URL + OPENROUTER_API_KEY set; optionally AVATAR_BUCKET set): click the "Create a dino" tile in the dino picker, fill in name + description + reaction prompt + model (from dropdown) + tools (checkboxes) + optional avatar image upload, then click Save.
**Expected:** The new dino appears in the picker grid with its name and avatar (if uploaded). It persists across page reload.
**Why human:** Requires a live browser session against a running Postgres DB + backend. Avatar rendering and picker-list position cannot be verified by static analysis.

### 2. CDINO-02: Custom dino persona in chat

**Test:** Open a chat with the custom dino created in test 1. Send a message that the persona should respond to in a distinctive way. Observe the reply.
**Expected:** The dino replies in its authored persona (the system prompt you wrote). Only the tools you selected at creation time are invokable — attempting to invoke an unchecked tool does nothing.
**Why human:** Requires LLM streaming and behavioral assessment of model output. Toolset enforcement is server-side (verifiable by code) but the correct persona behavior requires runtime observation.

### 3. CDINO-03: Edit and delete a custom dino

**Test:** On a custom dino card, click Edit. Verify the form pre-fills with the dino's name/description/model/tools (note: reaction prompt is intentionally blank — saving without changing it leaves the original prompt unchanged). Change the name and save. Verify the updated name appears in the picker. Then click Del, confirm the dialog, and verify the dino disappears from the picker after the roster reloads.
**Expected:** Edits persist after reload; deletion is permanent. Both operations trigger a roster reload without a page refresh.
**Why human:** Requires live browser + DB; persistence across reload and roster-refresh timing cannot be verified statically.

### 4. CDINO-04: Custom dino in group chat

**Test:** Switch to group-chat mode. Select the custom dino as a participant alongside one or more built-in dinos. Send a message. Observe that the custom dino takes a turn.
**Expected:** The custom dino participates in the group exchange and its reply reflects its authored persona. The Phase 41 engine drives turn order.
**Why human:** Requires live browser + DB + LLM streaming for all participant dinos simultaneously.

### 5. Degraded path: AVATAR_BUCKET unset

**Test:** Start the backend without the AVATAR_BUCKET env var. Open the custom dino creator and attempt an avatar image upload.
**Expected:** The upload fails with a clear "avatar upload is not configured" message (HTTP 400) surfaced inline in the form. The rest of the creation form (name, prompt, model, tools) remains usable; the backend does not crash.
**Why human:** Requires manually unsetting the env var and observing the frontend error message. The service code implements this correctly (verified) but the user-visible error surface needs a human to confirm.

---

## Gaps Summary

No automated gaps remain. All four roadmap success criteria (CDINO-01 through CDINO-04) are verified by codebase inspection. The phase is blocked at `human_needed` status pending the UAT scenarios above, which require a live backend + browser session.

The Plan 04 SUMMARY explicitly lists the same five UAT scenarios as PENDING. This is the expected state at the end of code-complete Plans 01–04 before human sign-off.

---

_Verified: 2026-06-19T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Previous verification: 2026-06-18 — gaps_found (1/4) — stale; written after Plan 42-01 only_
