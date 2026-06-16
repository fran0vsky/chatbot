---
phase: 38-production-runtime-parity
plan: 03
subsystem: api
tags: [nestjs, drizzle, postgres, migrations, cloud-sql, docker]

# Dependency graph
requires:
  - phase: 38-01
    provides: main.ts with BODY_LIMIT body-parser calls (preserved in this plan)
provides:
  - connection.ts — shared buildPoolConfig(url) for Cloud SQL SSL/socket normalization
  - migrate.ts — guarded boot-time runMigrations() via drizzle-orm migrate()
  - apps/backend/drizzle/ — baseline SQL migration (IF NOT EXISTS) + meta journal
  - Dockerfile — drizzle/ folder copied into runtime image at /app/drizzle
  - main.ts — await runMigrations() wired before app.listen
affects: [phase-39-smoke-checks, phase-44-uat-sweep]

# Tech tracking
tech-stack:
  added:
    - "drizzle-orm/node-postgres/migrator — migrate() for boot-time SQL migration"
  patterns:
    - "buildPoolConfig(url): PoolConfig — shared Cloud SQL connection normalization (unix-socket vs public-IP SSL)"
    - "runMigrations() guard pattern — returns early when DATABASE_URL unset, mirrors null-db degradation"
    - "D-05 IF NOT EXISTS baseline — baseline migration safe on existing prod DB (no-op) and fresh DB (full create)"
    - "D-06 fail-fast on migration error — re-throw before app.listen so bad migration is visible, not silent"

key-files:
  created:
    - apps/backend/src/app/database/connection.ts
    - apps/backend/src/app/database/migrate.ts
    - apps/backend/drizzle/0000_burly_james_howlett.sql
    - apps/backend/drizzle/meta/_journal.json
    - apps/backend/drizzle/meta/0000_snapshot.json
  modified:
    - apps/backend/src/app/database/database.module.ts
    - apps/backend/src/main.ts
    - apps/backend/Dockerfile

key-decisions:
  - "D-01: Boot-time migrate() (not CI push) — devDep absence and Cloud SQL authorized-networks make CI-side migration infeasible"
  - "D-02: Shared buildPoolConfig helper — connection.ts exports the logic; database.module.ts and migrate.ts both use it (byte-for-byte identical SSL behavior)"
  - "D-03: Guarded degradation — runMigrations() no-ops when DATABASE_URL is unset (local/e2e), matching module null-db path"
  - "D-04: Migrations folder resolution — MIGRATIONS_DIR env override or join(__dirname, '..', 'drizzle') = /app/drizzle at runtime"
  - "D-05: IF NOT EXISTS baseline — avoids 'relation already exists' on existing prod DB; applies cleanly on fresh DB; future migrations are plain ALTER TABLE"
  - "D-06: Fail-fast on error — re-throw before listen so a bad migration prevents new container becoming healthy; old container keeps serving; visible in deploy logs"

requirements-completed: [PROD-03]

# Metrics
duration: 25min
completed: 2026-06-16
---

# Phase 38 Plan 03: Auto DB Migrations at Boot Summary

**Boot-time drizzle migrate() established via shared buildPoolConfig helper, guarded runMigrations() runner, IF NOT EXISTS baseline migration, and Dockerfile drizzle-folder copy — eliminating the manual drizzle-kit push / ALTER TABLE workflow that silently drifted prod behind the schema**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-16T21:10:00Z
- **Completed:** 2026-06-16T21:35:00Z
- **Tasks:** 5 of 6 auto-executed (Task 6 is manual dev-DB proof — human required)
- **Files created:** 5
- **Files modified:** 3

## Accomplishments

