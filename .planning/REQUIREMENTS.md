# Requirements: DinoAgents

**Defined:** 2026-05-17
**Core Value (v2.0):** A user can open the app, pick a characterful AI agent ("dino"), get a real answer, and keep the conversation going — the dino remembers them and can be summoned across modes (chat, groupchat, arena, voice).

> **Milestone status:** v1.0 (Phases 1–11) complete. v1.1 DinoAgents Brand Identity (Phases 12–17) — Phase 12 shipped; Phases 13–17 **deferred to backlog** at v2.0 start (see "Deferred — v1.1 polish" below). **v2.0 "Dino Platform" is the active milestone.**

---

## v2.0 Requirements — Dino Platform (ACTIVE)

**Defined:** 2026-05-29
**Scope:** Pivot from a single-model chatbot to a platform of distinct, characterful AI agents ("dinos"). Each dino = fixed model + system prompt + tool subset. Adds cross-thread memory, teachable skills, groupchat, arena + leaderboard, multimodal input, and ngrx-driven voice control. Phases execute in dependency order; foundation first, riskiest clusters (Multimodal, Voice) last.

### Dino Abstraction

- [ ] **DINO-01**: A "dino" is defined as a fixed model + system prompt (personality, response style, workflow) + an allowed tool subset, stored in a backend registry as the single source of truth
- [ ] **DINO-02**: At least 4 distinct dinos exist, each with a different model, personality, and tool set
- [ ] **DINO-03**: The selected dino's system prompt is injected as a system message at the start of every agent turn (no system prompt is injected today)
- [ ] **DINO-04**: A dino can only invoke tools in its allowed subset; tool access is enforced server-side
- [ ] **DINO-05**: Dino definitions (id, name, blurb, specialty, model, tools) are exposed to the frontend via a typed contract in `@org/shared-types`
- [ ] **DINO-06**: A chat session is bound to exactly one dino for its lifetime; the active dino is recoverable from the session

### Dino Selection & Explore

- [ ] **PICK-01**: Starting a new chat presents a dino picker the user chooses from (replacing model selection)
- [ ] **PICK-02**: The model dropdown is removed from the composer
- [ ] **PICK-03**: An Explore page lists every dino with its mascot, name, personality blurb, and specialty/toolset
- [ ] **PICK-04**: The active dino's name and mascot are shown in the chat header

### Dino Mascots (pixel-art)

- [ ] **MASC-06**: Each dino has a unique pixel-art mascot drawn in the exact style of `dual-mascot.png` (a distinct dinosaur species)
- [ ] **MASC-07**: Each dino mascot ships day + night palette variants produced through the `split-mascot.js` → optimize pipeline
- [ ] **MASC-08**: Dino mascots appear in the picker, Explore page, and assistant message bubbles (per active dino)

### Memory & Learning

- [ ] **MEM-01**: A dino retains facts learned about the user across separate threads/sessions
- [ ] **MEM-02**: Memory is scoped per (user × dino) so each dino accumulates its own understanding of the user
- [ ] **MEM-03**: Relevant stored memories are retrieved and injected into the dino's context at the start of a turn
- [ ] **MEM-04**: User can open a dedicated "teach a skill" chat for a dino from a button in the chat
- [ ] **MEM-05**: A skill taught to a dino persists and is applied automatically in all future chats with that dino (no re-teaching)
- [ ] **MEM-06**: User can review and remove what a dino has learned (memories and skills)

### Multi-Dino — Groupchat

- [ ] **GRP-01**: Groupchat mode lets the user send one prompt and receive responses from multiple selected dinos in a single view
- [ ] **GRP-02**: Each dino's response in groupchat is clearly attributed to that dino (name + mascot)

### Multi-Dino — Arena & Leaderboard

- [ ] **ARN-01**: Arena mode splits the screen and has two dinos answer the same prompt; dino identities are hidden until after voting
- [ ] **ARN-02**: The user votes for the better answer, after which both dinos are revealed
- [ ] **ARN-03**: Votes update a persistent dino ranking score (Elo-style or equivalent), defined and documented
- [ ] **ARN-04**: A Leaderboard tab ranks all dinos by their ranking score

### Multimodal Input

