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
- [ ] **Phase 5: Further UI/UX Work** - Further work on looks and UI
- [ ] **Phase 6: Desert UI Elevation** - Pixel snake avatar, background cacti, floating pill input, typography polish
- [x] **Phase 7: Visual Overhaul** - Modernize every UI component to ChatGPT/Claude/Gemini polish while keeping the desert theme (completed 2026-05-22)
- [x] **Phase 8: Chat History Sidebar** - Add left sidebar containing history of chats which are clickable to jump back into old conversations
- [x] **Phase 9: Tool Calling (Function Calling)** - Backend LangGraph tool node + UI for tool calls; ship `get_current_time` and `web_search` as starter tools (code complete 2026-05-23)
- [x] **Phase 10: Token Streaming (SSE)** - Word-by-word streamed responses
- [x] **Phase 11: Reasoning / Thinking Display** - Stream and display reasoning tokens; auto-collapse on first content (code complete 2026-05-24)

## v1.1 — DinoAgents Brand Identity (begins 2026-05-25)

- [x] **Phase 12: DinoAgents Foundation** - Jungle palette (hex-only swap on existing `studio-*` tokens), Spinosaurus mascot integration, "Chatbot" → "DinoAgents" rename, tagline placement (completed 2026-05-25)
- [~] **Phase 13: Jungle Atmosphere** - DEFERRED to backlog at v2.0 start
- [~] **Phase 14: Mascot Motion** - DEFERRED to backlog at v2.0 start (re-scoped to apply across all v2.0 dino mascots later)
- [~] **Phase 15: Themed States** - DEFERRED to backlog at v2.0 start
- [~] **Phase 16: Ambient Polish [stretch]** - DEFERRED to backlog
- [~] **Phase 17: Sound [stretch]** - DEFERRED to backlog

## v2.0 — Dino Platform (begins 2026-05-29)

**Milestone goal:** Pivot DinoAgents from a single-model chatbot into a platform of distinct, characterful AI agents ("dinos"). A dino = fixed model + system prompt + tool subset. Foundation ships first (dino abstraction → picker/Explore → pixel-art mascots), then memory & learning, multi-dino experiences, multimodal input, and ngrx-driven voice control. Riskiest clusters (Multimodal, Voice) come last as clean cut points.

- [x] **Phase 18: Dino Abstraction** - Backend dino registry (model + system prompt + tool subset), system-prompt injection, server-side tool gating, ≥4 dinos, typed contract, docs corrected (completed 2026-05-29)
- [x] **Phase 19: Dino Picker + Explore** - New-chat dino picker, remove model dropdown, Explore page, active-dino in header, footer pinned (completed 2026-05-29)
- [ ] **Phase 20: Dino Mascots** - Unique pixel-art mascot per dino (dual-mascot.png style), day/night via split pipeline, integrated in picker/Explore/chat + per-chat dino mascot icon in the history panel (v2.1 rider)
- [x] **Phase 21: Cross-Thread Memory** - Per-(user × dino) memory store, retrieval + injection into the dino's context across threads (completed 2026-05-29)
- [x] **Phase 22: Teach-a-Skill** - Dedicated training chat per dino, persistent learned skills auto-applied, manage learned memories/skills (completed 2026-05-29)
- [x] **Phase 23: Dino Groupchat** - One prompt → multiple dinos respond in a single attributed view (code complete 2026-05-29) — ⚠ SUPERSEDED by Phase 35 (v2.1)
- [x] **Phase 24: Dino Arena + Leaderboard** - Blind split-screen compare, vote → Elo-style scoring, Leaderboard tab (code complete 2026-05-29; Task 5 smoke test pending human UAT)
- [x] **Phase 25: Multimodal Input** - Screenshot paste/attach, Iris (Troodon) vision dino on `nvidia/nemotron-nano-12b-v2-vl:free`, prompt-based OCR; vision-capable paid fallback (code complete 2026-06-04; human UAT pending)
- [x] **Phase 26: Image Generation** - Vinci (Parasaurolophus) artist dino on `google/gemini-2.5-flash-image` (~$0.04/img — no free image model exists); inline render + download via dedicated image path (code complete 2026-06-04; human UAT pending)
- [x] **Phase 27: NgRx State Refactor** - Move app state to NgRx; expose a whitelisted dispatchable action catalogue (completed 2026-05-30)
- [ ] **Phase 28: Voice I/O + SSML** - Two-way voice (TTS with SSML) + speech-to-text input, with a free/browser fallback
- [x] **Phase 29: Voice Dino Assistant** - Voice commands → whitelisted NgRx actions via backend intent parser (gpt-4o-mini); clarify/refuse paths; finds & switches past chats by topic; floating assistant button (code complete 2026-06-04; human UAT pending)

## v2.1 — Reliability, Depth & Production Hardening (begins 2026-06-04)

**Milestone goal:** Harden DinoAgents for a public VM deployment and deepen the core chat experience — fix stale-state/composer bugs, make the web tools return real data, give each chat a working memory + context ring, reorganize the composer around an AI Memory Creator, rebuild groupchat as a real turn-based conversation, and serve the app over HTTPS.

