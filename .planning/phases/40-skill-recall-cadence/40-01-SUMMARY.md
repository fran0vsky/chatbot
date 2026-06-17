---
phase: 40-skill-recall-cadence
plan: "01"
subsystem: backend-agent-loop
tags: [skill-recall, agent-loop, shared-types, streaming, unit-tests]
dependency_graph:
  requires: []
  provides: [StreamSkillActiveEvent, selectRelevantSkill, single-skill-buildSystemPrompt, skill_active-emission]
  affects: [apps/backend/src/app/agents/agents.service.ts, libs/shared-types/src/lib/chat.types.ts]
tech_stack:
  added: []
  patterns: [cheap-LLM-scorer-with-try-catch-timeout, single-skill-system-prompt-injection]
key_files:
  created: []
  modified:
    - libs/shared-types/src/lib/chat.types.ts
    - apps/backend/src/app/agents/agents.service.ts
    - apps/backend/src/app/agents/agents.service.spec.ts
decisions:
  - "D-01: Opening message derived from first history role:'user' item, else current message — guarantees same skill selected every turn of the thread without DB persistence"
  - "D-02: Scorer returns 1-based integer index or NONE; mapped back to SkillView in-process (no ID parsing needed)"
  - "D-03: buildSystemPrompt signature changed from skills: SkillView[] to skill: SkillView | null — cleaner, enforces single-skill at the type level"
  - "D-04: 8s internal timeout on scorer via Promise.race — separates scorer latency guard from the main LLM_TIMEOUT_MS so a slow free model cannot stall the turn"
  - "D-05: allInvocations tracking in test mock (call order: scorer=0, mainLLM=1, memoryExtractor=2) to isolate system prompt assertions from fire-and-forget memory extraction"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-17"
  tasks_completed: 5
  files_changed: 3
---

# Phase 40 Plan 01: Skill Recall Cadence (Backend) Summary

**One-liner:** Single-skill LLM scorer selecting the most relevant taught skill once per conversation, injected as a standing instruction, with skill_active stream event and full test coverage.

## What Was Built

Replaced the "inject all taught skills every turn" recall path with a mentor-cadence retrieval:

1. **StreamSkillActiveEvent** — new interface (`type: 'skill_active'`, `skillId`, `skillTitle`) added to the `StreamEvent` union in shared-types. The controller's existing `write(event)` bridge forwards it automatically — no controller change needed.

2. **selectRelevantSkill** — private async method in `AgentsService`. Uses `MEMORY_EXTRACTION_MODEL` (same ChatOpenAI/OpenRouter config as `extractAndStoreMemories`). Lists skills as `N. title — use when: trigger` and asks the model for a single integer index or `NONE`. Whole body in try/catch returning `null`; bounded by an 8 s internal timeout via `Promise.race` so a slow free model cannot stall the chat (T-40-01-01 mitigated).

3. **buildSystemPrompt** — signature changed from `skills: SkillView[]` to `skill: SkillView | null`. Emits a single `## STANDING INSTRUCTION FOR THIS CONVERSATION` block when a skill is present; omits the block entirely when null. The old plural "apply ALL of them in every single response" framing is gone.

4. **streamAgent wiring** — derives `openingMessage` from `history?.find(h => h.role === 'user')?.text ?? message` (stable across all turns of the thread). Calls `selectRelevantSkill`, logs the choice via `NestJS Logger`, yields `skill_active` event before the token loop, and passes the single selected skill to `buildSystemPrompt`.

5. **Unit tests** — extended mock tracks all ChatOpenAI invocations in call order (scorer=index 0, main LLM=index 1, memory extractor=index 2). Three new test cases: skill selected (event emitted, only selected skill in system prompt), scorer returns NONE (no event, no block), zero skills (no scorer call, no event, no block). All 143 backend tests pass.

## Deviations from Plan

**1. [Rule 1 - Bug] buildSystemPrompt temporary null wiring during Task 3**
- **Found during:** Task 3 — changing signature to `skill: SkillView | null` would break the existing call site with the array argument; needed to compile before Task 4 wired it up properly
- **Fix:** Passed `null` temporarily in Task 3 commit; Task 4 replaced it with `selectedSkill`
- **Files modified:** `agents.service.ts`
- **Impact:** None — Task 3 commit compiles but would inject nothing; Task 4 completes the wiring

**2. Test mock design — allInvocations tracking**
- **Found during:** Task 5 — the fire-and-forget `extractAndStoreMemories` call overwrote `captured.messages` making system-prompt assertions against the last captured message unreliable
- **Fix:** Extended mock to track all invocations in `allInvocations[]`; tests inspect `allInvocations[1]` (main LLM) rather than last `captured.messages`
- **Files modified:** `agents.service.spec.ts`

## Known Stubs

None — the plan's goal is code-complete. Plan 02 will wire the `skill_active` event to the frontend UI hint.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The scorer is an outbound call to the existing OpenRouter endpoint (same as `extractAndStoreMemories`) under the same `OPENROUTER_API_KEY`. The `skill_active` event carries only the user's own skill id/title back to the same user's client (T-40-01-03 accepted by design).

## Self-Check

### Files exist:
- `libs/shared-types/src/lib/chat.types.ts` — FOUND (contains StreamSkillActiveEvent)
- `apps/backend/src/app/agents/agents.service.ts` — FOUND (contains selectRelevantSkill)
- `apps/backend/src/app/agents/agents.service.spec.ts` — FOUND (contains skill recall tests)

### Commits:
- `0e928be` feat(40-01): add StreamSkillActiveEvent to StreamEvent union
- `061fc80` feat(40-01): add selectRelevantSkill cheap-LLM scorer
- `1058efb` feat(40-01): change buildSystemPrompt to single-skill injection
- `81d9c6c` feat(40-01): wire selectRelevantSkill + skill_active emission into streamAgent
- `7d27b75` test(40-01): add unit coverage for single-skill recall

## Self-Check: PASSED
