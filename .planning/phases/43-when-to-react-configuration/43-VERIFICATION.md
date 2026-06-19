---
phase: 43-when-to-react-configuration
verified: 2026-06-19T00:00:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Open group chat, click Reaction settings, change per-dino levels, confirm DB persists"
    expected: "Panel opens/closes; each dino row shows a segmented 4-button control; clicking a level highlights it optimistically; DB row for (user_id, dino_id) is upserted; dinos never configured show 'Normal' by default"
    why_human: "Angular OnPush + signal rendering, panel toggle visibility, and DB upsert require a live browser + DB-backed deploy to confirm"
  - test: "Set one dino to 'chatty', send 5 prompts; set same dino to 'rarely', send 5 more — compare answer frequency"
    expected: "Chatty dino answers noticeably more often than rarely; content of answers is not materially different between runs (level governs frequency, persona governs content)"
    why_human: "LLM probabilistic behavior — statistical frequency difference requires live observation over multiple turns"
  - test: "Set a custom dino to 'never', send 5 messages without @mention; then @mention it; then set to 'chatty', send 5 messages"
    expected: "At 'never' (no mention): zero output from the dino (no bubble, no emoji chip); at 'never' + @mention: dino answers; at 'chatty': answers more frequently than 'rarely' baseline"
    why_human: "Requires Phase 42 deployed + live group engine running; the 'never' clamp and @mention exception need real turns to verify"
  - test: "Send several prompts with a dino that has no stored reactivity row"
    expected: "Dino behaves identically to pre-Phase-43; Reaction settings panel shows 'Normal' for it; no DB row is created until user explicitly clicks a level"
    why_human: "SC#4 behavioral identity with pre-phase baseline requires live observation; DB-check requires a running DB"
---

# Phase 43: When-to-React Configuration — Verification Report

**Phase Goal:** The user controls when each dino reacts in group chat — a per-dino configuration that applies to built-in and custom dinos alike.
**Verified:** 2026-06-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A group-chat settings surface exposes a per-dino "when to react" control (never / rarely / normal / chatty) | VERIFIED | `<app-reactivity-settings>` wired in `chat.html` behind a "Reaction settings" toggle shown when `selectedGroupDinoIds().length > 0`; `ReactivitySettings` component accepts `[dinos]` + `[levels]`, renders a segmented 4-button control per dino iterating `REACTION_LEVELS` (no hardcoded literals), defaults to 'normal' via `currentLevel()` |
| 2 | Changing the setting observably changes that dino's reaction frequency/behavior in subsequent turns | VERIFIED (code) / HUMAN for behavioral proof | Backend: `never` clamp at line 289 of `group-agents.service.ts` is a deterministic `decision = { action: 'silent' }` BEFORE any LLM call; `rarely`/`chatty` inject distinct LEVEL_NUDGE lines into `buildDecisionPrompt`; `getLevels` called once per `streamGroup` turn; level threaded into `decideAction`. Decision.spec.ts pins the nudge invariants. Full behavioral proof deferred to HUMAN-UAT |
| 3 | For custom dinos, the authored "how it reacts" prompt and this setting compose predictably (precedence documented) | VERIFIED (code) / HUMAN for behavioral proof | Precedence documented in a `// PRECEDENCE NOTE:` comment in `decision.ts` lines 73-78: persona governs content/style, level governs frequency only. Nudge appended AFTER all persona/rules lines. `custom:` prefixed ids handled identically to built-in ids (DinoReactivityMap uses dinoId as key with no branching). Storybook story includes a `custom:abc-1` sample dino. Full behavioral proof (never overrides persona) deferred to HUMAN-UAT |
| 4 | Defaults preserve current behavior for users who never touch the setting | VERIFIED | `levels[dino.id] ?? 'normal'` is the fallback at every site (frontend `currentLevel()`, backend `(levels[dino.id] as ReactionLevel) ?? 'normal'`). `'normal'` maps to no entry in `LEVEL_NUDGE` → no nudge appended → `buildDecisionPrompt` output byte-identical to pre-Phase-43. Null-db degrades to `{}` → same `'normal'` default. Decision.spec.ts asserts `buildDecisionPrompt(..., 'normal')` equals the no-level call |

