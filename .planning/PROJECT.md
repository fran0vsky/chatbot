# SpinoChat

## What This Is

A general-purpose text chatbot with a distinctive prehistoric jungle aesthetic and a stylized Spinosaurus mascot ("Spino"). Built as an Nx monorepo with an Angular frontend and NestJS backend. Users can ask the model anything and continue the conversation across multiple turns in the same session. The backend uses LangGraph to orchestrate LLM calls via OpenRouter.

**Project context:** primarily a portfolio project. Public publication is a possibility but not a commitment — design and infra choices should be appropriate for a polished portfolio piece, not a production SaaS.

## Brand

- **Product name:** SpinoChat
- **Short form (UI / conversational):** Spino
- **Tagline:** "The AI that survived"
- **Visual direction:** ancient intelligence meets modern AI — prehistoric jungle atmosphere with cinematic lighting, clean modern UI, restrained ambient motion
- **Personality:** intelligent, calm, curious, slightly mysterious, friendly but not childish — Octocat-tier polish, not meme-energy

## Core Value

A user can open the app, type a message, get a real answer, and keep the conversation going — everything else is secondary. **(v2.0 evolves this:** the user picks a characterful agent — a "dino" — that remembers them and can be summoned across modes: chat, groupchat, arena, and voice.)

## Current Milestone: v2.0 — Dino Platform

**Goal:** Pivot from a single-model chatbot to a platform of distinct, characterful AI agents ("dinos"). A dino = fixed model + system prompt (personality, tools it may use, response workflow) + tool subset.

**Target features:**
- **Dino abstraction** — backend registry of ≥4 dinos (model + system prompt + tool subset); system-prompt injection + server-side tool gating (Phase 18)
- **Dino picker + Explore** — choosing a dino replaces choosing a model; model dropdown removed (Phase 19)
- **Pixel-art dino mascots** — unique species per dino in the `dual-mascot.png` style, day/night via the split pipeline, sequenced after dinos are wired (Phase 20)
- **Cross-thread memory + teachable skills** — per-(user × dino) memory; teach a skill once and it persists (Phases 21–22)
- **Multi-dino experiences** — groupchat + arena with Elo-style scoring + leaderboard (Phases 23–24)
- **Multimodal** — screenshot paste, vision dino on free models, OCR, image generation (Phases 25–26)
- **NgRx + voice dino assistant** — state refactor exposing a whitelisted action catalogue; voice control of the app (Phases 27–29)

**Key context / decisions baked into this milestone:**
- **v1.1 Phases 13–17 are deferred to backlog** (jungle atmosphere, mascot motion, themed states, ambient, sound). Mascot *motion* is deliberately parked until the dino roster is final, then applied across all dinos.
- **Docs were stale.** The backend already runs a **manual agent loop** (LangGraph dropped per mentor guidance) and persists to **Postgres + Drizzle** (`sessions`, `messages`) — *not* MemorySaver-only. v2.0 builds on this real foundation (PLAT-01).
- **No auth yet.** Memory/leaderboards/skills key on an **anonymous per-device id** (localStorage); `sessions.userId` is already nullable text awaiting accounts.
- **Voice/multimodal are last** — highest complexity and external-provider/cost risk; natural cut points if scope tightens.

## Requirements

### Validated

- ✓ NestJS API server with `POST /api/agents/chat` endpoint — existing
- ✓ LangGraph StateGraph for agent orchestration — existing
- ✓ Per-thread conversation memory (MemorySaver) — existing
- ✓ Shared type contracts `ChatRequest` / `ChatResponse` in `@org/shared-types` — existing
- ✓ Angular SPA project wired with `HttpClient` and router — existing

### Active (v1.1 — SpinoChat Brand Identity)

**Brand & identity:**
- [ ] **BRAND-01**: Visible product name in UI is "SpinoChat" / "Spino" (header, page title, meta tags)
- [ ] **BRAND-02**: Tagline "The AI that survived" appears at least once in landing-state copy

**Visual identity:**
- [ ] **PAL-01**: Day-mode palette is a daytime-jungle theme (warm sunlit greens + beige/sand tones)
- [ ] **PAL-02**: Night-mode palette is a night-jungle / sunset theme (deep teals/blues + warm sunset/bioluminescent accents)
- [ ] **MASC-01**: A Spinosaurus-inspired mascot replaces the current capybara SVG in the assistant message bubble
- [ ] **MASC-02**: The mascot renders crisply at all sizes (no pixel-scaling artifacts)
- [ ] **MASC-03**: The mascot has an idle breathing/blink animation
- [ ] **MASC-04**: The mascot reacts visually during a "thinking" state (subtle eye glow or equivalent)