- [x] **Phase 30: UX Reliability & Cleanup** - Loading/skeleton states (no stale messages on chat switch), long-text textarea fix, remove dino-picker "active" badge, remove Explore (completed 2026-06-04)
- [ ] **Phase 31: Tool Reliability — Web Search + Cheerio Fetch** - Replace DuckDuckGo IA `web_search` with a real free-tier provider; Cheerio-based `fetch_page` parsing
- [ ] **Phase 32: Conversation Working Memory + Context Ring** - Persist attached images + fetched tool results in thread context (reused across turns); context-usage ring with near-limit warning
- [ ] **Phase 33: Composer & Knowledge Reorg** - Brain icon replaces wrench, dedicated tools button, `/teach` slash-command + enlarged teach modal, skill editing, Knowledge lists each dino's skills
- [ ] **Phase 34: AI Memory Creator** - Brain → "thinking" modal suggests memorizable items from the conversation → auto-fills editable name/trigger/instruction form → creates or updates memory
- [ ] **Phase 35: Conversational Group Chat** - Turn-based orchestrator (answer / emoji-react / stay silent), @mention forces a reply, inter-dino dialogue, persisted in history (supersedes Phase 23)
- [ ] **Phase 36: HTTPS / Let's Encrypt** - certbot + nginx on the VM, auto-renewing cert, HTTP→HTTPS redirect [independent infra track]

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
Phases execute in numeric order: 1 → 2 → 3 → … → 11 (v1.0 complete) → 12 → 13 → 14 → 15 → 16 (stretch) → 17 (stretch)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Working Chat | 3/3 | Code complete; awaiting human deploy setup | - |
| 2. Choose Your Model | 2/2 | Code complete | 2026-05-20 |
| 3. UI/UX Refinement | 3/3 | Code complete | 2026-05-20 |
| 4. Dark Theme and Visual Polish | 3/3 | Code complete | 2026-05-20 |
| 5. Further UI/UX Work | 0/3 | Planned | - |
| 6. Desert UI Elevation | 2/2 | Code complete | 2026-05-22 |
| 7. Visual Overhaul | 5/5 | Complete   | 2026-05-22 |
| 8. Chat History Sidebar | 0/2 | Planned | - |
| 9. Tool Calling | 2/2 | Code complete | 2026-05-23 |
| 10. Token Streaming | 3/3 | Complete | 2026-05-24 |
| 11. Reasoning Display | 6/6 | Complete | 2026-05-24 |
| 12. DinoAgents Foundation | 3/3 | Complete    | 2026-05-25 |
| 13. Jungle Atmosphere | 0/TBD | Deferred to backlog | - |
| 14. Mascot Motion | 0/TBD | Deferred to backlog | - |
| 15. Themed States | 0/TBD | Deferred to backlog | - |
| 16. Ambient Polish | 0/TBD | Deferred to backlog | - |
| 17. Sound | 0/TBD | Deferred to backlog | - |
| **— v2.0 Dino Platform —** | | | |
| 18. Dino Abstraction | 1/1 | Complete   | 2026-05-29 |
| 19. Dino Picker + Explore | 1/1 | Complete   | 2026-05-29 |
| 20. Dino Mascots | 0/1 | Plan written ✎ (has human art step) | - |
| 21. Cross-Thread Memory | 1/1 | Complete   | 2026-05-29 |
| 22. Teach-a-Skill | 1/1 | Complete   | 2026-05-29 |
| 23. Dino Groupchat | 1/1 | Code complete (superseded by 35) | 2026-05-29 |
| 24. Arena + Leaderboard | 1/1 | Complete    | 2026-05-29 |
| 25. Multimodal Input | 0/TBD | Needs research spike (free vision models) | - |
| 26. Image Generation | 0/TBD | Needs research spike (free image provider) | - |
| 27. NgRx State Refactor | 1/1 | Complete   | 2026-05-30 |
| 28. Voice I/O + SSML | 2/2 | Complete (Task 5 manual pending) | 2026-06-01 |
| 29. Voice Dino Assistant | 0/TBD | Blocked on 27 + 28 | - |
| **— v2.1 Reliability, Depth & Hardening —** | | | |
| 30. UX Reliability & Cleanup | 4/4 | Complete    | 2026-06-05 |
| 31. Tool Reliability (Search + Cheerio) | 1/2 | In Progress|  |
| 32. Working Memory + Context Ring | 0/TBD | Planned | - |
| 33. Composer & Knowledge Reorg | 0/TBD | Planned | - |
| 34. AI Memory Creator | 0/TBD | Planned | - |
| 35. Conversational Group Chat | 0/TBD | Planned (supersedes 23) | - |
| 36. HTTPS / Let's Encrypt | 0/TBD | Planned (infra track) | - |

### Phase 4: Dark Theme and Visual Polish

**Goal:** Give the chatbot a cohesive desert aesthetic with day/night toggle, pixel art snake mascot, cactus scrollbar, and two Prism.js themes
**Requirements**: TBD
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Desert foundation: Tailwind color tokens, CSS custom properties, scoped Prism themes, cactus scrollbar, Google Fonts link (Wave 1)
- [x] 04-02-PLAN.md — Theme toggle: day/night switch in ChatComponent with localStorage persistence, sun/moon button, desert shell classes (Wave 2)
- [x] 04-03-PLAN.md — Bubble restyling + snake mascot: terracotta user bubbles, parchment assistant bubbles, pixel art snake avatar, markdown desert palette (Wave 2)

### Phase 5: Further UI/UX Work
**Goal:** Continue improving the look and feel of the chatbot UI
**Mode:** mvp
**Depends on:** Phase 4
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. New messages slide+fade in from their own side (~150ms); the greeting appears instantly
  2. The chat textarea caps at 5 lines and shows a scrollbar only when content overflows the cap
  3. Every assistant code block has an always-visible header bar with a language label and a copy button
**Plans**:
  - 05-01: Message entry animations on MessageBubble (Wave 1)
  - 05-02: Textarea overflow-at-max-height fix on ChatInput (Wave 1)
  - 05-03: Code block header bar — language label + copy button (Wave 2 — blocked on 05-01)