- `connection.ts` — exports `buildPoolConfig(url: string): PoolConfig`; unix-socket detection (`/cloudsql/` or `host=/`) leaves URL untouched with no ssl; public-IP branch strips `sslmode`/`uselibpqcompat` params and sets `ssl: { rejectUnauthorized: false }`. No `any`.
- `database.module.ts` — refactored to call `buildPoolConfig(url)` spread into Pool options; inline regex no longer in module; null-db guard, pool error handler, and drizzle wiring unchanged; build passes.
- `migrate.ts` — exports `runMigrations(): Promise<void>`; guards on `DATABASE_URL` (log + return when unset); resolves `migrationsFolder` from `MIGRATIONS_DIR` env or `join(__dirname, '..', 'drizzle')`; calls `migrate(drizzle(pool), { migrationsFolder })`; closes pool in finally; on error logs an unmistakable 3-line error banner and re-throws (fail-fast D-06). Uses NestJS `Logger`, no `console`, no `any`.
- `apps/backend/drizzle/0000_burly_james_howlett.sql` — drizzle-kit generated baseline covering all 5 tables (sessions, messages, user_memories, dino_skills, dino_ratings) and 5 indexes; hand-edited to `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` throughout. Verify script confirms 5/5 tables and 5/5 indexes are IF NOT EXISTS.
- `main.ts` — `await runMigrations()` wired immediately before `app.listen`; 38-01's `useBodyParser` calls for json and urlencoded preserved intact.
- `Dockerfile` — runner stage copies `apps/backend/drizzle ./drizzle` alongside dist/frontend/package so `/app/drizzle` is present at runtime.

## Task Commits

1. **Task 1: Extract buildPoolConfig** - `e6f68bc` (feat)
2. **Task 2: Refactor database.module.ts** - `67012d0` (refactor)
3. **Task 3: Create migrate.ts** - `8123722` (feat)
4. **Task 4: Generate + baseline migration** - `1e1974c` (feat)
5. **Task 5: Wire boot + Dockerfile** - `ec1f36f` (feat)
6. **Task 6: Prove pipeline on dev DB** - PENDING HUMAN (manual, autonomous=false)

## Deviations from Plan

None — plan executed exactly as written. The IF NOT EXISTS baseline approach (D-05) was chosen over the alternative (manually inserting a `__drizzle_migrations` row in prod) as recommended in the design decisions; the alternative is documented in the plan for operator reference.

## User Setup Required

**Task 6 requires manual dev-DB proof.** With `DATABASE_URL` pointing to `spinochat_dev`:

1. Start the backend: `npx nx serve @org/backend`
2. Confirm boot logs show "Running migrations from: ..." and "Migrations completed successfully" with no "relation already exists" error (baseline no-op on existing tables)
3. Add a throwaway nullable column to one table in `schema.ts`
4. Run `npx drizzle-kit generate --config=apps/backend/drizzle.config.ts` — produces `0001_*.sql` with an ALTER TABLE
5. Restart the backend — confirm the column appears in `spinochat_dev` WITHOUT a manual push
6. Revert the throwaway column from `schema.ts` + delete the `0001_*` files so only the baseline remains committed
7. Confirm a fresh empty DB gets all 5 tables created from scratch by the baseline

The first prod deploy after merging this plan will baseline prod: the baseline migration will be recorded as applied in `__drizzle_migrations`, and all 5 IF NOT EXISTS creates will no-op on the existing tables.

## Known Stubs

None.

## Threat Flags

None beyond those addressed in the plan's threat model:
- T-38-03-01 (Data integrity / existing prod DB): mitigated by IF NOT EXISTS baseline
- T-38-03-02 (Availability / failed migration): mitigated by fail-fast D-06 (re-throw before listen)
- T-38-03-03 (Information Disclosure / DATABASE_URL): accepted (same exposure as runtime pool)
- T-38-03-04 (Concurrency / two containers migrating): mitigated by drizzle advisory lock + sequential deploy

## Self-Check: PASSED

- connection.ts exists: FOUND
- migrate.ts exists: FOUND
- drizzle/0000_burly_james_howlett.sql exists: FOUND
- drizzle/meta/_journal.json exists: FOUND
- drizzle/meta/0000_snapshot.json exists: FOUND
- All commits verified in git log: e6f68bc, 67012d0, 8123722, 1e1974c, ec1f36f
- Verify script (5 tables IF NOT EXISTS, 5 indexes IF NOT EXISTS): PASSED
- Backend build: webpack compiled successfully
