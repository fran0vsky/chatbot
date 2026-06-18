---
phase: 42-custom-dino-creator
plan: "01"
subsystem: backend
tags: [custom-dinos, persistence, api, drizzle, nestjs, validation]
dependency_graph:
  requires: []
  provides:
    - customDinos drizzle table (schema.ts)
    - CustomDinoService CRUD
    - CustomDinosController REST API
    - MODEL_CATALOGUE + isAllowedModel guard
    - CustomDino / CreateCustomDinoRequest / UpdateCustomDinoRequest / CuratedModel shared types
  affects:
    - apps/backend (AgentsModule)
    - libs/shared-types (dino.types.ts)
tech_stack:
  added:
    - custom_dinos pgTable (Drizzle ORM)
    - CustomDinoService (NestJS @Injectable)
    - CustomDinosController (NestJS @Controller)
    - model-catalogue.ts (pure module, no framework dep)
  patterns:
    - graceful-degradation CRUD (null-db guard + try/catch, mirrors MemoryService)
    - custom: id prefix namespace (D-02)
    - explicit projection allowlist (toCustomDinoSummary, mirrors toDinoSummary)
    - curated model catalogue as single source of truth (D-04)
key_files:
  created:
    - apps/backend/src/app/agents/model-catalogue.ts
    - apps/backend/src/app/agents/custom-dinos.service.ts
    - apps/backend/src/app/agents/custom-dinos.controller.ts
    - apps/backend/src/app/agents/custom-dinos.service.spec.ts
  modified:
    - libs/shared-types/src/lib/dino.types.ts
    - apps/backend/src/app/database/schema.ts
    - apps/backend/src/app/agents/agents.module.ts
    - .env.example
decisions:
  - "custom: id prefix applied in service, raw uuid stored in DB (D-02)"
  - "MODEL_CATALOGUE seeded from free registry models; paid image model excluded (D-03/D-04)"
  - "toCustomDinoSummary uses explicit allowlist — systemPrompt can never leak (D-05)"
  - "AVATAR_BUCKET documented in .env.example now; upload endpoint deferred to Plan 02"
metrics:
  duration: "~40 min"
  completed: "2026-06-18"
  tasks_completed: 6
  files_changed: 8
---

# Phase 42 Plan 01: Custom Dino Creator — Data + API Foundation Summary

**One-liner:** `custom_dinos` Drizzle table + scoped CRUD service + REST controller with model/tool validation, graceful degradation, and `custom:` id prefix namespace.

## Tasks Completed

| # | Name | Commit | Key files |
|---|------|--------|-----------|
| 1 | Add custom dino + catalogue shared types | e5b3630 | libs/shared-types/src/lib/dino.types.ts |
| 2 | Add custom_dinos table to drizzle schema | eb2ff80 | apps/backend/src/app/database/schema.ts |
| 3 | Curated model catalogue + guard | d711f7b | apps/backend/src/app/agents/model-catalogue.ts |
| 4 | CustomDinoService (CRUD + validation + degradation) | 92bba64 | apps/backend/src/app/agents/custom-dinos.service.ts |
| 5 | CustomDinosController + /api/models + module wiring | afb0d49 | custom-dinos.controller.ts, agents.module.ts, .env.example |
| 6 | Unit tests — validation, scoping, id prefix, summary | ff20b00 | apps/backend/src/app/agents/custom-dinos.service.spec.ts |

## What Was Built

### Shared Types (libs/shared-types)
- `CustomDino` — full persisted shape including `systemPrompt` (server-to-server only)
- `CreateCustomDinoRequest` / `UpdateCustomDinoRequest` — REST request bodies
- `CuratedModel { id, label }` — model catalogue entry

### Drizzle Schema (apps/backend/src/app/database/schema.ts)
- `customDinos` pgTable: uuid pk, userId, name, species, avatarUrl, blurb, persona, systemPrompt, model, toolNames (jsonb), accent, createdAt, updatedAt
- `userId` index following `dinoSkills` / `userMemories` convention
- `CustomDinoRow` / `NewCustomDinoRow` inferred types exported

### Model Catalogue (model-catalogue.ts)
- `MODEL_CATALOGUE: CuratedModel[]` — 5 free/cheap OpenRouter models from the built-in dino registry (Llama 3.3 70B, GPT-OSS 20B, GPT-OSS 120B, Nemotron Nano 30B, Nemotron Nano 12B VL)
- Paid image model (Vinci's gemini-2.5-flash-image) explicitly excluded
- `isAllowedModel(id)` — O(1) guard using a Set

### CustomDinoService (custom-dinos.service.ts)
- `create / list / getById / update / delete` — all scoped by `userId`
- Null-db guard + try/catch on every DB op: returns `[]` / `null` / void for infra failures, never throws
- Validation throws `BadRequestException` for: empty name/systemPrompt, model not in catalogue, toolName not in `{get_current_time, web_search, fetch_page}`
- `custom:` id prefix: public ids are `custom:<uuid>`, raw uuid stored in DB; prefix stripped on lookups
- `toCustomDinoSummary(row)` — explicit allowlist projection, no `systemPrompt`, no `userId`

### CustomDinosController (custom-dinos.controller.ts)
- `POST /custom-dinos` — create
- `GET /custom-dinos?userId=` — list
- `PUT /custom-dinos/:id?userId=` — update
- `DELETE /custom-dinos/:id?userId=` — delete
- `GET /models` — returns `MODEL_CATALOGUE`
- Thin: all business logic delegated to service

### Module Wiring
- `CustomDinoService` added to `AgentsModule` providers
- `CustomDinosController` added to `AgentsModule` controllers

### Env Contract
- `AVATAR_BUCKET=` documented in `.env.example` (consumed by Plan 02 upload endpoint)

## Verification

- `npx nx lint @org/backend` — green
- `npx nx build @org/backend` — green (webpack compiled successfully)
- `npx nx test @org/backend` — 15 test files, 175 tests all passing (was 166 before this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data or hardcoded empty values that affect plan goal delivery. `avatarUrl` is an optional string column; the upload endpoint that populates it is explicitly scoped to Plan 02.

## Threat Surface Scan

The new `/api/custom-dinos` endpoints and `/api/models` are covered by the plan's threat model (T-42-01-01 through T-42-01-04). No new security-relevant surface beyond what was analyzed:
- T-42-01-01: userId scoping applied on every query (accepted — anonymous-device identity, same as memories/skills)
- T-42-01-02: toolNames validated against ALLOWED_TOOLS on create/update (mitigated)
- T-42-01-03: model validated via isAllowedModel on create/update (mitigated)
- T-42-01-04: toCustomDinoSummary explicit allowlist excludes systemPrompt (mitigated)

## Self-Check: PASSED

Files exist:
- apps/backend/src/app/agents/model-catalogue.ts — FOUND
- apps/backend/src/app/agents/custom-dinos.service.ts — FOUND
- apps/backend/src/app/agents/custom-dinos.controller.ts — FOUND
- apps/backend/src/app/agents/custom-dinos.service.spec.ts — FOUND
- libs/shared-types/src/lib/dino.types.ts — FOUND (modified)
- apps/backend/src/app/database/schema.ts — FOUND (modified)

Commits exist: e5b3630, eb2ff80, d711f7b, 92bba64, afb0d49, ff20b00 — all verified in git log.