### Phase 6: Desert UI Elevation
**Goal:** Elevate the chatbot UI while keeping the desert western aesthetic — pixel snake avatar, background cactus silhouettes, floating pill input, typography polish, optional color refinements
**Mode:** mvp
**Depends on:** Phase 5
**Requirements**: SC-1, SC-2, SC-3, SC-4, SC-5
**Success Criteria** (what must be TRUE):
  1. Pixel snake avatar is clearly recognizable as a snake at rendered size; replaces current pixel art in message-bubble
  2. Decorative cactus silhouettes appear in the chat background at low opacity; never overlap message content
  3. Chat input is a floating pill-style card with send button embedded on the right; both day and night modes work
  4. Typography in the header is reviewed and intentionally chosen (Playfair Display kept or replaced with reasoning)
  5. App runs with no regressions in chat functionality
**Plans:** 2 plans

Plans:
- [ ] 06-01-PLAN.md — Snake avatar + cactus silhouettes: 24×24 profile snake SVG in message-bubble, 5 decorative cactus SVGs in chat main area (Wave 1)
- [ ] 06-02-PLAN.md — Pill input + Cinzel typography: floating rounded-2xl pill with shadow, Playfair Display → Cinzel font swap, all-caps CHATBOT header (Wave 1)

### Phase 7: Visual Overhaul
**Goal:** Complete visual overhaul of the chatbot UI — keep the existing western/desert theme (sand colors, cactus silhouettes, the soul of it) but modernize every visible component to match the polish level of ChatGPT, Claude, and Gemini. Large surface-area change across sidebar, message bubbles, input area, typography, spacing, scrolling, transitions, empty states, and loading states.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Every visible UI component (layout, sidebar, message list, bubbles, input, buttons, scrollbar, empty state, loading spinner) is restyled to a modern polish level while retaining the sand/amber/brown desert palette
  2. The sidebar shows conversation history with subtle hover states, comparable to ChatGPT's sidebar
  3. Message bubbles have clear human/AI distinction and spacious layout, comparable to Claude
  4. The input area has a polished send button and visible focus rings, comparable to Gemini
  5. A consistent typography scale and spacing system is applied across all components
  6. Micro-animations are present on key interactions (message entry, hover, focus) without harming performance
  7. App runs with no regressions in chat functionality
**Scope note:** In — every visible UI component, typography scale, spacing system, micro-animations. Out — backend changes, new features, routing changes.
**Plans:** 5/5 plans complete
**UI hint**: yes

### Phase 8: Chat History Sidebar
**Goal:** Add a left sidebar containing history of chats which are clickable to jump back into old conversations
**Mode:** mvp
**Depends on:** Phase 7
**Requirements**: D-01 through D-10 (see 08-CONTEXT.md)
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — Date-grouped session list in HistoryPanel (Wave 1)
- [x] 08-02-PLAN.md — Persistent desktop sidebar layout + responsive toggle (Wave 2)

### Phase 9: Tool Calling (Function Calling)

**Goal:** Enable the chatbot to call external tools/functions during a conversation turn so the model can fetch real information instead of hallucinating; tool calls and their results are visible in the UI as distinct, muted message blocks.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. User asks "what time is it?" → assistant calls `get_current_time` and returns the actual current time
  2. User asks something requiring fresh info (e.g. "what's the latest news on X") → assistant calls `web_search` and incorporates the result into its answer
  3. Tool call + result are visible in the chat as a distinct, muted message block between the user message and the assistant reply (shows tool name, arguments, and result)
  4. Conversation continues correctly after a tool call — follow-up questions can reference the tool result (multi-turn via MemorySaver)
  5. App runs with no regressions in existing chat functionality

**Scope note:**
- **In scope:** LangGraph tool node(s) in backend agent graph; two starter tools — `get_current_time` (no external API) and `web_search` (free provider: DuckDuckGo, Tavily, or Brave Search — easiest free tier wins); tool definitions wired through OpenRouter's OpenAI-compatible `tools` parameter; new "tool call" UI message type styled muted/secondary.
- **Out of scope:** Streaming tokens, reasoning/thinking traces, user-configurable tools, MCP, tool marketplaces, auth-gated tools, tools requiring user credentials, GCS deploy.

**Constraints:** Tech stack locked (Angular + NestJS + LangGraph + OpenRouter); Tailwind-only styling; standalone Angular components with OnPush; no database — per-session MemorySaver stays.

**Plans:** 2 plans

Plans:
- [x] 09-01-PLAN.md — Backend LangGraph tool node + `get_current_time` + `web_search` (DuckDuckGo) + extended shared types (Wave 1)
- [x] 09-02-PLAN.md — Frontend `ToolCallBubble` component + ChatComponent splice logic + chat.html role-based rendering (Wave 2 — depends on 09-01)

### Phase 10: Token Streaming (SSE, word-by-word render)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 9
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 10 to break down)

### Phase 11: Reasoning / Thinking Display

**Goal:** Stream and display reasoning/thinking tokens from models like DeepSeek R1; auto-collapse the reasoning block when the first content token arrives; persist reasoning in chat history.
**Requirements**: REQ-1 through REQ-9
**Depends on:** Phase 10
**Plans:** 6/6 plans executed