- [x] **VIS-01**: User can paste or attach a screenshot/image into the composer (paste handler + attach button; client-side downscale to 1024px, 5 MB cap)
- [x] **VIS-02**: A vision-capable dino accepts images and reasons about them — Iris (Troodon) on `nvidia/nemotron-nano-12b-v2-vl:free`
- [x] **VIS-03**: User can extract (OCR) the text contained in a pasted screenshot (prompt-based; Iris's system prompt advertises exact transcription)
- [x] **VIS-04**: Free vision-model viability verified (spike: nemotron-nano-12b-v2-vl + kimi-k2.6 confirmed) and documented; degrades gracefully via the hybrid failover to vision-capable `gpt-4o-mini`

### Image Generation

- [x] **IMG-01**: An "artist" dino (Vinci) can generate an image from a text prompt — `google/gemini-2.5-flash-image` (no free image model exists on OpenRouter; ~$0.04/image, confirmed via spike)
- [x] **IMG-02**: Generated images render inline in the chat (assistant bubble) and can be downloaded (download link on the image)

### Frontend State (NgRx)

- [x] **NGX-01**: Frontend application state (active dino, theme, chat session, message list) is managed via NgRx with typed actions and selectors
- [x] **NGX-02**: A whitelisted catalogue of dispatchable app actions exists (change theme, new chat, switch chat, read/listen last message, send message) for the assistant layer to call

### Voice I/O

- [x] **VOX-01**: A dino can read its responses aloud via text-to-speech (two-way voice)
- [x] **VOX-02**: Spoken output is driven by SSML for natural prosody/pauses
- [x] **VOX-03**: User can dictate input by voice (speech-to-text)

### Voice Dino Assistant

- [x] **AST-01**: A voice "dino assistant" interprets voice commands and fires whitelisted NgRx app actions — backend `/api/assistant/interpret` (gpt-4o-mini) → `dispatchCatalogued`; covers change theme, new chat, read last message, switch chat, send message, navigate, select dino
- [x] **AST-02**: When a command is ambiguous, the assistant asks a clarifying question by voice (`kind: 'clarify'` → TTS)
- [x] **AST-03**: For actions outside its whitelist (e.g. delete account), the assistant states it cannot — structurally enforced (absent from catalogue) + `kind: 'refuse'`
- [x] **AST-04**: The assistant can locate and switch to a previous chat by topic/recency — sessions passed to the interpreter; resolves to a sessionId → `switch_chat`

### Platform / Hygiene

- [ ] **UX-01**: The footer is pinned to the bottom of the viewport across screen sizes
- [ ] **PLAT-01**: Planning docs (PROJECT.md, ROADMAP.md, GSD-CONTEXT.md) are corrected to reflect the real architecture — manual agent loop (no LangGraph), Postgres/Drizzle persistence (no MemorySaver-only)

---

## Historical Requirements (v1.0 + v1.1)

### v1.0 — Working Chat & Model Switching (Phases 1–11, complete)

#### Backend
- [x] **BACK-01**: Backend uses OpenRouter as the LLM provider (ChatOpenAI pointed at `https://openrouter.ai/api/v1`)
- [x] **BACK-02**: Default model is `openai/gpt-4o-mini`
- [x] **BACK-03**: Agent loop simplified (placeholder search tool removed) — *note: LangGraph later replaced with a manual agent loop; see PLAT-01*
- [x] **BACK-04**: `@langchain/openai` declared explicitly in package.json
- [x] **BACK-05**: Dockerfile copies `libs/` so `@org/shared-types` resolves inside Docker

#### Chat UI
- [x] **UI-01**: User can type a message in a text input and submit it (Enter key or send button)
- [x] **UI-02**: Messages are displayed in a bubble layout — user right, assistant left
- [x] **UI-03**: A loading indicator is visible while waiting for the assistant response
- [x] **UI-04**: The message list automatically scrolls to the newest message

#### Conversation
- [x] **CONV-01**: The frontend generates a `threadId` per session and sends it with every request
- [x] **CONV-02**: Refreshing the page or opening a new tab starts a fresh conversation

#### Deployment & Quality
- [x] **DEPLOY-01**: Backend deployed to GCP Cloud Run
- [x] **DEPLOY-02**: Frontend deployed to Firebase Hosting
- [x] **DEPLOY-03**: GitHub Actions CI/CD pipeline (lint + build + deploy on `main`)
- [x] **E2E-01**: Playwright E2E covers the core happy path

#### Model Switching
- [x] **MODEL-01**: User can select from a list of models in the UI *(superseded in v2.0 — replaced by dino picker, see PICK-02)*

### v1.1 — DinoAgents Brand Identity

#### Shipped (Phase 12)
- [x] **BRAND-01**: Visible product naming reads "DinoAgents"
- [x] **BRAND-02**: Tagline "The AI that survived" on the landing/empty state
- [x] **BRAND-03**: README.md and CLAUDE.md updated to "DinoAgents"
- [x] **PAL-01**: Day-mode jungle palette
- [x] **PAL-02**: Night-mode jungle/sunset palette
- [x] **PAL-03**: Palettes pass pragmatic AA contrast
- [x] **PAL-04**: `studio-*` tokens re-mapped (hex-only)
- [x] **MASC-01**: Spinosaurus mascot replaces capybara in `MessageBubble`
- [x] **MASC-02**: Mascot renders crisply at all sizes
- [x] **MASC-05**: Mascot shown at hero size on landing/empty state

#### Deferred — v1.1 polish (parked at v2.0 start, tracked for a future polish milestone)
- **BG-01..03** (was Phase 13): Theme-aware jungle background system (gradients + edge silhouettes)
- **MASC-03..04** (was Phase 14): Mascot motion — idle breathing/blink + reactive "thinking" state. *Deliberately deferred until the v2.0 dino roster is final, then applied across all dino mascots.*
- **STATE-01..03** (was Phase 15): Jungle-themed loading/typing/reasoning states
- **AMB-01..02** (was Phase 16, stretch): Optional ambient motion layer
- **SND-01** (was Phase 17, stretch): Optional ambient jungle/rain audio

---

## Future Requirements (beyond v2.0)

- **AUTH-01**: User accounts so memory, leaderboards, and learned skills are portable across devices (v2.0 uses an anonymous per-device identity)
- **ENH-05**: Real web search tool (replace placeholder with Tavily/SerpAPI)
- **ENH-06**: Rate limiting on the chat endpoint
- **ENH-07**: Input validation with `ValidationPipe` and DTOs
- **DINO-USER-01**: User-authored dinos (end users create their own agents)

## Out of Scope (v2.0)

| Feature | Reason |
|---------|--------|
| User authentication / accounts | Deferred; v2.0 keys memory on an anonymous per-device id (localStorage), sufficient for a portfolio piece |
| Real-time multi-user collaboration | Single-user app; not core to the dino value |
| Paid/premium TTS as a hard dependency | TTS/SSML provider is a cost decision made in the Voice phase; must have a free/browser fallback |
| Self-serve dino creation by end users | Dinos are curated by the maker in v2.0; user-authored dinos are a future idea |
| Mobile native app | Web-first |

---

## v2.2 Requirements — Production Parity & Custom Dinos (ACTIVE)

**Defined:** 2026-06-12
**Scope:** Make the public website behave like localhost (parity + deploy truth), then land mentor-feedback features (skill recall cadence, autonomous per-dino group engine, custom dinos, when-to-react config) and a pre-launch UAT sweep. Derived from a live production investigation (2026-06-12) + the 2026-06-12 mentoring note.

### Production Parity (Phase 38)

- [x] **PROD-01**: `web_search` returns real Tavily results on the production website — a `tavily-api-key` secret exists in Secret Manager and `scripts/vm-deploy.sh` fetches and injects `TAVILY_API_KEY` into the backend container (today the key is never passed, so search is dead on the site)
- [x] **PROD-02**: The backend accepts request bodies large enough for an attached downscaled image (~1024 px JPEG) plus a capped history — the Express default 100 kb JSON limit is raised to a documented cap (e.g. 10 MB) so image chats and long histories don't 413
- [x] **PROD-03**: A change to `apps/backend/src/app/database/schema.ts` reaches the production Cloud SQL database automatically on deploy (no manual column adds) — schema drift like the `when_to_activate` silent failure cannot recur

### Deploy Truth & Smoke Checks (Phase 39)

- [ ] **PROD-04**: CI runs a post-deploy smoke stage against https://dinoagents.duckdns.org that fails the pipeline if `/api/dinos` is not 200, a streamed chat probe does not complete, or `web_search` is not configured
- [ ] **PROD-05**: There is exactly one documented, working frontend-serving path (the Docker-baked frontend behind Caddy); the vestigial GCS frontend deploy job is removed or repurposed, and the deployment runbooks describe the real Caddy/baked-frontend architecture

> Mentor-feedback requirements (MEM2-01, GRP3-01..04, CDINO-01..04, UAT-01) for Phases 40–44 are captured in the ROADMAP phase details and will be formalized here when each phase is discussed/planned.

## Traceability (v2.0)

| Requirement | Phase | Status |
|-------------|-------|--------|
| DINO-01..06, PLAT-01 | Phase 18 | Pending |
| PICK-01..04, UX-01 | Phase 19 | Pending |
| MASC-06..08 | Phase 20 | Pending |
| MEM-01..03 | Phase 21 | Pending |
| MEM-04..06 | Phase 22 | Pending |
| GRP-01..02 | Phase 23 | Pending |
| ARN-01..04 | Phase 24 | Pending |
| VIS-01..04 | Phase 25 | Code complete (human UAT pending) |
| IMG-01..02 | Phase 26 | Code complete (human UAT pending) |
| NGX-01..02 | Phase 27 | Pending |
| VOX-01..03 | Phase 28 | Pending |
| AST-01..04 | Phase 29 | Code complete (human UAT pending) |

**Coverage (v2.0):**
- v2.0 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-29 — v2.0 "Dino Platform" milestone requirements added; v1.1 Phases 13–17 deferred to backlog*