**Atmosphere:**
- [ ] **BG-01**: A subtle jungle background (gradient + edge silhouettes) is present in both day and night modes, without competing with chat content
- [ ] **STATE-01**: Loading / typing / reasoning indicators are re-themed to match the jungle aesthetic (no generic spinners)

**Stretch (optional):**
- [ ] **AMB-01**: Ambient motion layer — slow drifting leaves, dust, or fog — toggleable, OFF by default
- [ ] **SND-01**: Optional ambient sound (jungle/rain), toggleable, OFF by default

### Earlier active items (carried forward, mostly completed in v1.0 phases)

- [x] **CHAT-01..04**: Working chat (delivered in Phase 1)
- [x] **MODEL-01**: Model selector (delivered in Phase 2)

### Out of Scope

- Media input (images, video, audio) — Task 1 spec explicitly limits to text-only
- Persistent history across sessions/devices — user chose per-session; MemorySaver is sufficient
- Authentication / user accounts — not in scope for current tasks
- Real web search tool — placeholder is acceptable; not needed for core chat

## Context

- **Existing stack:** Nx monorepo, NestJS 11 backend, Angular 21 SPA, LangGraph, Node 24, npm, Tailwind CSS
- **Current backend:** LangGraph agent wired to Google Gemini 2.0 Flash Lite via `@langchain/google-genai`. Needs to be replaced with OpenRouter (OpenAI-compatible API via `@langchain/openai` or direct `openai` SDK).
- **Current frontend:** Nx welcome page only — no chat UI exists. Angular conventions: standalone components, OnPush change detection, Tailwind for all styling.
- **Shared types:** `ChatRequest { message: string; threadId?: string }` and `ChatResponse { response: string }` already defined in `libs/shared-types/` — use as-is.
- **Known issues:** Dockerfile missing `libs/` copy step (broken for Docker); placeholder search tool returns fake results; no input validation on the controller.

## Constraints

- **Tech stack:** Angular + NestJS + LangGraph — locked, no framework changes
- **LLM provider:** OpenRouter (replaces Gemini) — user specified
- **Conversation scope:** Per-session only — MemorySaver stays, no database needed for Task 1
- **Styling:** Tailwind CSS only — no inline styles, per project conventions
- **Components:** Angular standalone components with OnPush change detection — per project conventions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenRouter over Gemini | User specified; gives model flexibility for Task 2 | — Pending |
| GPT-4o mini as default model | Fast, cheap, capable — good default before model switching lands | — Pending |
| MemorySaver for conversation state | Per-session is sufficient; no persistence requirement | — Pending |
| Bubble chat UI | Standard chat feel; user selected | — Pending |
| Two-phase approach (chat first, model switching second) | Ship working chat before adding configurability | — Pending |
| **v1.1 rebrand to SpinoChat** (2026-05-25) | Original "Chatbot" was placeholder; want a distinctive portfolio identity. Verified no AI-product trademark on "SpinoChat" (Spino Inc / Spinabot / Spinoco operate in adjacent space but don't own the chat name) | Active |
| **Jungle / dinosaur theme** (2026-05-25) | Niche but underexplored in AI chatbot space (most use abstract, owl, fox, alligator). Differentiates the portfolio piece | Active |
| **Rive for mascot animation** (2026-05-25) | State-driven animation needed (idle / thinking / reactive eyes). Industry standard (Duolingo uses for Duo). ~50KB dep accepted | Active |
| **Portfolio-grade scope** (2026-05-25) | Trademark/domain/legal are deferred until/unless project is published. Code quality matches a portfolio piece, not a SaaS company | Active |
| **v2.0 pivot to Dino Platform** (2026-05-29) | Mentor guidance: select a *dino* (model + system prompt + tools), not a raw model. Reframes the product from "chatbot" to "platform of agents" | Active |
| **Defer v1.1 Phases 13–17** (2026-05-29) | Pivot is large; mascot-motion work was scoped for one Spino and would be throwaway against a 4+ species roster. Finalize roster + static mascots first, add motion later across all dinos | Active |
| **Dino mascots sequenced after dinos** (2026-05-29) | Maker's explicit ask: wire dinos in (Phases 18–19) before drawing per-species pixel-art mascots (Phase 20), reusing the `dual-mascot.png` → `split-mascot.js` pipeline | Active |
| **Anonymous per-device identity for memory** (2026-05-29) | No auth in v2.0; memory/leaderboards/skills key on a localStorage id. `sessions.userId` (nullable text) is ready for real accounts later | Active |
| **Docs corrected: manual loop + Postgres** (2026-05-29) | PROJECT/ROADMAP claimed LangGraph + MemorySaver; code already uses a manual agent loop and Drizzle/Postgres. v2.0 builds on the real foundation (PLAT-01) | Active |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-29 — v2.0 milestone start (Dino Platform); v1.1 Phases 13–17 deferred to backlog*