Plans:
- [x] 11-01: Shared types — reasoning fields on ChatMessage + StreamEvent union
- [x] 11-02: Backend OpenRouter reasoning streaming
- [x] 11-03: ReasoningBlock UI component
- [x] 11-04: Frontend chat wiring — accumulate + auto-collapse signals
- [x] 11-05: Compose ReasoningBlock + add DeepSeek R1 model
- [x] 11-06: E2E tests + manual smoke checklist (Task 3 pending user execution)

---

## v1.1 Milestone: DinoAgents Brand Identity

**Milestone goal:** Transform the current generic "Chatbot" into "DinoAgents" — a portfolio-grade chatbot with a distinctive prehistoric jungle aesthetic, Spinosaurus mascot, and atmospheric theming. Backend behavior unchanged; this is a visual + identity milestone.

### Phase 12: DinoAgents Foundation
**Goal:** Rebrand the visible product to "DinoAgents", swap the Soft Studio palette for a jungle palette (day + night), and integrate the Spinosaurus mascot replacing the capybara placeholder.
**Mode:** mvp
**Depends on:** v1.0 complete (Phase 11)
**Requirements:** BRAND-01, BRAND-02, BRAND-03, PAL-01, PAL-02, PAL-03, PAL-04, MASC-01, MASC-02, MASC-05
**Success Criteria** (what must be TRUE):
  1. Header title, browser tab title, and meta description read "DinoAgents"
  2. Landing-state copy includes the tagline "The AI that survived"
  3. README.md and CLAUDE.md describe the project as "SpinoChat"
  4. Day-mode background and surface colors are jungle-themed greens/beiges (not cream/tan)
  5. Night-mode background and surface colors are jungle-themed deep teals/blues with warm accents (not cool slate)
  6. A Spinosaurus mascot replaces the capybara SVG in `MessageBubble` (assistant role)
  7. The mascot also appears at hero size in the landing/empty state
  8. The mascot renders crisply at all sizes (no scaling artifacts)
**Scope note:** In — token hex re-mapping, mascot asset integration, branding text swap. Out — animations (Phase 14), background gradients/silhouettes (Phase 13), themed loading states (Phase 15).
**Plans:** 3/3 plans complete
**UI hint:** yes

### Phase 13: Jungle Atmosphere
**Goal:** Add a subtle, theme-aware jungle background system — vertical gradients + edge silhouettes — that gives the app a sense of place without competing with chat content.
**Mode:** mvp
**Depends on:** Phase 12
**Requirements:** BG-01, BG-02, BG-03
**Success Criteria** (what must be TRUE):
  1. Day mode shows a subtle warm gradient + low-opacity fern/foliage silhouette band along the bottom edge
  2. Night mode shows a sunset gradient (deep top → warm bottom) + palm silhouettes at the bottom horizon
  3. Background renders in a single reusable component that reads the active theme; no duplicated markup
  4. Background never overlaps message content or interactive elements
  5. Performance: no measurable frame-rate impact compared to v1.0 baseline
**Scope note:** In — gradient layers, edge silhouettes only. Out — animated/moving background elements (Phase 16 stretch), full illustrated scenes.
**Plans:** TBD (run `/gsd-plan-phase 13`)
**UI hint:** yes

### Phase 14: Mascot Motion
**Goal:** Bring the mascot to life with subtle, state-driven animation — idle breathing/blink, plus a reactive "thinking" state during streaming/reasoning.
**Mode:** mvp
**Depends on:** Phase 12 (mascot integration); ideally after Phase 13 so visual identity is final before motion is added
**Requirements:** MASC-03, MASC-04
**Success Criteria** (what must be TRUE):
  1. Rive (or equivalent state-driven runtime) is wired into the Angular frontend
  2. Mascot has a continuous idle breathing animation (slow, subtle)
  3. Mascot blinks occasionally during idle
  4. While a streaming response or reasoning state is active, the mascot's eyes glow (or equivalent visible "thinking" state)
  5. The "thinking" animation transitions cleanly on / off when the response completes
  6. No CLS / layout shift introduced by the animation layer
**Scope note:** In — Rive integration, idle + thinking states. Out — eye-tracking-cursor (deferred), reaction to user input keystrokes (deferred).
**Plans:** TBD (run `/gsd-plan-phase 14`)
**UI hint:** yes

### Phase 15: Themed States
**Goal:** Replace all generic "loading / typing / thinking" UI patterns (dots, spinners, generic icons) with jungle-themed equivalents that reinforce the brand.
**Mode:** mvp
**Depends on:** Phase 14
**Requirements:** STATE-01, STATE-02, STATE-03
**Success Criteria** (what must be TRUE):
  1. `TypingIndicator` shows a jungle-themed motion (pulsing ripple, footstep pattern, or equivalent) instead of three dots
  2. `ReasoningBlock` header uses themed iconography and matches the jungle palette
  3. Send-loading state uses the mascot's "thinking" animation (from MASC-04) instead of a generic spinner
  4. No regression: all existing state transitions still trigger correctly
**Plans:** TBD (run `/gsd-plan-phase 15`)
**UI hint:** yes

### Phase 16: Ambient Polish [stretch]
**Goal:** Add a subtle ambient motion layer (drifting leaves, dust, or fog) that makes the app feel alive — optional, performance-budgeted, and respects user motion preferences.
**Mode:** mvp
**Depends on:** Phase 15
**Requirements:** AMB-01, AMB-02
**Success Criteria** (what must be TRUE):
  1. An ambient motion layer (one of: drifting leaves / dust particles / fog) is implemented behind the chat content
  2. Layer is toggleable from a UI control; OFF by default
  3. Layer respects `prefers-reduced-motion: reduce` (auto-disabled)
  4. No measurable frame-rate impact when enabled on a mid-range device
