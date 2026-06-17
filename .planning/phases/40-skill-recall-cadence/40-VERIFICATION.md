---
phase: 40-skill-recall-cadence
verified: 2026-06-17T00:00:00Z
status: human_needed
score: 3/3 roadmap success criteria code-complete; 1 HUMAN-UAT pending
overrides_applied: 0
human_verification:
  - test: "Start a conversation whose opening message matches one of 2-3 taught skills with distinct 'when to activate' triggers; observe the Knowledge panel"
    expected: "The hint 'Active skill this chat: <title>' appears for the matched skill; backend log shows 'Skill recall: selected <id> (<title>)'; sending follow-up turns in the same thread keeps the same skill hint (no drift)"
    why_human: "Requires a live backend with OPENROUTER_API_KEY set and DB with taught skills — cannot probe LLM scoring or SSE streaming in a static analysis environment"
  - test: "Start a fresh conversation whose opening message matches none of the taught skills"
    expected: "No 'Active skill this chat' hint appears; backend log shows 'Skill recall: no skill selected'; system prompt contains no STANDING INSTRUCTION block"
    why_human: "Requires live environment with actual LLM scorer responding NONE"
  - test: "Teach, edit, and delete a skill via the Skills manager while having an active-skill hint visible from a prior conversation"
    expected: "The teach/edit/delete flows complete normally and the hint does not interfere; the hint is read-only and has no edit/delete affordance of its own"
    why_human: "Requires UI interaction in a live browser to confirm the hint is truly read-only and does not disrupt the skill manager"
---

# Phase 40: Skill Recall Cadence — Verification Report

**Phase Goal:** "What it remembers" follows the mentor's cadence: once per conversation, the dino pulls its single most relevant learned skill into context — instead of re-injecting on every turn.
**Verified:** 2026-06-17
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | On the first turn of a thread, the dino retrieves exactly one skill — the most relevant to the user's opening message — and keeps it for the rest of the conversation (no per-turn re-selection) | VERIFIED (code-complete) | `agents.service.ts` L186-213: `openingMessage = history?.find(h => h.role === 'user')?.text ?? message`; `selectRelevantSkill` called once per `streamAgent` invocation and result stored in `selectedSkill` (not re-computed per turn); passed to `buildSystemPrompt` as a single `SkillView \| null` |
| SC-2 | Which skill was pulled is observable (UI hint in "what it remembers" / Knowledge surface, or at minimum backend log) | VERIFIED (code-complete) | Backend: `this.logger.log('Skill recall: selected <id> (<title>)')` at `agents.service.ts` L194-196 plus `yield { type: 'skill_active', skillId, skillTitle }` at L209-213. Frontend: `chat.ts` L1352-1355 `case 'skill_active'` sets `activeSkill` signal; `chat.html` L478-482 renders `@if (activeSkill()) { <p>Active skill this chat: <span>{{ activeSkill()!.title }}</span></p> }` in the Knowledge Skills section |
| SC-3 | Teach, edit, and manage flows are unchanged; conversations with no relevant skill inject nothing | VERIFIED (code-complete) | `buildSystemPrompt` (`agents.service.ts` L470-494) only emits the `## STANDING INSTRUCTION FOR THIS CONVERSATION` block when `skill !== null`; the old plural "apply ALL of them" string is absent from the entire file. `selectRelevantSkill` returns null immediately when `skills.length === 0` (L507). The `learnedSkills` signal in `chat.ts` L303 and `<app-skill-manager>` wiring in `chat.html` are untouched. Unit tests in `agents.service.spec.ts` L358-430 verify null-selection produces no STANDING INSTRUCTION block |

**Score:** 3/3 roadmap success criteria code-complete.

### Plan-level Must-Have Truths (from 40-01-PLAN.md and 40-02-PLAN.md)

