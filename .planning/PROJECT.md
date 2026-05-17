# Chatbot

## What This Is

A general-purpose text chatbot built as an Nx monorepo with an Angular frontend and NestJS backend. Users can ask the model anything and continue the conversation across multiple turns in the same session. The backend uses LangGraph to orchestrate LLM calls via OpenRouter.

## Core Value

A user can open the app, type a message, get a real answer, and keep the conversation going — everything else is secondary.

## Requirements

### Validated

- ✓ NestJS API server with `POST /api/agents/chat` endpoint — existing
- ✓ LangGraph StateGraph for agent orchestration — existing
- ✓ Per-thread conversation memory (MemorySaver) — existing
- ✓ Shared type contracts `ChatRequest` / `ChatResponse` in `@org/shared-types` — existing
- ✓ Angular SPA project wired with `HttpClient` and router — existing

### Active

- [ ] **CHAT-01**: User can type a message and receive a text response from an LLM
- [ ] **CHAT-02**: User can continue a conversation across multiple turns (per-session thread)
- [ ] **CHAT-03**: Chat UI uses bubble layout (user on right, assistant on left)
- [ ] **CHAT-04**: Backend uses OpenRouter with GPT-4o mini as the default model
- [ ] **MODEL-01**: User can change the active model from the UI (Task 2)

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
*Last updated: 2026-05-17 after initialization*