**Scope note:** Stretch — only execute if Phases 12–15 ship cleanly within budget.
**Plans:** TBD (run `/gsd-plan-phase 16`)
**UI hint:** yes

### Phase 17: Sound [stretch]
**Goal:** Optional ambient audio layer (jungle / rain) for users who want immersive atmosphere — OFF by default, no autoplay, simple toggle.
**Mode:** mvp
**Depends on:** Phase 16
**Requirements:** SND-01
**Success Criteria** (what must be TRUE):
  1. A toggle in the UI enables ambient jungle/rain audio
  2. Audio never autoplays — requires explicit user action
  3. Toggle state persists across page reloads (localStorage)
  4. Audio is short loopable file(s), no streaming dependency
**Scope note:** Stretch — last and most optional phase.
**Plans:** TBD (run `/gsd-plan-phase 17`)
**UI hint:** no (UI is just a toggle button)

---

## v2.0 Milestone: Dino Platform

**Milestone goal:** Transform DinoAgents from a single-model chatbot into a platform of distinct, characterful AI agents ("dinos") — each a fixed model + system prompt + tool subset — with cross-thread memory, teachable skills, groupchat, arena + leaderboard, multimodal input, and ngrx-driven voice control.

**Execution order:** 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29. The foundation (18–20) is sequential and unblocks most later work. Memory (21–22), multi-dino (23–24), multimodal (25–26), and voice (27–29) are clusters that can be re-ordered or trimmed after the foundation if scope tightens. Voice/multimodal are deliberately last (highest complexity / external-provider risk).

**Architecture note (correcting stale docs — PLAT-01):** The backend runs a **manual agent loop** in `agents.service.ts` (LangGraph was dropped per mentor guidance), and persistence is **Postgres + Drizzle** (`sessions`, `messages`) — *not* MemorySaver-only. v2.0 builds on this real foundation.

**Identity note:** Cross-thread memory, leaderboards, and learned skills key on an **anonymous per-device id** (localStorage) until accounts land. `sessions.userId` is already a nullable text column ready for this.

### Phase 18: Dino Abstraction
**Goal:** A "dino" becomes a first-class backend concept — a registry entry of model + system prompt + allowed tool subset — and the agent loop injects the dino's system prompt and enforces its toolset. At least 4 distinct dinos exist.
**Mode:** mvp
**Depends on:** v1.0 backend (Phases 9–11)
**Requirements:** DINO-01, DINO-02, DINO-03, DINO-04, DINO-05, DINO-06, PLAT-01
**Success Criteria** (what must be TRUE):
  1. A backend dino registry defines ≥4 dinos, each with a distinct model, system prompt, and tool subset
  2. Sending a chat with a given dino injects that dino's system prompt as a system message (observable: personality differs between dinos on the same prompt)
  3. A dino cannot call a tool outside its allowed subset (server-side enforced; verified by attempting an out-of-set tool)
  4. Dino definitions are exposed to the frontend via a typed contract in `@org/shared-types`
  5. A session records which dino it belongs to and the active dino is recoverable
  6. PROJECT.md / ROADMAP.md / GSD-CONTEXT.md no longer claim LangGraph or MemorySaver-only
**Scope note:** In — backend registry, system-prompt injection, per-dino tool gating, shared types, doc correction. Out — UI picker (Phase 19), dino-specific mascots (Phase 20).
**Plans:** 1/1 plans complete
**UI hint:** no

### Phase 19: Dino Picker + Explore
**Goal:** Choosing a dino replaces choosing a model. Starting a new chat opens a dino picker, the model dropdown is gone, and an Explore page presents every dino.
**Mode:** mvp
**Depends on:** Phase 18
**Requirements:** PICK-01, PICK-02, PICK-03, PICK-04, UX-01
**Success Criteria** (what must be TRUE):
  1. Starting a new chat presents a dino picker; the chosen dino drives the session
  2. The model dropdown is removed from the composer
  3. An Explore page lists every dino with name, personality blurb, and specialty/toolset
  4. The active dino's name (and mascot slot) appears in the chat header
  5. The footer is pinned to the bottom of the viewport at all sizes
**Scope note:** In — picker UI, Explore page, header, dropdown removal, footer fix. Mascots use the existing Spino placeholder until Phase 20 supplies per-dino art.
**Plans:** 1/1 plans complete
**UI hint:** yes

### Phase 20: Dino Mascots
**Goal:** Each dino gets a unique pixel-art mascot in the exact style of `dual-mascot.png` (new species), with day/night variants produced through the existing split pipeline, integrated everywhere a dino appears.
**Mode:** mvp
**Depends on:** Phase 19 (dinos must be wired and visible first — per maker's explicit sequencing)
**Requirements:** MASC-06, MASC-07, MASC-08
**Success Criteria** (what must be TRUE):
  1. Each of the ≥4 dinos has a distinct pixel-art species mascot matching the established style
  2. Each mascot has day + night variants generated via `split-mascot.js` → optimize scripts
  3. Mascots render in the picker, Explore page, and assistant message bubbles bound to the active dino
  4. Mascots render crisply (integer-scaled, no artifacts), consistent with MASC-02
  5. Each chat row in the history panel shows the active dino's mascot icon (v2.1 rider)
**Scope note:** In — art generation per species, pipeline run, integration, per-chat mascot icon in the history panel. Out — mascot motion/animation (deferred ex-Phase 14). Art creation is partly a human/asset task; this phase defines per-species art specs and wires the pipeline + integration.
**Plans:** TBD (run `/gsd-plan-phase 20`)
**UI hint:** yes

### Phase 21: Cross-Thread Memory
**Goal:** A dino remembers facts about the user across separate threads, scoped per (user × dino), and uses them in later conversations.
**Mode:** mvp
**Depends on:** Phase 18
**Requirements:** MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):
  1. Facts surfaced in one thread with a dino are available to that dino in a different thread (same anonymous user)
  2. Memory is scoped per (user × dino): a different dino does not see another dino's memories
  3. Relevant memories are retrieved and injected into the dino's context at turn start (observable: dino references an earlier-thread fact)
  4. A new DB table backs memory; no regression to existing chat persistence