| # | Truth | Status | Evidence (file:line) |
|---|-------|--------|----------------------|
| 1 | On a thread's first turn the backend selects exactly ONE taught skill via a cheap LLM scorer | VERIFIED | `agents.service.ts` L186-213 — one `await selectRelevantSkill(...)` call per `streamAgent` invocation |
| 2 | Selection is stable for the whole conversation (scored against opening message recoverable from history) | VERIFIED | `agents.service.ts` L186-187: `openingMessage = history?.find(h => h.role === 'user')?.text ?? message` — deterministic, same input on every turn of the thread |
| 3 | buildSystemPrompt injects at most one skill; null omits the block | VERIFIED | `agents.service.ts` L470-494 — signature `(basePrompt, skill: SkillView \| null, …)`; `if (skill)` guard at L477 |
| 4 | Scorer reuses cheap-model + try/catch + timeout pattern; never throws into chat | VERIFIED | `agents.service.ts` L502-550 — `MEMORY_EXTRACTION_MODEL`, `Promise.race` with 8 s `SCORER_TIMEOUT`, full `try/catch` returning `null` |
| 5 | Which skill was selected is logged via NestJS Logger | VERIFIED | `agents.service.ts` L193-199 — `this.logger.log('Skill recall: selected …')` or `'no skill selected'` |
| 6 | A `skill_active` StreamEvent (skillId, skillTitle) is yielded once when a skill is active; added to StreamEvent union | VERIFIED | `chat.types.ts` L152-156: `StreamSkillActiveEvent` interface; L164: added to `StreamEvent` union. `agents.service.ts` L208-214: `yield { type: 'skill_active', … }` before token loop |
| 7 | Teach/edit/delete/manage skill flows and memory (fact) injection are unchanged | VERIFIED | `buildSystemPrompt` memories block (L483-486) unchanged; `extractAndStoreMemories` (L557-591) unchanged; `learnedSkills` signal + `<app-skill-manager>` untouched |
| 8 | activeSkill signal declared in chat.ts; set in skill_active case with markForCheck | VERIFIED | `chat.ts` L303: `readonly activeSkill = signal<{ id: string; title: string } \| null>(null)`; L1352-1355: `case 'skill_active'` sets signal + `markForCheck()` |
| 9 | activeSkill reset on new conversation and session switch | VERIFIED | `chat.ts` L1058: `switchToSession` resets; L1106: `startNewChat` resets |
| 10 | UI hint shown in Knowledge Skills section; Tailwind only; read-only | VERIFIED | `chat.html` L478-482: `@if (activeSkill())` block with `text-xs text-jungle-ink-muted dark:text-jungle-night-muted` and `text-jungle-accent dark:text-jungle-night-accent font-medium`; no `style=` attribute; no edit/delete affordance |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `libs/shared-types/src/lib/chat.types.ts` | StreamSkillActiveEvent interface + skill_active in StreamEvent union | VERIFIED | L152-156 interface; L164 union member |
| `apps/backend/src/app/agents/agents.service.ts` | selectRelevantSkill scorer; single-skill buildSystemPrompt; skill_active emission + log in streamAgent | VERIFIED | L502-550 scorer; L470-494 buildSystemPrompt; L186-214 streamAgent wiring |
| `apps/frontend/src/app/chat/chat.ts` | activeSkill signal + skill_active case + reset on new conversation | VERIFIED | L303 signal; L1352-1355 case; L1058 + L1106 resets |
| `apps/frontend/src/app/chat/chat.html` | @if(activeSkill()) hint in Knowledge Skills section | VERIFIED | L478-482 |
| `apps/backend/src/app/agents/agents.service.spec.ts` | Unit tests: skill selected emits event + injects only selected skill; NONE injects nothing; zero skills injects nothing | VERIFIED | L307-430 three test cases in `describe('streamAgent — single-skill recall')` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `streamAgent` skill recall (openingMessage derivation) | `selectRelevantSkill(openingMessage, skills, signal)` | `history?.find(h => h.role === 'user')?.text ?? message` | WIRED | `agents.service.ts` L186-189 |
| `selectRelevantSkill` result | `buildSystemPrompt(dino.systemPrompt, selectedSkill, memories, directive)` | single `SkillView \| null` parameter | WIRED | `agents.service.ts` L202-204 |
| `selectedSkill` non-null | `yield { type: 'skill_active', … }` before token loop | `if (selectedSkill)` guard | WIRED | `agents.service.ts` L208-214 |
| `StreamSkillActiveEvent` in StreamEvent union | frontend `handleStreamEvent` switch | `case 'skill_active'` | WIRED | `chat.ts` L1352-1355 |
| `activeSkill` signal | `@if (activeSkill())` hint in Knowledge Skills section | Angular signal template binding | WIRED | `chat.html` L478-482 |
| `activeSkill` reset | `startNewChat()` and `switchToSession()` | `this.activeSkill.set(null)` | WIRED | `chat.ts` L1058, L1106 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `chat.html` hint | `activeSkill()` | `case 'skill_active'` SSE event from backend; `selectRelevantSkill` returns real `SkillView` from `memoryService.getSkills` | Yes — sourced from DB-backed `getSkills` call; passes `skillId` and `skillTitle` from the actual `SkillView` record | FLOWING |
| `buildSystemPrompt` STANDING INSTRUCTION block | `skill` param | `selectRelevantSkill` return value — `skills[index - 1]` where `index` is parsed from LLM scorer output | Yes — real DB skills array; scorer picks one by 1-based index | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for LLM-dependent behaviors — verifying that `selectRelevantSkill` actually calls the OpenRouter scorer endpoint and parses its reply requires a live `OPENROUTER_API_KEY` and network access. These checks are covered by the unit tests (scorer logic stubbed) and the HUMAN-UAT items below.

