---
phase: 21-cross-thread-memory
plan: 01
subsystem: backend
tags: [nestjs, drizzle, postgres, langchain, memory, angular, anonymous-identity]

requires:
  - phase: 18-dino-abstraction
    provides: dino registry (server-side model + system prompt + toolNames); stateless manual agent loop
  - phase: 12-spinochat-foundation
    provides: DatabaseModule (@Global) with null-safe DATABASE_CONNECTION ({ db, pool })
provides:
  - "user_memories table scoped by (userId × dinoId) with a composite index"
  - "MemoryService — null-safe get/write/list/delete of per-(user×dino) durable facts; never throws into callers"
  - "Anonymous per-device userId (localStorage) plumbed client → ChatRequest → controller → agent loop"
  - "Within-thread history replayed into the agent loop (closes the prior stateless single-HumanMessage gap)"
  - "Memory injection: recent memories appended to the dino system prompt; best-effort post-turn fact extraction"
affects: [dino-platform, memory, teach-a-skill, dino-groupchat]

tech-stack:
  added: []
  patterns:
    - "First consumer of DATABASE_CONNECTION — @Inject(token) into a service; guard db for null on every method"
    - "Best-effort, fire-and-forget side effect after 'done' (void promise) so memory extraction never blocks/breaks the stream"
    - "Cheap secondary model (openai/gpt-oss-20b:free) for durable-fact extraction, separate from the chat model"

key-files:
  created:
    - apps/backend/src/app/memory/memory.service.ts
    - apps/backend/src/app/memory/memory.module.ts
    - apps/backend/src/app/memory/memory.service.spec.ts
  modified:
    - apps/backend/src/app/database/schema.ts
    - apps/backend/src/app/app.module.ts
    - apps/backend/src/app/agents/agents.service.ts
    - apps/backend/src/app/agents/agents.module.ts
    - apps/backend/src/app/agents/agents.controller.ts
    - libs/shared-types/src/lib/chat.types.ts
    - apps/frontend/src/app/chat/chat.service.ts
    - apps/frontend/src/app/chat/chat.ts

key-decisions:
  - "Memory v1 is most-recent-N plain-text facts injected into the prompt — NOT vector search (free + simple; semantic retrieval deferred)"
  - "Memory block + extraction gated on (dino AND userId); the no-dino path keeps its prior no-system-message shape"
  - "History IS replayed in both dino and no-dino paths — the stateless-loop fix is a must_have and applies generally"
  - "Extraction runs fire-and-forget after yielding 'done', wrapped in try/catch — a failure never affects the chat"
  - "Anonymous userId persisted in localStorage (spino-user-id); ephemeral fallback when storage is unavailable"

patterns-established:
  - "Per-(user×dino) memory rows at user_memories; query always filters by BOTH userId AND dinoId (cross-dino isolation)"
  - "MemoryService de-dupes on identical content per (user×dino) and caps retrieval to bound prompt + DoS growth"

requirements-completed: [MEM-01, MEM-02, MEM-03]

duration: ~40min
completed: 2026-05-29
---

# Phase 21: Cross-Thread Memory Summary

**Each dino now has a persistent, per-user memory that carries across threads — backed by a (userId × dinoId)-scoped `user_memories` table, injected into the system prompt, and fed by best-effort post-turn fact extraction; within-thread history is also now replayed, closing the long-standing stateless-loop gap.**

## Status: CODE-COMPLETE (live E2E smoke test pending — Task 5)

Tasks 1–4 (the codeable work) are implemented and verified green. **Task 5** is the
manual cross-thread smoke test, marked `autonomous: false` in the plan because it
needs a live `DATABASE_URL` (with the new table pushed via Drizzle) and a real
`OPENROUTER_API_KEY`. It has **not** been run here. The null-DB degradation path is
unit-tested, but same-dino cross-thread recall and cross-dino isolation should be
confirmed end-to-end before the phase is treated as fully proven.

## Accomplishments
- `user_memories` schema (userId, dinoId, content, source, createdAt) + `(userId, dinoId)` index; `UserMemory`/`NewUserMemory` types.
- `MemoryService` + `MemoryModule`: get/write/list/delete scoped per (userId × dinoId); null-DB no-ops; de-dupes identical content; never throws.
- `userId` (anonymous, localStorage-persisted) + capped `history` plumbed end-to-end through `ChatRequest`, controller, and `streamAgent`.
- Agent loop injects a "What you remember about this user" block into the dino prompt and replays recent turns; after each turn it best-effort extracts 0–3 durable facts via a cheap model and stores them.

## Verification
- `nx lint @org/backend` ✓ · `nx lint @org/shared-types` ✓ · `nx lint frontend` ✓ (only pre-existing `main.ts` no-console warning)
- `nx build frontend` (AOT) ✓ — validates `chat.ts` / `chat.service.ts` since frontend unit specs are unrunnable on this machine
- Backend Vitest via `apps/backend/vitest.run.mjs`: **30 tests / 4 files pass**, including the new `memory.service.spec.ts` (null-DB no-op, scoping, de-dupe, empty-content)

## Task Commits
Per project convention (1 commit per GSD session, squashed), Tasks 1–4 plus this
SUMMARY and tracking updates land in a single phase commit rather than per-task commits.

## Follow-up (human)
- **Task 5 — cross-thread memory smoke test:** with `DATABASE_URL` + `OPENROUTER_API_KEY` set and the `user_memories` table pushed (`drizzle-kit push`): (1) tell dino *rexford* a fact in thread A; (2) ask in a new thread B (same dino) → should recall; (3) ask dino *veloce* in thread C → should NOT know; (4) unset `DATABASE_URL` → no crash, no recall.

## Threats / Notes
- Anonymous userId is spoofable (no auth) — accepted for v1; real isolation arrives with AUTH-01.
- Stored facts are model-extracted untrusted text injected as context (prompt-injection surface) — flagged as future hardening (T-21-03).