**Scope note:** In — memory schema, write/extract on turns, retrieval + injection. Out — teach-a-skill UI (Phase 22), cross-device sync (needs auth).
**Plans:** 1/1 plans complete
**UI hint:** no

### Phase 22: Teach-a-Skill
**Goal:** A user can teach a dino a skill once, in a dedicated training chat, and that skill persists and applies automatically in all future chats with that dino.
**Mode:** mvp
**Depends on:** Phase 21
**Requirements:** MEM-04, MEM-05, MEM-06
**Success Criteria** (what must be TRUE):
  1. A button in the chat opens a dedicated "teach a skill" flow for the active dino
  2. A skill taught in that flow persists and is applied in a new normal chat without re-teaching
  3. The user can view and remove a dino's learned memories and skills
**Scope note:** In — training-chat UI, skill persistence, management UI. Builds on the Phase 21 memory store.
**Plans:** 1/1 plans complete
**UI hint:** yes

### Phase 23: Dino Groupchat
**⚠ Superseded by Phase 35 (v2.1 — Conversational Group Chat).** The single-turn parallel fan-out is replaced by a turn-based orchestrator; no fallback retained.
**Goal:** The user sends one prompt and several selected dinos answer in a single, attributed view.
**Mode:** mvp
**Depends on:** Phase 19
**Requirements:** GRP-01, GRP-02
**Success Criteria** (what must be TRUE):
  1. The user can select multiple dinos and send one prompt that all of them answer
  2. Each response is clearly attributed to its dino (name + mascot)
  3. Responses stream/appear without blocking each other; no regression to single-dino chat
**Scope note:** In — multi-dino fan-out, attributed rendering. Out — dinos talking to each other (future idea).
**Plans:** TBD (run `/gsd-plan-phase 23`)
**UI hint:** yes

### Phase 24: Dino Arena + Leaderboard
**Goal:** A blind head-to-head where two dinos answer the same prompt; the user votes, identities are revealed, scores update, and a Leaderboard ranks dinos.
**Mode:** mvp
**Depends on:** Phase 19
**Requirements:** ARN-01, ARN-02, ARN-03, ARN-04
**Success Criteria** (what must be TRUE):
  1. Arena splits the screen; two dinos answer the same prompt with identities hidden
  2. The user votes for the better answer; both dinos are then revealed
  3. Votes update a persistent, documented ranking score (Elo-style or equivalent)
  4. A Leaderboard tab ranks all dinos by score
**Scope note:** In — arena UI, blind compare, voting, scoring system + table, leaderboard. Scoring algorithm is designed and documented in this phase.
**Plans:** 1/1 plans complete
**UI hint:** yes

### Phase 25: Multimodal Input
**Goal:** Users can paste screenshots; a vision dino reasons about images on a free OpenRouter vision model; OCR extracts text from screenshots.
**Mode:** mvp
**Depends on:** Phase 18
**Requirements:** VIS-01, VIS-02, VIS-03, VIS-04
**Success Criteria** (what must be TRUE):
  1. A user can paste or attach an image into the composer
  2. A vision dino accepts the image and answers questions about it via a free OpenRouter vision model
  3. The user can extract text (OCR) from a pasted screenshot
  4. Free vision-model viability is verified and documented; the vision dino degrades gracefully when unavailable
**Scope note:** In — image attach/paste, vision dino, OCR. Begin with a short spike to confirm which free vision models (e.g. Kimi, Gemma) actually work on OpenRouter. Out — image generation (Phase 26).
**Plans:** TBD (run `/gsd-plan-phase 25`)
**UI hint:** yes

### Phase 26: Image Generation
**Goal:** An artist dino generates images from text prompts, rendered inline and downloadable.
**Mode:** mvp
**Depends on:** Phase 25
**Requirements:** IMG-01, IMG-02
**Success Criteria** (what must be TRUE):
  1. The artist dino generates an image from a text prompt
  2. Generated images render inline in the chat
  3. The user can download a generated image
**Scope note:** In — image-gen integration, inline render, download. Provider/cost confirmed during the phase (free tier preferred).
**Plans:** TBD (run `/gsd-plan-phase 26`)
**UI hint:** yes

