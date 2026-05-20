# Roadmap: Chatbot

## Overview

Two phases mapping directly to the two project tasks. Phase 1 delivers a fully working, publicly deployed chat application: OpenRouter backend on GCP Cloud Run, bubble UI on Firebase Hosting, per-session conversation memory, CI/CD via GitHub Actions, and a passing Playwright E2E test. Phase 2 adds model switching on top of the working chat, letting the user choose between available OpenRouter models from the UI.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Working Chat** - OpenRouter backend + bubble chat UI + deployed to GCP Cloud Run & Firebase Hosting with CI/CD and E2E test
- [ ] **Phase 2: Choose Your Model** - Model selector in the UI so the user can switch LLMs mid-session
- [ ] **Phase 3: UI/UX Refinement** - Polish and improve the chat UI for a better user experience

## Phase Details

### Phase 1: Working Chat
**Goal**: Users can open the publicly deployed app, send a message, get a real answer from GPT-4o mini via OpenRouter, and continue the conversation across multiple turns in the same browser session; the app is deployed to GCP Cloud Run (backend) and Firebase Hosting (frontend) with a passing CI/CD pipeline and E2E test
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05, UI-01, UI-02, UI-03, UI-04, CONV-01, CONV-02, DEPLOY-01, DEPLOY-02, DEPLOY-03, E2E-01
**Success Criteria** (what must be TRUE):
  1. User types a message and receives a text response from GPT-4o mini within a few seconds
  2. User sends a follow-up message and the assistant demonstrates memory of the earlier turn (conversation context is maintained)
  3. Messages are displayed in a bubble layout — user messages aligned right, assistant messages aligned left — with a typing indicator visible while the response is loading
  4. The message list scrolls automatically to the newest message without user interaction
  5. Refreshing the page starts a completely fresh conversation with no memory of the previous session
  6. The app is publicly accessible via a Firebase Hosting URL (mentor can click around)
  7. The backend is running on GCP Cloud Run and reachable from the deployed frontend
  8. GitHub Actions CI/CD pipeline passes (lint, build, deploy) on push to main
  9. Playwright E2E test passes: app loads at the deployed URL, user sends a message, assistant response appears
**Plans**:
  - 01-01: Backend on OpenRouter (BACK-01..05) — code complete
  - 01-02: Angular chat UI (UI-01..04, CONV-01, CONV-02) — code complete
  - 01-03: Deployment + CI/CD (DEPLOY-01..03, E2E-01) — code complete; awaiting human GCP/Firebase setup
**UI hint**: yes

### Phase 2: Choose Your Model
**Goal**: Users can select an LLM from a list in the UI and all subsequent messages use the chosen model
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MODEL-01
**Success Criteria** (what must be TRUE):
  1. A model selector is visible in the chat UI showing at least two OpenRouter model options
  2. After selecting a different model, the next message is answered by that model (observable via distinct response style or confirmed via backend logs)
  3. The selected model persists for the duration of the session (switching tabs does not reset it unless the page is refreshed)
**Plans**:
  - 02-01: Shared types + backend model routing (MODEL-01, Wave 1)
  - 02-02: Frontend model selector (MODEL-01, Wave 2 — blocked on 02-01)

### Phase 3: UI/UX Refinement
**Goal**: Polish and improve the chat UI for a better user experience
**Mode:** mvp
**Depends on**: Phase 2
**Plans**:
  - 03-01: Markdown rendering in assistant messages (Wave 1)
  - 03-03: Chat shell polish — placeholder, new chat, send button, header (Wave 1)
  - 03-02: Copy button on assistant bubbles (Wave 2 — blocked on 03-01)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Working Chat | 3/3 | Code complete; awaiting human deploy setup | - |
| 2. Choose Your Model | 2/2 | Code complete | 2026-05-20 |
| 3. UI/UX Refinement | 0/3 | Planned | - |
