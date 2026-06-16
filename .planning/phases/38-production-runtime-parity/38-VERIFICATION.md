# Phase 38 — Production Runtime Parity — Verification

**Verdict:** ACHIEVED (code-complete) — live/production confirmation pending HUMAN-UAT
**Date:** 2026-06-16
**Method:** Goal-backward trace of PROD-01/02/03 to delivered code + backend build gate
**Build gate:** `npx nx build @org/backend` — PASSED (both `main.ts` edits integrate)

## Requirement trace

### PROD-02 — Raised request-body limit (38-01) ✅
- `apps/backend/src/main.ts:21-23` — `BODY_LIMIT` env (default `10mb`) applied via `app.useBodyParser('json'|'urlencoded', { limit })` on the NestExpress app before `listen`.
- `.env.example` documents `BODY_LIMIT=10mb`.
- Replaces the Express default 100 kb limit so base64 image attachments + capped history no longer 413.

### PROD-01 — Tavily key wired through deploy (38-02) ✅
- `scripts/vm-deploy.sh:59` fetches `tavily-api-key` from Secret Manager (`|| echo ""` graceful fallback); `:81` injects `-e TAVILY_API_KEY` into the backend container.
- `.planning/INFRASTRUCTURE.md` documents the `tavily-api-key` secret + one-time `gcloud secrets create` command.
- `.env.example` already carried `TAVILY_API_KEY` (Phase 31); audit confirmed all 7 backend-read vars present.

### PROD-03 — Automated DB migrations at boot (38-03) ✅
- `apps/backend/src/app/database/migrate.ts` — `runMigrations()`: `DATABASE_URL` guard (skips locally), `MIGRATIONS_DIR` override or `__dirname/../drizzle`, runs drizzle `migrate()`, closes pool, fail-fast re-throw on error.
- `apps/backend/src/main.ts:34` — `await runMigrations()` before `app.listen`.
- `apps/backend/drizzle/0000_*.sql` — baseline with `IF NOT EXISTS` (10 = 5 tables + 5 indexes); no-op on existing prod DB, full-create on fresh DB. Closes the silent `when_to_activate`-style drift gap.
- `apps/backend/Dockerfile:39` copies `drizzle/` into the runner stage so migrations ship in the image.
- `connection.ts` — shared `buildPoolConfig()` keeps the public-IP SSL `rejectUnauthorized:false` path (per known Cloud SQL gotcha).

## Outstanding HUMAN-UAT (blocks live confirmation, not code completeness)

1. **38-01 Task 3:** Serve backend with `OPENROUTER_API_KEY`, POST a chat with a ~300–800 KB base64 `imageDataUrl` to a vision dino (e.g. `iris`) → expect 200 + SSE, not 413; confirm normal text chat still streams.
2. **38-02 Task 4:** Create a free Tavily key, `gcloud secrets create tavily-api-key --project=chatbot-franek-2026`, grant the VM service account access, deploy, then confirm real `web_search` results on https://dinoagents.duckdns.org.
3. **38-03 Task 6:** Prove the migration pipeline on `spinochat_dev` — baseline no-ops on existing tables; add a throwaway column + `drizzle-kit generate` + restart → column auto-appears; then revert; confirm fresh-DB full create.

## Conclusion

All three requirements are delivered in code and the backend compiles. Phase goal is met at the code level; the three deferred items are deployment/runtime smoke tests requiring a live VM and API keys.