The following non-LLM checks can be verified structurally:

| Behavior | Evidence | Status |
|----------|----------|--------|
| `selectRelevantSkill` returns null immediately when skills array empty | `agents.service.ts` L507: `if (skills.length === 0) return null;` | PASS |
| `selectRelevantSkill` returns null when scorer replies NONE or unparseable | `agents.service.ts` L540-542: `if (raw.toUpperCase() === 'NONE' …) return null; index = parseInt(raw); if (isNaN(index) …) return null;` | PASS |
| 8-second timeout bounds scorer so it cannot stall the turn | `agents.service.ts` L530-536: `Promise.race` with `setTimeout(…, 8_000)` | PASS |
| Old "apply ALL of them in every single response" text removed | Absent from entire `agents.service.ts` (verified by reading L470-494 buildSystemPrompt) | PASS |
| Frontend hint uses Tailwind only (no inline styles) | `chat.html` L478-482: only class attributes, no `style=` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MEM2-01 | 40-01-PLAN.md, 40-02-PLAN.md | Once per conversation, pull the single most relevant taught skill (mentor cadence) | SATISFIED (code-complete) | Backend scorer + single-skill buildSystemPrompt + skill_active event + frontend hint all implemented and linked |

### Anti-Patterns Found

Scanning all files modified by this phase for debt markers and stubs:

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| `agents.service.ts` | None found | — | Clean |
| `chat.types.ts` | None found | — | Clean |
| `chat.ts` | None found | — | Clean |
| `chat.html` | None found | — | Clean |
| `agents.service.spec.ts` | None found | — | Clean |

No TBD, FIXME, XXX, placeholder, or stub patterns detected in phase-modified files.

---

## Human Verification Required

### 1. Skill is selected and visible for a matching conversation

**Test:** Run backend + frontend locally (or against production) with `DATABASE_URL` and `OPENROUTER_API_KEY` set. Teach the active dino 2-3 distinct skills with clearly distinct `when to activate` triggers. Start a new conversation whose opening message matches exactly ONE skill's trigger. Watch the Knowledge Skills section during streaming.

**Expected:** The "Active skill this chat: `<title>`" hint appears after the first response; the backend log line "Skill recall: selected `<id>` (`<title>`)" names the same skill; sending follow-up messages in the same thread keeps the same hint (no drift, no change).

**Why human:** Requires a live LLM scorer call over OPENROUTER_API_KEY to actually return an integer index; SSE streaming must propagate the `skill_active` event to the browser.

### 2. No hint for a no-match conversation

**Test:** Start a fresh conversation whose opening message is generic/unrelated to any taught skill.

**Expected:** No "Active skill this chat" hint appears in the Knowledge Skills section. Backend log shows "Skill recall: no skill selected". The STANDING INSTRUCTION block is absent from the system prompt (check via backend debug log if available).

**Why human:** Requires the live scorer to actually return NONE for the unrelated message.

### 3. Teach/edit/delete skill flows are unchanged

**Test:** With an active-skill hint visible from a prior conversation, switch to the Skills manager tab in the Knowledge panel. Teach a new skill, edit an existing skill's instruction, delete a skill.

**Expected:** All three CRUD operations complete normally. The active-skill hint for the current conversation does not interfere. The hint is purely informational with no edit/delete affordance.

**Why human:** UI interaction in a live browser required to confirm read-only nature and absence of interference with the skill manager.

---

## Gaps Summary

No gaps found. All three roadmap success criteria are code-complete with full implementation across shared-types, backend, frontend component, and unit test coverage. The only pending item is a live end-to-end UAT that cannot be executed in a static analysis environment because it requires an active OpenRouter API key, a populated database with taught skills, and SSE streaming observed in a browser.

---

_Verified: 2026-06-17_
_Verifier: Claude (gsd-verifier)_