### Phase 27: NgRx State Refactor
**Goal:** Move frontend app state to NgRx and expose a whitelisted catalogue of dispatchable app actions — the foundation the voice assistant drives.
**Mode:** mvp
**Depends on:** Phase 19 (dino/session state should exist before it's modeled in the store)
**Requirements:** NGX-01, NGX-02
**Success Criteria** (what must be TRUE):
  1. Active dino, theme, chat session, and message list are managed via NgRx with typed actions/selectors
  2. A documented whitelist of dispatchable actions exists (change theme, new chat, switch chat, read/listen last message, send message)
  3. No regression: all existing flows work through the store
**Scope note:** In — store, actions, selectors, effects for existing flows; action whitelist. Out — voice (Phase 28), assistant (Phase 29). This is a refactor, not a feature — guard against regressions.
**Plans:** 1/1 plans complete
**UI hint:** no

### Phase 28: Voice I/O + SSML
**Goal:** A dino can read its responses aloud (TTS with SSML) and the user can dictate input (STT), with a free/browser fallback.
**Mode:** mvp
**Depends on:** Phase 18
**Requirements:** VOX-01, VOX-02, VOX-03
**Success Criteria** (what must be TRUE):
  1. A dino reads its response aloud on demand
  2. Spoken output uses SSML for natural prosody/pauses (or documents the fallback when the provider lacks SSML)
  3. The user can dictate a message by voice (speech-to-text)
  4. A free/browser fallback exists so voice works without a paid provider
**Scope note:** In — TTS + SSML, STT, provider/cost decision (browser SpeechSynthesis fallback vs. Azure/ElevenLabs for real SSML). Out — voice commands that control the app (Phase 29).
**Plans:** 1/2 plans executed
**UI hint:** yes

### Phase 29: Voice Dino Assistant
**Goal:** A voice assistant dino that controls the app by firing whitelisted NgRx actions, asks for clarification when ambiguous, refuses out-of-scope actions, and can find & switch to past chats.
**Mode:** mvp
**Depends on:** Phase 27 (NgRx action whitelist), Phase 28 (voice I/O)
**Requirements:** AST-01, AST-02, AST-03, AST-04
**Success Criteria** (what must be TRUE):
  1. A voice command fires a whitelisted app action (e.g. "switch to night theme", "start a new chat", "read the last message")
  2. An ambiguous command triggers a spoken clarifying question instead of a guess
  3. A command outside the whitelist (e.g. "delete my account") is declined with a spoken explanation
  4. The assistant can find and switch to a previous chat by topic/recency
**Scope note:** In — intent → whitelisted action mapping, clarification loop, refusal path, past-chat lookup. The assistant's only powers are the Phase 27 whitelist — it cannot invent actions.
**Plans:** TBD (run `/gsd-plan-phase 29`)
**UI hint:** yes

---

## v2.1 Milestone: Reliability, Depth & Production Hardening

**Milestone goal:** Harden DinoAgents for a public VM deployment and deepen the core chat experience. Fix stale-state and composer bugs, make the web tools return real data, give each conversation a working memory plus a context-usage ring, reorganize the composer around an AI-assisted Memory Creator, rebuild groupchat as a real turn-based conversation, and serve the app over HTTPS.

**Execution order:** 30 → 31 → 32 → 33 → 34 → 35. Phase 36 (HTTPS) is an independent infra track that can run at any time / in parallel. Quick-win cleanups (30) and tool fixes (31) land first; the composer/memory cluster (33 → 34) is sequential; group chat (35) is the largest and last.

**Deployment note:** The app is now served from a Compute Engine VM (not Cloud Run + Firebase Hosting). Phase 36 puts nginx + certbot in front of it. Infra resource names remain `spinochat-*` (do not rename without re-provisioning).

### Phase 30: UX Reliability & Cleanup
**Goal:** Eliminate stale-state flashes and remove dead UI so the app feels reliable.
**Mode:** mvp
**Depends on:** v2.0 (Phases 18–29)
**Requirements:** REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. Switching to another chat never briefly shows the previous conversation's messages — a loading/skeleton state covers the transition until the target thread's messages are ready
  2. Pasting/typing a very large amount of text no longer breaks the composer textarea layout (height caps and scrolls; no overflow past the pill)
  3. The "active" badge is removed from the dino picker
  4. The Explore page is removed — route, nav entry, and links — with no dead navigation
**Scope note:** In — loading states, textarea fix, two removals. Out — new features. Note: Explore removal supersedes the Explore integration mentioned in Phases 19–20.
**Plans:** 4/4 plans complete
**UI hint:** yes

### Phase 31: Tool Reliability — Web Search + Cheerio Fetch
**Goal:** The web tools return real, usable data instead of sparse or regex-mangled output.
**Mode:** mvp
**Depends on:** Phase 18 (tool gating)
**Requirements:** TOOL-01, TOOL-02
**Success Criteria** (what must be TRUE):
  1. `web_search` returns relevant real results for a current-events query — the DuckDuckGo Instant Answer API is replaced with a real free-tier provider (Tavily / Brave / SearXNG, chosen + documented in-phase)
  2. `fetch_page` uses Cheerio to extract clean main-content text (title, headings, body), replacing the regex `htmlToText` strip
  3. Both tools degrade gracefully (clear error string) when the provider is unavailable or rate-limited
**Scope note:** In — search-provider swap, Cheerio parsing, env var + `.env.example` for any API key. Out — new tools, MCP. Provider choice confirmed during the phase (free tier preferred; key in Secret Manager / `.env`).
**Plans:**1/2 plans executed
  - 31-01: web_search → Tavily (TOOL-01, Wave 1) — top-5 title+snippet+URL, 3 degradation strings, `TAVILY_API_KEY` + tests
  - 31-02: fetch_page → Cheerio (TOOL-02, Wave 1) — main-content extraction, byte/content-type hardening, soft-fallback + tests
**UI hint:** no

### Phase 32: Conversation Working Memory + Context Ring
**Goal:** Each chat keeps a working memory so attachments and fetched data persist across turns, and the UI shows how full the context is.
**Mode:** mvp
**Depends on:** Phase 31 (fetch results), Phases 25–26 (multimodal attachments)
**Requirements:** CTX-01, CTX-02, CTX-03
**Success Criteria** (what must be TRUE):
  1. An image attached earlier in a thread stays referenceable on later turns without re-attaching it (it persists in the thread's working context)
  2. A page fetched by `fetch_page` (and other fetched/tool data) is reused on follow-up turns instead of being re-downloaded each message
  3. A context-usage ring is visible in the chat, reflecting approximate context-window fill, with a visible warning as it nears the limit
  4. No regression to single-turn chat beyond the intended reuse
**Scope note:** In — per-thread working-memory store for images + fetched data, reuse on subsequent turns, context-ring UI + estimation. Out — vector/semantic retrieval (that's cross-thread memory, Phase 21). Token estimation may be approximate and documented.
**Plans:** TBD (run `/gsd-plan-phase 32`)
**UI hint:** yes

### Phase 33: Composer & Knowledge Reorg
**Goal:** Restructure the composer and skill management around a brain entry point, and make skills first-class (view + edit, not just delete).
**Mode:** mvp
**Depends on:** Phase 22 (teach-a-skill + skill store)
**Requirements:** CMP-01, CMP-02, CMP-03, CMP-04, CMP-05
**Success Criteria** (what must be TRUE):
  1. A brain icon replaces the wrench in the composer; a dedicated, clearly-labeled tools button exposes the tool toggles
  2. A `/teach` slash-command in the composer opens the teach flow; the teach modal is noticeably larger (wider + taller)
  3. A saved skill can be edited in place in the skill manager (name / trigger / instruction), not only deleted
  4. The Knowledge view lists the active dino's learned skills (each with edit + delete)
  5. No regression: existing tool toggling and teach/save still work
**Scope note:** In — composer icon/button reorg, `/teach` command, modal resize, skill edit UI + API, Knowledge skill list. Out — the AI suggestion engine (Phase 34). The brain icon's click target is wired here; its modal contents are built in Phase 34.
**Plans:** TBD (run `/gsd-plan-phase 33`)
**UI hint:** yes

### Phase 34: AI Memory Creator
**Goal:** Clicking the brain opens an AI-assisted creator that proposes what to remember from the current conversation and auto-fills an editable skill/memory form.
**Mode:** mvp
**Depends on:** Phase 33 (brain entry point), Phases 21–22 (memory + skill stores)
**Requirements:** MEMC-01, MEMC-02, MEMC-03
**Success Criteria** (what must be TRUE):
  1. Clicking the brain opens a modal that shows a dino "thinking" state, then ≥3 suggested things-worth-remembering derived from the current conversation (Claude-style recommendations)
  2. The user can pick a suggestion OR type natural text describing what to remember; submitting auto-fills the 3-field form — name / when-to-activate / instruction — fully editable before saving
  3. Saving persists the item and it auto-applies in later chats with that dino; an item that overlaps an existing memory updates it rather than duplicating — without the user choosing "new vs update" (the creator reconciles the plus/minus input automatically)
  4. No regression to the Phase 22 teach flow or existing stored skills/memories
**Scope note:** In — suggestion generation from conversation, natural-text → form synthesis, create-or-update reconciliation, editable form. Out — cross-device sync (needs auth). The new-vs-update decision is made by the synthesizer, not surfaced as a toggle.
**Plans:** TBD (run `/gsd-plan-phase 34`)
**UI hint:** yes

### Phase 35: Conversational Group Chat (supersedes Phase 23)
**Goal:** Replace the parallel fan-out with a turn-based, real-chat group conversation where each dino decides whether and how to participate.
**Mode:** mvp
**Depends on:** Phase 19 (dino picker); reuses Phases 21–22 memory
**Requirements:** GRP2-01, GRP2-02, GRP2-03, GRP2-04
**Success Criteria** (what must be TRUE):
  1. On each user message, every selected dino independently chooses to answer, react with an emoji, or stay silent — so a prompt may yield several replies, one reply, a reply + an emoji reaction, or none
  2. Addressing a specific dino (e.g. @mention) forces that dino to respond; a non-addressed but competent dino may volunteer a reply or add to the addressed dino's answer
  3. Dinos can respond to each other (bounded inter-dino turns), and the thread reads top-to-bottom like a real chat with clear per-dino attribution
  4. Group conversations are saved in the history panel and reopen with full transcript (current groupchat is ephemeral)
**Scope note:** In — turn-based orchestrator/router (per-dino speak/react/silent decision), directed-mention forcing, bounded inter-dino dialogue, emoji reactions, persisted group threads. Out — the old parallel fan-out (removed, no fallback). Loop bounds + cost caps designed and documented in-phase (build on the Phase 23 `MAX_DINOS=4` cap).
**Plans:** TBD (run `/gsd-plan-phase 35`)
**UI hint:** yes

### Phase 36: HTTPS / Let's Encrypt
**Goal:** Serve the app over HTTPS from the production VM with an auto-renewing certificate.
**Mode:** mvp
**Depends on:** none (independent infra track — can run anytime)
**Requirements:** INFRA-01
**Success Criteria** (what must be TRUE):
  1. The public domain serves a valid Let's Encrypt certificate via an nginx reverse proxy in front of the app on the Compute Engine VM
  2. Plain HTTP requests redirect to HTTPS
  3. The certificate auto-renews (certbot timer/cron) and renewal is verified (dry-run)
  4. Frontend → backend calls work over HTTPS with no mixed-content errors
**Scope note:** In — nginx reverse proxy, certbot issuance + auto-renew, HTTP→HTTPS redirect, any API base-URL/CORS updates for the HTTPS origin. Out — CDN, multi-domain, infra-as-code rewrite. Reflects the move from Cloud Run + Firebase to a VM.
**Plans:** TBD (run `/gsd-plan-phase 36`)
**UI hint:** no
