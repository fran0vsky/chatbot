---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: — Production Parity & Custom Dinos
status: executing
stopped_at: Phase 43 context gathered
last_updated: "2026-06-18T23:20:36.623Z"
last_activity: 2026-06-18
progress:
  total_phases: 11
  completed_phases: 9
  total_plans: 31
  completed_plans: 32
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-04 — DinoAgents rebrand)

**Core value:** A user can open the app, type a message, get a real answer, and keep the conversation going.
**Current focus:** Phase 42 — custom-dino-creator

## Current Position

Phase: 42 (custom-dino-creator) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-06-18

## Performance Metrics

**Velocity:**

- Total plans completed: 13
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Working Chat | 3 | — | — |
| 2. Choose Your Model | 2 | — | — |
| 12 | 3 | - | - |
| 24 | 1 | - | - |
| Phase 42 P03 | 35 | 7 tasks | 9 files |

## Accumulated Context

### Roadmap Evolution

- Phase 3 added: UI/UX Refinement Phase
- Phase 4 added: Dark Theme and Visual Polish
- Phase 8 added: Chat History Sidebar
- Phase 9 added: Tool Calling (Function Calling) — LangGraph tool node + UI for tool calls; starter tools `get_current_time` and `web_search`
- Phase 10 added: Token Streaming (SSE, word-by-word render)
- Phase 11 added: Reasoning / Thinking Display
- v2.1 milestone added (2026-06-04): Reliability, Depth & Production Hardening — from mentor feedback note
- Phase 30 added: UX Reliability & Cleanup (loading/stale-state, textarea fix, remove active badge, remove Explore)
- Phase 31 added: Tool Reliability — replace web_search provider + Cheerio fetch_page
- Phase 32 added: Conversation Working Memory + Context Ring
- Phase 33 added: Composer & Knowledge Reorg (brain icon, tools button, /teach, skill editing)
- Phase 34 added: AI Memory Creator (conversation-derived suggestions → editable skill form)
- Phase 35 added: Conversational Group Chat (turn-based orchestrator; supersedes Phase 23)
- Phase 36 added: HTTPS / Let's Encrypt on the VM (nginx + certbot)
- Phase 37 recorded retroactively (2026-06-12): Intent-Driven Group Engine — shipped 2026-06-11 as commits 7961ed7 + e607473 outside roadmap tracking
- v2.2 milestone added (2026-06-12): Production Parity & Custom Dinos — from live prod investigation + 2026-06-12 mentor feedback note
- Phase 38 added: Production Runtime Parity (Tavily secret on VM, JSON body limit, automated DB migrations, env contract)
- Phase 39 added: Deploy Truth & Smoke Checks (CI post-deploy smoke stage, remove vestigial GCS frontend deploy, runbook refresh to Caddy reality)
- Phase 40 added: Skill Recall Cadence (one most-relevant skill pulled once per conversation — mentor note; retrieval-vs-extraction ambiguity to resolve at discuss)
- Phase 41 added: Autonomous Dino Minds / Group Engine v3 (per-dino independent answer/reaction/no-answer decision on own model; full thread context before every action — mentor note)
- Phase 42 added: Custom Dino Creator (name + avatar + description + reaction prompt + tool subset, per-user persisted — mentor note)
- Phase 43 added: When-to-React Configuration in group chat (mentor note)
- Phase 44 added: Pre-Launch UAT Sweep (production UAT backlog burn-down before showing users)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: OpenRouter replaces Gemini; @langchain/openai with configuration.baseURL
- Init: GPT-4o mini as default model (`openai/gpt-4o-mini` namespaced ID required)
- Init: MemorySaver kept for per-session memory; no database needed
- Phase 2: Per-request model selection via Map<modelId, CompiledGraph> — one MemorySaver shared across all graphs preserves thread history across model switches (D-09, D-10)
- Phase 2: Unknown model IDs fall back silently to gpt-4o-mini (D-11)
- Phase 2: Frontend uses plain class properties (not signals) — OnPush + ChangeDetectorRef pattern, consistent with existing isLoading field
- Phase 23: Groupchat v1 is single-turn per send; multi-turn group history deferred
- Phase 23: Cap of 4 dinos enforced client-side in GroupchatService.MAX_DINOS (DoS mitigation T-23-01)
- Phase 23: Groupchat reuses existing ChatService.streamMessage with per-dino AbortControllers (no backend change needed)
- Phase 24: Elo K_FACTOR=24 (moderate volatility for small roster); skip/tie treated as draw (Sa=Sb=0.5)
- Phase 24: Arena phase state machine (idle/streaming/voted) drives blind identity reveal
- Phase 24: ui lib @nx/enforce-module-boundaries errors are pre-existing workspace config issues affecting all ui components — not introduced by this plan
- Phase 27: Classic @ngrx/store + effects (not SignalStore) — Phase 29 voice assistant needs a named, enumerable action surface (NGX-02)
- Phase 27: Migrated only ui/dino/session slices; streaming/knowledge/skill/arena/groupchat stay component signals (bounded refactor)
- Phase 27: activeSessionId tracks ChatService.currentThreadId (ChatService stays thread authority; store syncs via setActiveSessionId)
- Phase 27: ACTION_CATALOGUE + dispatchCatalogued (zod-validated) is the ONLY assistant dispatch surface; destructive intents absent by construction (AST-03)
- Phase 27: NgRx pinned to 21.1.0; zod 4.4.3; installed via `npm install --legacy-peer-deps`
- Phase 28-01: VOX-01/02 read-aloud with VoiceSynthesisService + BrowserTtsAdapter; per-dino voiceProfile; Phase 29 seam wired via Actions$ ofType read_last_message
- Phase 28-02: VOX-03 dictation; VoiceRecognitionService NgZone-wrapped signals; MAX_DRAFT_LENGTH=10_000 for transcript sanitization (T-28-03); mic hidden on unsupported browsers
- Phase 34-02: Memory Creator frontend = brain button rewired to openCreator() (auto-fires suggest on overlay open); pick-suggestion + free-text converge on one private synthesizeInto() step (D-05); saveCreated delegates create-vs-update to the backend with NO component branching/toggle (D-07); creator failures degrade silently and never block chat or teach; added skillWhenToActivate signal (Phase 33 had the column + skill-manager edit path but no chat-level form signal); manual teach form preserved under a disclosure (SC#4); all HTTP via SkillService, OnPush+markForCheck, Tailwind only, LLM text via interpolation never innerHTML (T-34-02-01). Frontend nx project id is `frontend` (not `@org/frontend`).
- Phase 35-02: Frontend turn-based group client = rebuilt `GroupchatService` around the single backend `POST /api/agents/group` endpoint (new `ChatService.streamGroup` async generator mirroring `streamMessage`'s SSE parse loop; `streamMessage` byte-for-byte unchanged). Old parallel fan-out fully removed (no `DinoStreamEntry`, no `group-{groupId}-{dinoId}` per-dino threads, no fallback). Service exposes an ordered `messages` signal (`GroupViewMessage` extends shared `GroupMessage` with frontend-only `status`/`serverMessageId`/`error`) + `streaming` signal; `plan` pre-creates Round-1 placeholder slots in `order`, `dino_token`/`dino_done` route by dinoId into the open slot (`findOpenSlot` newest-first), Round-2 replies with no open slot append, `reaction` pins a chip onto its `targetMessageId` (matches `id` OR `serverMessageId`, no extra line — D-06), `dino_error` sets error status, `group_done` clears streaming. History capped at 20, participants at `MAX_DINOS=4`. `group-response` extended with `reactions`/`respondingToName` inputs (presentational, stays service-free). Groupchat view rewired to one top-to-bottom transcript (user bubbles + `app-group-response` rows). `@mention` autocomplete is app-layer (chat.ts `ngDoCheck` watches a `#groupComposer` ViewChild draft; trailing `@<partial>` opens a participant dropdown; `applyMention` inserts `@Name ` — `app-input-composer` untouched). Frontend nx project id is `frontend`; the `nx test frontend` runner crashes at bundle generation in this env (pre-existing — see deferred-items.md), so the Vitest spec (migrated to `vi.*`) could not be executed here.
- Phase 35-03: Durable group-chat persistence (D-08 / GRP2-04) = group threads save as a SINGLE interleaved `ConversationSession` in the SAME localStorage store as single chats (`desert-chat-history`) — no DB, no migration. Additive optional type extensions only: `ChatMessage` += `dinoId?`/`reactions?: GroupReaction[]`, `ConversationSession` += `isGroup?`/`participantDinoIds?` (existing single chats stay valid). GroupchatService gained a stable `groupSessionId` (minted on first send, reused across turns so re-saving updates in place), `toSession(title)`/`loadSession(session)`/`startNewSession()`, and GroupMessage⇄ChatMessage mappers (`user`↔`user`, `dino`↔`assistant`+dinoId, reactions preserved). ChatComponent persists on the falling edge of `groupchatStreaming()` via a constructor effect → `upsertActiveSession(toSession(title))` + `loadSessions()` refresh (reuses the single-chat store path; single-dino save/switch unchanged). `onSessionSelected` branches on `session.isGroup` → `openSession` (groupchat view + transcript + roster restore) else `switchToSession`. HistoryPanel shows a participant-mascot cluster (capped 3 + N badge) when `isGroup` (stays presentational). shared-types import must use the `.js` specifier (`./group.types.js`) under its NodeNext `typecheck` target. `nx test frontend` still crashes at bundle generation (pre-existing `referencedFiles`/`pos` Windows bug) so the new vi.* spec is type-sound but unrun locally.
- Phase 35-01: Backend group orchestrator = new GroupAgentsService + GroupAgentsController (POST /api/agents/group SSE), reusing AgentsService.streamAgent UNCHANGED per answerer. One cheap gpt-4o-mini orchestrator call returns a defensively-parsed per-dino answer/react/silent plan; Round 1 concurrent (multiplexed, dino-tagged on one SSE stream), Round 2 bounded+sequential (≤MAX_INTER_DINO_REPLIES=2). @mention forcing moved to engine level (streamGroup, not runOrchestrator) so it holds independent of the LLM plan and is unit-testable. Reactions cost zero LLM calls; documented hard ceiling 1+4+2=7 calls/turn. parseOrchestratorPlan + buildAttributedHistory (D-09 speaker-labelled history) exported as pure helpers. shared-types has a `typecheck` target, not `build`.
- Phase 34-01: Memory Creator backend = standalone MemoryCreatorService reusing agents.service paid-fallback shape (FALLBACK_MODEL=gpt-4o-mini) WITHOUT importing agents.service.ts (D-02); writes DinoSkills only via addSkill/updateSkill (no new persistence endpoint, D-08); reconcile is a separate server-side LLM call returning 'new' or an existing skill id (D-07, decision never surfaced); imageGen dinos use FALLBACK_MODEL; all creator LLM failures degrade (suggest→[], synthesize→raw input) and never 500 the chat; parseSynthesized/parseReconcile exported as pure unit-testable helpers
- Phase 36-01: HTTPS/TLS = host-level nginx + certbot (D-01), NOT dockerized. Ship `infra/nginx/dinoagents.conf` as an HTTP-only port-80 server block reverse-proxying `{DOMAIN}` → `http://localhost:3000`; `sudo certbot --nginx -d {DOMAIN}` augments the file in place (adds the `443 ssl` server + 80→443 301 redirect + systemd renew timer), sidestepping the cert/nginx chicken-and-egg (D-02). SSE streaming preserved via `proxy_buffering off` + `proxy_read_timeout/proxy_send_timeout 3600s` (backend already sends `X-Accel-Buffering: no`); `client_max_body_size 25m` for pasted screenshots (D-04). `CORS_ORIGIN=${CORS_ORIGIN:-https://{DOMAIN}}` added to compose backend env + `.env.example` (replaced the localhost dev default, D-05). README `## Deployment` fully rewritten VM+nginx+certbot (Cloud Run/Artifact Registry/WIF/Firebase Hosting content removed, D-06). `{DOMAIN}` placeholder only — no real host/cert committed (D-03). Live cert issuance + browser/streaming verification is a manual VM task (Task 4 — HUMAN-UAT, blocks INFRA-01 live confirmation). Docker not installed locally, so compose validity checked via `yaml` parse, not `docker compose config`.
- Phase 41-03: Group Engine v3 closed (frontend render proof + legacy marking + cost doc + UAT) = the v3 autonomous SSE stream renders UNCHANGED on the frontend — `applyEvent`'s `plan` case already returns early when `answerers.length === 0` (the empty v3 plan) and slots are created dynamically from `dino_token` via `findOpenSlot`, so `groupchat.service.ts` needed NO patch (D-01 validated). Added a scripted v3-sequence regression test to `groupchat.service.spec.ts` (empty `plan` → ordered `dino_token`/`dino_done` answers → a `reaction` chip on the later answer by `serverMessageId` → `group_done`; asserts arrival order, reply/intent metadata, chip-not-line, `streaming=false`). Marked Phase 35 `DinoTurnDecision`/`GroupOrchestratorPlan` `@deprecated` (kept ONLY for the still-emitted empty `plan` event; live contract is `DinoDecision`). Expanded `decision.ts` cost-ceiling doc with the worst-case call count (≤ MAX_GROUP_DINOS×MAX_ROUNDS=4×3=12 decision calls + ≤ MAX_TOTAL_ANSWERS=8 answer calls, early-stop via `shouldStopRounds`) and that it REPLACES the Phase 37 governor `TurnBudget` (Success Criterion #4 doc half). Wrote `41-HUMAN-UAT.md` (PENDING checks for GRP3-01 independent per-dino own-model decisions/no fixed fan-out, GRP3-02 threaded inter-dino attribution, GRP3-03 mixed answers/reactions/silences top-to-bottom, cost ceiling + @mention forcing, single-dino/Arena regression — on localhost AND https://dinoagents.duckdns.org). Gate: backend 14 files/154 tests green, frontend lint+build green; `frontend:test` still hits the pre-existing Windows bundle-gen crash (env bug, not this plan — logged to deferred-items.md). Frontend Nx project id is `frontend`, not `@org/frontend` (plan's verify commands used the wrong id; logged). GRP3-03 is a roadmap-level mentor requirement not yet formalized in REQUIREMENTS.md, so no requirement checkbox to flip.
- Phase 41-01: Autonomous decision primitive (foundation of Group Engine v3) = new shared `DinoDecision { action: 'answer'|'react'|'silent'; intent?: SpeechIntent; emoji?; replyToMessageId?; replyToAgentId?; confidence? }` in group.types.ts (reuses SpeechIntent; Phase 35 DinoTurnDecision/GroupOrchestratorPlan documented v3-vestigial, kept only for the empty `plan` event) + new LLM-free `apps/backend/src/app/agents/group/decision.ts` mirroring governor.ts: flat cost-ceiling constants (MAX_GROUP_DINOS=4, MAX_ROUNDS=3, MAX_ANSWERS_PER_DINO=2, MAX_TOTAL_ANSWERS=8) replacing the governor TurnBudget; `buildDecisionPrompt(profile, attributedThreadText, hasPriorDinoThisRound)` → pure {system,human} strings (no Message objects); `parseDecision(raw)` → validated DinoDecision (fence-strip from GroupAgentsService.parseJson, never throws — failure/unknown-action/react-without-emoji → silent, unknown answer intent → answer_user, confidence clamped); `heuristicDecision(profile, hasPrior)` bias-driven deterministic fallback (always valid shape, emoji iff react); RoundCounters + dinoAtAnswerCap/atTotalAnswerCap/shouldStopRounds (stop when answersThisRound===0 OR roundIndex+1>=MAX_ROUNDS) predicates. Fully unit-tested (backend 14 files/166 tests green). NOT wired into streamGroup — Plan 02's scope. Pre-existing unused-import lint error (`TurnBudget` in group-agents.service.ts:20, from Phase 37 e607473) is out of scope, logged to deferred-items.md, resolves naturally in Plan 02.
- Phase 42-01: Custom dino persistence foundation = custom_dinos pgTable (schema.ts) + CustomDinoService CRUD scoped by userId (null-db graceful degradation mirrors MemoryService) + CustomDinosController REST endpoints (POST/GET/PUT/DELETE /custom-dinos + GET /models) + MODEL_CATALOGUE of 5 free/cheap OpenRouter models + isAllowedModel guard + shared types (CustomDino / CreateCustomDinoRequest / UpdateCustomDinoRequest / CuratedModel). Custom id namespace: raw uuid in DB, public id = `custom:<uuid>` (D-02). toCustomDinoSummary projection uses explicit allowlist — systemPrompt can never leak (D-05). AVATAR_BUCKET documented in .env.example (Plan 02 consumes it). 15 test files / 175 tests green.
- Phase 32-01: Image cap N=2 in buildHistory() — last 2 image-bearing user turns retain imageDataUrl; older stripped (D-01/D-02); flatMap for historyMessages — tool items yield AIMessage(tool_calls)+ToolMessage pair with synthetic id replay-{toolName}-{index}; HISTORY_CAP=20 applied to conversational turns only, tool messages ride within window (D-04/D-05/D-06)

### Pending Todos

- **Phase 36 Task 4 — Issue cert + verify HTTPS on the VM (human, BLOCKING for INFRA-01 live verification):** on the production Compute Engine VM, follow the new README `## Deployment` runbook with the real domain. (1) Confirm the domain A record → VM IP and ports 80/443 open (3000 NOT public); (2) `sudo apt install nginx certbot python3-certbot-nginx`, deploy `infra/nginx/dinoagents.conf` to `/etc/nginx/sites-available/dinoagents` (replace `{DOMAIN}`), symlink, `sudo nginx -t && sudo systemctl reload nginx`; (3) `sudo certbot --nginx -d {DOMAIN}` and confirm it obtains a cert + rewrites the config (443 + redirect); (4) set `CORS_ORIGIN=https://{DOMAIN}` in the VM `.env`, `docker compose up -d`; (5) verify in browser: valid Let's Encrypt cert (padlock), `http://`→`https://` 301, a chat message streams token-by-token over HTTPS (SSE through the proxy), an image paste/upload succeeds, NO mixed-content errors; (6) `sudo certbot renew --dry-run` succeeds + renew timer active. Optionally re-commit the certbot-augmented `dinoagents.conf` (re-placeholdered). See 36-01-SUMMARY.md.
- **Phase 32 Task 5 — Live UAT image+tool reuse (human):** serve `npx nx serve @org/backend` + `npx nx serve frontend` with a live `OPENROUTER_API_KEY`. In one thread: (1) attach an image, ask about it, then on a later turn (no re-attach) ask a follow-up referencing it — confirm dino answers from retained image (CTX-01); attach 2 more newer images and confirm oldest dropped (N=2 cap). (2) ask a web-capable dino to fetch_page a URL; on follow-up ask a question answerable from that page — confirm NO second tool_call_start for the same URL (CTX-02). (3) fresh single-turn message behaves identically to pre-change (Success Criterion #4). BLOCKING for phase verification. See 32-01-SUMMARY.md.
- **Phase 34 Task 4 — Memory Creator end-to-end UAT (human):** with Phase 33 + 34-01 deployed, `DATABASE_URL` + `OPENROUTER_API_KEY` set and `dino_skills` pushed, serve the app and in a dino conversation: (1) brain → thinking state → ≥3 conversation-derived suggestions (SC#1); (2) pick-a-suggestion AND free-text both prefill the editable name/when/instruction form (SC#2); (3) save persists + auto-applies next chat, and an overlapping item UPDATES the existing skill (no duplicate, no new-vs-update toggle) (SC#3); (4) the manual teach form (under the disclosure) + stored skills/memories still work (SC#4). BLOCKING for phase verification. See 34-02-SUMMARY.md.
- **Phase 21 Task 5 — cross-thread memory smoke test (human):** with `DATABASE_URL` + `OPENROUTER_API_KEY` set and `user_memories` pushed (`drizzle-kit push`): tell rexford a fact in thread A → recall in new thread B (same dino) → veloce in thread C must NOT know → unset `DATABASE_URL` → no crash, no recall. See 21-01-SUMMARY.md.
- **Phase 22 Task 5 — teach-once smoke test (human):** with DB + key and `dino_skills` pushed: teach rexford "Always answer in British English." → new chat with rexford applies it without re-teaching → manager delete stops it → veloce unaffected. See 22-01-SUMMARY.md.
- **Phase 35-03 Task 6 — group-chat persistence live UAT (human):** serve backend + frontend with a live `OPENROUTER_API_KEY`. In Group chat: (1) hold a multi-turn conversation with 3 dinos (≥1 emoji reaction + one inter-dino reply), open the history panel → confirm the group thread appears, visually distinct (participant-mascot cluster); (2) switch to a single chat, reopen the saved group thread → confirm groupchat view returns with the FULL attributed transcript + reaction chips + original participant selection restored (GRP2-04); (3) send another message in the reopened thread → dinos still see prior context, session updates in place (no duplicate panel entry); (4) single-dino chat history save/reopen unchanged. BLOCKING for phase verification. See 35-03-SUMMARY.md.
- **Phase 35 Task 7 — turn-based group chat live UAT (human):** serve `npx nx serve @org/backend` + `npx nx serve frontend` with a live `OPENROUTER_API_KEY`. In Group chat select 3-4 dinos and: (1) send a general prompt → confirm a real chat emerges (some answer, some show an emoji reaction chip, some stay silent) rendered top-to-bottom with mascot+name attribution (GRP2-01); (2) `@mention` one dino via the autocomplete → that dino always replies, and a non-addressed competent dino sometimes volunteers a named reply (GRP2-02); (3) confirm ≥1 bounded inter-dino follow-up appears and reads coherently (GRP2-03); (4) confirm single-dino chat + Arena are unchanged. BLOCKING for phase verification. See 35-02-SUMMARY.md.
- **Phase 23 Task 4 — groupchat smoke test (human):** ⚠ SUPERSEDED by Phase 35 Task 7 (old parallel fan-out removed). See 23-01-SUMMARY.md for historical context only.
- **Phase 28-02 Task 5 — VOX-03 manual dictation smoke test (human):** serve app (`npx nx serve frontend`); in Chrome: click mic, grant permission, speak, confirm interim words fill draft live, confirm no auto-submit, confirm listening pulse ring, confirm long transcript is capped; in Firefox: confirm mic button is absent entirely. See 28-02-SUMMARY.md.
- **Phase 28 Task 8 — TTS manual audio smoke test (human):** confirm audible speech per dino in Chrome, Stop halts, no SSML markup spoken literally. See 28-01-SUMMARY.md.
- **Phase 27 Task 7 — NgRx regression sweep (human):** serve the app and exercise EVERY flow (send/stream, stop, regenerate, edit-and-resend, theme toggle + reload persistence, new chat, switch/delete/rename/pin session, dino picker, Explore, groupchat, arena, leaderboard). Confirm no behavior change vs pre-refactor + open Redux DevTools to confirm actions fire. See 27-01-SUMMARY.md. **Env note:** `nx test frontend` currently crashes with a pre-existing TS `referencedFiles` bug (reproduces on pre-NgRx baseline too) — see phase deferred-items.md.
- **Phase 24 Task 5 — arena + leaderboard smoke test (human):** push `dino_ratings` table (`drizzle-kit push`), serve app; navigate Arena → enter prompt → two anonymous panels stream → vote → both revealed + ratings updated → Leaderboard tab reflects results; repeat with DATABASE_URL unset → no crash, ratings stay at 1000. See 24-01-SUMMARY.md.
- **DB migration:** push the two new tables before the smoke tests — `user_memories` (Phase 21) and `dino_skills` (Phase 22) — via `npx nx run @org/backend:... drizzle-kit push` (or the project's drizzle push script) against `DATABASE_URL`.
- **Commit all changes (Phases 1–4)** — run `pnpm nx build frontend` first to verify, then commit with message: `feat(phase-4): desert theme — day/night toggle, snake mascot, bubble restyling, cactus scrollbar`
- Human one-time setup (Plan 03 Task 2): GCP project + APIs, Artifact Registry repo, Secret Manager `openrouter-api-key`, Cloud Run service `chatbot-backend`, Workload Identity Federation, Firebase project + Hosting, 8 GitHub Actions variables + 2 secrets. Full checklist in `README.md` `## Deployment`.
- Local smoke test of the full stack: `npx nx serve backend` + `npx nx serve frontend` with `OPENROUTER_API_KEY` in `.env`; verify model selector routes to both models.
- Local Playwright E2E dry-run (`npx nx e2e frontend-e2e` with `OPENROUTER_API_KEY` exported).

### Blockers/Concerns

- ~~`npx nx build` fails on this dev machine: Nx 22.7.0 + Node 24.12.0 `ERR_UNSUPPORTED_ESM_URL_SCHEME`~~ **RESOLVED (Phase 18):** root cause was Nx doing `import()` on a raw lowercase-drive Windows path. Fixed via `patches/nx+22.7.0.patch` (patch-package + `postinstall`). Nx, lint, test, and build now run locally. Backend `typecheck` target still has 2 pre-existing errors (NestJS decorator `import type` quirk + LangChain `tool.invoke` typing) — unrelated, not part of the lint/test gate.
- Node: default `node` is now 20.18.1 (via nvm, set during Phase 18 diagnosis). The Nx patch also fixes Node 24, so either works.
- Backend Vitest workers need an uppercase-drive cwd under Nx; handled by `apps/backend/vitest.run.mjs`.
- `@langchain/openai ^1.10.0` was not on npm; pinned to `^1.4.0` (latest published 1.x is 1.4.5).
- Docker not installed on the dev machine — Dockerfile changes are CI-only.
- `apps/frontend/src/main.ts` has a pre-existing `console.error(err)` lint warning (1 warning, 0 errors).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260525-l8i | Soft Studio + Capybara redesign (palette + mascot + token rename) | 2026-05-25 | pending | [260525-l8i-redesign-soft-studio-capybara](./quick/260525-l8i-redesign-soft-studio-capybara/) |
| 260610-qw4 | Replace placeholder dino mascots with real pixel-art + wire per-dino avatars | 2026-06-10 | pending | [260610-qw4-replace-placeholder-dino-mascots-with-re](./quick/260610-qw4-replace-placeholder-dino-mascots-with-re/) |
| 260610-sxm | Livelier group chat — react-by-default for non-answerers, 2-3 round-1 answerers, richer inter-dino conversation | 2026-06-10 | pending | [260610-sxm-group-chat-liveliness](./quick/260610-sxm-group-chat-liveliness/) |
| 260610-tg7 | Group reaction emoji tooltips — captioned hover text + shared vocabulary, orchestrator constrained to the set | 2026-06-10 | pending | [260610-tg7-group-reaction-tooltips](./quick/260610-tg7-group-reaction-tooltips/) |
| 260610-vvn | Broaden Iris & Vinci personas for group chat; image-gen dinos react (never blank-answer) in group | 2026-06-10 | pending | [260610-vvn-broaden-iris-vinci-personas](./quick/260610-vvn-broaden-iris-vinci-personas/) |
| 260610-fp1 | Force dino picker open on load/reload when no dino is selected; non-dismissable until a dino is chosen | 2026-06-10 | pending | [260610-fp1-force-dino-pick-on-load](./quick/260610-fp1-force-dino-pick-on-load/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Persistent history across sessions | Deferred | Init |
| v2 | Markdown rendering in assistant messages | Deferred | Init |
| v2 | Real web search tool | Deferred | Init |

## Session Continuity

Last session: 2026-06-18T23:20:36.617Z
Stopped at: Phase 43 context gathered
Resume file: None
