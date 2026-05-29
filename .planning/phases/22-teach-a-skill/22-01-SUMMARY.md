---
phase: 22-teach-a-skill
plan: 01
subsystem: backend
tags: [nestjs, drizzle, postgres, angular, tailwind, storybook, skills, memory-management]

requires:
  - phase: 21-cross-thread-memory
    provides: MemoryService (null-safe) + system-prompt injection seam + anonymous localStorage userId
  - phase: 18-dino-abstraction
    provides: dino registry; active-dino in chat header
provides:
  - "dino_skills table (userId, dinoId, title, instruction, createdAt) + (userId, dinoId) index"
  - "MemoryService skill methods: getSkills / addSkill (returns created) / deleteSkill — null-DB safe"
  - "SkillsController REST: GET /api/skills, POST /api/skills, DELETE /api/skills/:id, DELETE /api/memories/:id"
  - "Skills injected as a distinct, higher-authority system-prompt block (base -> skills -> memories)"
  - "Frontend SkillService + teach-a-skill overlay (title + instruction) in chat + presentational SkillManager (skills + memories, delete)"
affects: [dino-platform, memory, dino-groupchat]

tech-stack:
  added: []
  patterns:
    - "Skills reuse the Phase 21 (userId × dinoId) scoping but get their own table + prompt block (standing instructions vs auto-extracted facts)"
    - "Presentational SkillManager (inputs skills/memories, outputs skillDeleted/memoryDeleted, Storybook) + smart SkillService (HttpClient) — same split as DinoCard/DinoService"
    - "Controller uses Nest exceptions (BadRequest/ServiceUnavailable); all persistence logic stays in MemoryService"

key-files:
  created:
    - apps/backend/src/app/memory/skills.controller.ts
    - apps/frontend/src/app/chat/skill.service.ts
    - libs/ui/src/lib/skill-manager/skill-manager.ts
    - libs/ui/src/lib/skill-manager/skill-manager.html
    - libs/ui/src/lib/skill-manager/skill-manager.stories.ts
  modified:
    - apps/backend/src/app/database/schema.ts
    - apps/backend/src/app/memory/memory.service.ts
    - apps/backend/src/app/memory/memory.service.spec.ts
    - apps/backend/src/app/memory/memory.module.ts
    - apps/backend/src/app/agents/agents.service.ts
    - libs/shared-types/src/lib/dino.types.ts
    - libs/ui/src/index.ts
    - apps/frontend/src/app/chat/chat.service.ts
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html

key-decisions:
  - "A skill = { title, instruction } (durable prompt text, not executable code); v1 teach flow saves a typed title+instruction (guided-chat articulation deferred)"
  - "Skills inject as a separate labeled block above memories and are framed as standing instructions (higher authority than auto-extracted facts)"
  - "Refactored Phase 21's userId logic into exported loadUserId()/USER_ID_KEY in chat.service so SkillService reuses the same anonymous id (no divergence)"
  - "SkillsController owns both /api/skills and /api/memories/:id (one controller, explicit route paths under the global api prefix)"
  - "SkillManager kept presentational despite a domain word in its name — consistent with existing DinoCard/DinoPicker UI precedent"

patterns-established:
  - "Learned-items management surface (skills + memories with delete) reachable from the active-dino header via an overlay"

requirements-completed: [MEM-04, MEM-05, MEM-06]

duration: ~35min
completed: 2026-05-29
---

# Phase 22: Teach-a-Skill Summary

**Users can now teach a dino a durable, titled skill that auto-applies in every future chat with that dino, and review/delete everything a dino has learned (taught skills + auto-extracted memories) — built directly on the Phase 21 memory store.**

## Status: CODE-COMPLETE (live teach-once smoke test pending — Task 5)

Tasks 1–4 (the codeable work) are implemented and verified green. **Task 5** is the
manual teach-once smoke test, marked `autonomous: false` because it needs a live
`DATABASE_URL` (with `dino_skills` pushed via Drizzle) and a real `OPENROUTER_API_KEY`.
It has **not** been run here. The null-DB degradation path is unit-tested.

## Accomplishments
- `dino_skills` schema + `DinoSkill`/`NewDinoSkill` types; `getSkills`/`addSkill`/`deleteSkill` on MemoryService (null-DB safe, never throw).
- `SkillsController`: list (skills + memories), create skill, delete skill, delete memory — HTTP-only, Nest exceptions for bad input; shared `DinoSkill` + `LearnedItems` types.
- Agent loop assembles base prompt → skills block ("standing instructions") → memories block; empty blocks omitted; null-DB safe.
- Frontend: `SkillService` (HttpClient, reuses the anonymous userId), a "Teach {dino}" header button + overlay (title/instruction + save), and a presentational `SkillManager` (lists skills + memories with delete) plus its Storybook stories; exported from `@chatbot/ui`.

## Verification
- Backend Vitest via `apps/backend/vitest.run.mjs`: **35 tests / 4 files pass** (5 new skill tests: null-DB no-op, scoping, addSkill returns created, empty-input null).
- `nx lint @org/backend,@org/shared-types,frontend` ✓ (only the pre-existing `main.ts` no-console warning).
- `nx build @chatbot/ui` ✓ (SkillManager) · `nx build frontend` (AOT) ✓ — validates the chat overlay + SkillManager template since frontend unit specs are unrunnable on this machine.

## Task Commits
Per project convention (1 commit per GSD session, squashed), Tasks 1–4 plus this
SUMMARY and tracking updates land in a single phase commit.

## Follow-up (human)
- **Task 5 — teach-once smoke test:** with `DATABASE_URL` + `OPENROUTER_API_KEY` set and `dino_skills` pushed (`drizzle-kit push`): teach rexford "Always answer in British English." → start a NEW chat with rexford → confirm it applies without re-teaching → open the manager, delete the skill → confirm it stops applying → confirm veloce is unaffected (per-dino isolation).

## Threats / Notes
- Skill instructions are user-authored standing instructions (trusted-by-owner); cross-user isolation rests on the (userId, dinoId) filter (T-22-01).
- Anonymous userId is spoofable (no auth) — accepted for v1; hardened by AUTH-01 later (T-22-02).
