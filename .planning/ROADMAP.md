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

## v1.1 — SpinoChat Brand Identity (begins 2026-05-25)

- [ ] **Phase 12: SpinoChat Foundation** - Jungle palette (hex-only swap on existing `studio-*` tokens), Spinosaurus mascot integration, "Chatbot" → "SpinoChat / Spino" rename, tagline placement
- [ ] **Phase 13: Jungle Atmosphere** - Background gradient system (day/night), edge silhouettes (palms/ferns), shared theme-aware BG component
- [ ] **Phase 14: Mascot Motion** - Rive integration; idle breathing + blink; reactive "thinking" state (eye glow) bound to streaming/reasoning signals
- [ ] **Phase 15: Themed States** - Re-skin TypingIndicator, ReasoningBlock, and request-loading state with jungle-themed visuals (replace generic dots/spinners)
- [ ] **Phase 16: Ambient Polish [stretch]** - Optional ambient motion layer (drifting leaves / dust / fog), toggleable, respects `prefers-reduced-motion`
- [ ] **Phase 17: Sound [stretch]** - Optional ambient jungle audio layer, toggleable, OFF by default, no autoplay

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
| 12. SpinoChat Foundation | 0/TBD | Planned (v1.1) | - |
| 13. Jungle Atmosphere | 0/TBD | Planned (v1.1) | - |
| 14. Mascot Motion | 0/TBD | Planned (v1.1) | - |
| 15. Themed States | 0/TBD | Planned (v1.1) | - |
| 16. Ambient Polish | 0/TBD | Planned (v1.1, stretch) | - |
| 17. Sound | 0/TBD | Planned (v1.1, stretch) | - |

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

## v1.1 Milestone: SpinoChat Brand Identity

**Milestone goal:** Transform the current generic "Chatbot" into "SpinoChat" — a portfolio-grade chatbot with a distinctive prehistoric jungle aesthetic, Spinosaurus mascot, and atmospheric theming. Backend behavior unchanged; this is a visual + identity milestone.

### Phase 12: SpinoChat Foundation
**Goal:** Rebrand the visible product to "SpinoChat / Spino", swap the Soft Studio palette for a jungle palette (day + night), and integrate the Spinosaurus mascot replacing the capybara placeholder.
**Mode:** mvp
**Depends on:** v1.0 complete (Phase 11)
**Requirements:** BRAND-01, BRAND-02, BRAND-03, PAL-01, PAL-02, PAL-03, PAL-04, MASC-01, MASC-02, MASC-05
**Success Criteria** (what must be TRUE):
  1. Header title, browser tab title, and meta description read "SpinoChat" / "Spino"
  2. Landing-state copy includes the tagline "The AI that survived"
  3. README.md and CLAUDE.md describe the project as "SpinoChat"
  4. Day-mode background and surface colors are jungle-themed greens/beiges (not cream/tan)
  5. Night-mode background and surface colors are jungle-themed deep teals/blues with warm accents (not cool slate)
  6. A Spinosaurus mascot replaces the capybara SVG in `MessageBubble` (assistant role)
  7. The mascot also appears at hero size in the landing/empty state
  8. The mascot renders crisply at all sizes (no scaling artifacts)
**Scope note:** In — token hex re-mapping, mascot asset integration, branding text swap. Out — animations (Phase 14), background gradients/silhouettes (Phase 13), themed loading states (Phase 15).
**Plans:** TBD (run `/gsd-plan-phase 12`)
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
