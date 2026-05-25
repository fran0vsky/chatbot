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

A user can open the app, type a message, get a real answer, and keep the conversation going — everything else is secondary.

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
*Last updated: 2026-05-25 — v1.1 milestone start (SpinoChat brand identity)*