**Score:** 4/4 truths verified (behavioral SC#2 + SC#3 + SC#4 confirmation deferred to HUMAN-UAT)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `libs/shared-types/src/lib/dino.types.ts` | ReactionLevel, REACTION_LEVELS, DinoReactivityMap, SetReactivityRequest, ReactivityResponse | VERIFIED | All five exported at lines 137-157. `REACTION_LEVELS = ['never','rarely','normal','chatty']` as readonly array. No `any`. |
| `apps/backend/src/app/database/schema.ts` | dinoReactivity pgTable + DinoReactivityRow/NewDinoReactivityRow | VERIFIED | `dinoReactivity` pgTable defined at lines 132-146. `uniqueIndex('dino_reactivity_user_dino_idx').on(table.userId, table.dinoId)`. `DinoReactivityRow`/`NewDinoReactivityRow` exported at lines 160-161. |
| `apps/backend/src/app/agents/reactivity.service.ts` | ReactivityService get/set scoped by (userId, dinoId) with graceful degradation + level validation | VERIFIED | `getLevels` returns `{}` on null-db/empty userId; `setLevel` validates against `REACTION_LEVELS` throwing `BadRequestException` on unknown value; `onConflictDoUpdate` upsert; try/catch wraps DB ops returning safe values. No `any`. |
| `apps/backend/src/app/agents/reactivity.controller.ts` | REST GET/PUT for per-dino reaction levels | VERIFIED | `GET /dino-reactivity?userId=` → `{ levels }` and `PUT /dino-reactivity/:dinoId` body `{ userId, level }` → `{ dinoId, level }`. Thin controller delegating entirely to service. |
| `apps/backend/src/app/agents/group/decision.ts` | buildDecisionPrompt level nudge (normal = no-op) | VERIFIED | Optional 4th param `level: ReactionLevel = 'normal'`. `LEVEL_NUDGE` map for `rarely`/`chatty`. Nudge appended after persona/rules lines. `'normal'` has no LEVEL_NUDGE entry → no line added. |
| `libs/ui/src/lib/reactivity-settings/reactivity-settings.ts` | Presentational ReactivitySettings (Input dinos+levels, Output levelChanged) | VERIFIED | Standalone, OnPush, `selector: 'app-reactivity-settings'`. `@Input() dinos: DinoSummary[]`, `@Input() levels: DinoReactivityMap`, `@Output() levelChanged`. `currentLevel()` defaults to 'normal'. No injected services. |
| `libs/ui/src/lib/reactivity-settings/reactivity-settings.stories.ts` | Storybook story with sample inputs | VERIFIED | 4 stories (WithPresetLevels, AllNormal, Empty, SingleDino). Includes `custom:abc-1` dino to verify SC#3. |
| `apps/frontend/src/app/chat/reactivity.service.ts` | Smart ReactivityService: HTTP get/set + levels signal, scoped by loadUserId() | VERIFIED | `providedIn: 'root'`. `WritableSignal<DinoReactivityMap>` exposed readonly. `load()` issues GET. `setLevel()` updates signal optimistically then PUTs. `loadUserId()` for scoping. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GroupAgentsService.streamGroup` | `ReactivityService.getLevels` | Constructor injection; levels resolved once after `resolveRoster` | WIRED | `this.reactivity` injected in constructor (line 116); `await this.reactivity.getLevels(userId ?? '')` called at line 232 before the round loop |
| `GroupAgentsService.decideAction` | `buildDecisionPrompt` | `level` param passed as 4th argument | WIRED | `decideAction` signature has `level: ReactionLevel = 'normal'` (line 167); passed to `buildDecisionPrompt(profile, threadText, hasPriorDinoThisRound, level)` at line 172 |
| `GroupAgentsService` per-dino decide block | `never` clamp | `if (level === 'never' && !isForcedAnswer)` before image-gen/LLM branches | WIRED | Line 289 deterministically sets `decision = { action: 'silent' }` before image-gen check (line 291) and LLM call (line 296). Comment documents @mention exception. |
| `ChatComponent` (group-chat settings surface) | `ReactivitySettings` | `[dinos]+[levels]`, `(levelChanged)` in chat.html | WIRED | `ReactivitySettings` in `imports` array (line 22 of chat.ts); `reactivityPanelOpen` signal + `toggleReactivityPanel()` + `onLevelChanged()` at lines 674-687; `<app-reactivity-settings>` in chat.html lines 199-203 |
| `ReactivityService` (frontend) | `GET/PUT /api/dino-reactivity` | HttpClient with userId from loadUserId() | WIRED | `load()` issues `GET ${base}/dino-reactivity` with `userId` param; `setLevel()` PUTs to `${base}/dino-reactivity/${dinoId}` with `{ userId, level }` body |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ReactivitySettings` template | `dinos` input | `participantDinos()` computed signal in ChatComponent — filters `selectedGroupDinoIds()` via `groupDinoById()` | Yes — live signal from selected group | FLOWING |
| `ReactivitySettings` template | `levels` input | `reactivityService.levels()` signal — populated by `load()` via `GET /api/dino-reactivity` | Yes — HTTP from backend DB | FLOWING |
| `GroupAgentsService.streamGroup` | `levels: DinoReactivityMap` | `this.reactivity.getLevels(userId ?? '')` — DB select from `dinoReactivity` table | Yes — real DB query with graceful degradation | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for frontend (pre-existing Windows frontend runner issue, documented as infra blocker in STATE.md since Phase 35). Backend behavioral checks deferred to human verification (LLM-probabilistic behavior).

---

### Probe Execution

Step 7c: No probe scripts declared in PLAN.md and no `scripts/*/tests/probe-*.sh` discovered for this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GRP3-04 | 43-01-PLAN.md, 43-02-PLAN.md | Per-dino when-to-react configuration in group chat (mentor note: "konfiguracje when to react w group chat") | SATISFIED | ROADMAP SC#1-SC#4 all met in code: settings surface (ReactivitySettings), engine hook (never-clamp + level nudge), persistence (dinoReactivity table + ReactivityService), defaults ('normal' fallback). Behavioral confirmation pending HUMAN-UAT. |

**Orphaned requirements check:** REQUIREMENTS.md states "Mentor-feedback requirements (MEM2-01, GRP3-01..04, CDINO-01..04, UAT-01) for Phases 40–44 are captured in the ROADMAP phase details." GRP3-04 is the sole requirement for Phase 43 per ROADMAP.md line 784. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `libs/ui/src/lib/reactivity-settings/reactivity-settings.stories.ts` | 46 | `tags: ['autodocs']` | INFO | Storybook autodocs tag — not a debt marker, standard Storybook configuration |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 43 files. No stub implementations detected. No hardcoded empty arrays/objects passed as final rendered values.

**Pre-existing issues (not introduced by this phase, documented in 43-02-SUMMARY.md):**
- `nx test frontend` crashes on Windows (pre-existing infra bug since Phase 35) — frontend spec exists and is well-formed but cannot be run locally
- `nx build frontend` fails Angular CLI bundle-size budget check (pre-existing since Phase 41; TypeScript compilation succeeds)
- `@nx/enforce-module-boundaries` errors in `@chatbot/ui` lint (pre-existing since Phase 24)

---

### Human Verification Required

All four items are behavioral checks that require a live browser + DB-backed deploy. They map 1:1 to the four ROADMAP Success Criteria and are already documented in `43-HUMAN-UAT.md`.

#### 1. SC#1 — Group-chat settings panel is accessible and functional

**Test:** Navigate to Group chat, select 2-3 dinos, click "Reaction settings" toggle, interact with the per-dino segmented controls.
**Expected:** Panel opens/closes on toggle; each dino row shows avatar + name + 4-button segmented control (never/rarely/normal/chatty); clicking a level highlights it; DB row upserted per `SELECT * FROM dino_reactivity WHERE user_id = '<id>'`; dinos never configured show 'Normal'.
**Why human:** Angular signal rendering, panel toggle, DB upsert and optimistic UI update require a live browser + DB session.

#### 2. SC#2 — Changing the control observably changes reaction frequency

**Test:** Set one dino to 'chatty', send 5 varied prompts; change same dino to 'rarely', send 5 more. Observe answer vs react vs silent rates.
**Expected:** Chatty: dino answers more frequently than rarely. Rarely: dino more often produces only emoji reaction or stays silent. Content of answers is not materially different (level governs frequency, not tone).
**Why human:** LLM response frequency is probabilistic — requires live observation over multiple turns to confirm statistical bias.

#### 3. SC#3 — Level clamp overrides persona; custom dino covered identically

**Test:** Create a custom dino (Phase 42) that "loves chiming in". Add to group. Set to 'never'; send 5 messages without @mention; then @mention it; set to 'chatty', send 5 more.
**Expected:** At 'never' (no mention): zero output from dino. At 'never' + @mention: dino answers. At 'chatty': more frequent answers. Avatar/name renders identically to built-in dinos.
**Why human:** Requires Phase 42 deployed + live group engine. The 'never' clamp override of persona and the @mention exception need real turns.

#### 4. SC#4 — Untouched dinos behave exactly as before

**Test:** Select a dino never configured in Reaction settings. Verify no DB row. Confirm panel shows 'Normal'. Send several prompts without changing level.
**Expected:** Behavior identical to pre-Phase-43. Panel shows 'Normal'. No DB row created until user explicitly clicks a level.
**Why human:** Behavioral identity with pre-Phase-43 baseline requires live observation; DB absence check requires running DB.

---

### Gaps Summary

No gaps. All code artifacts are substantive, wired, and data flows are complete. The four ROADMAP Success Criteria are met in code; their behavioral confirmation is deferred to HUMAN-UAT as appropriate for a live-browser + LLM-dependent feature.

---

_Verified: 2026-06-19_
_Verifier: Claude (gsd-verifier)_
