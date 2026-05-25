# Requirements: Chatbot

**Defined:** 2026-05-17
**Core Value:** A user can open the app, type a message, get a real answer, and keep the conversation going.

## v1 Requirements

### Backend

- [ ] **BACK-01**: Backend uses OpenRouter as the LLM provider (ChatOpenAI pointed at `https://openrouter.ai/api/v1`)
- [ ] **BACK-02**: Default model is `openai/gpt-4o-mini`
- [ ] **BACK-03**: LangGraph graph simplified to `START → agent → END` (placeholder search tool removed)
- [ ] **BACK-04**: `@langchain/openai` declared explicitly in package.json (not just a transitive dep)
- [ ] **BACK-05**: Dockerfile copies `libs/` so `@org/shared-types` resolves inside Docker

### Chat UI

- [ ] **UI-01**: User can type a message in a text input and submit it (Enter key or send button)
- [ ] **UI-02**: Messages are displayed in a bubble layout — user messages on the right, assistant messages on the left
- [ ] **UI-03**: A loading indicator (typing dots) is visible while waiting for the assistant response
- [ ] **UI-04**: The message list automatically scrolls to the newest message

### Conversation

- [ ] **CONV-01**: The frontend generates a `threadId` (UUID) once per session and sends it with every request so the backend MemorySaver maintains conversation context across turns
- [ ] **CONV-02**: Refreshing the page or opening a new tab starts a fresh conversation

### Deployment & Quality

- [ ] **DEPLOY-01**: Backend Docker image is built and deployed to GCP Cloud Run; accessible via Cloud Run public URL
- [ ] **DEPLOY-02**: Angular frontend is built and deployed to Firebase Hosting; accessible via Firebase public URL with the backend URL configured
- [ ] **DEPLOY-03**: GitHub Actions CI/CD pipeline runs lint + build on every push; deploys backend to Cloud Run and frontend to Firebase Hosting on push to `main`
- [ ] **E2E-01**: Playwright E2E test covers the core happy path — app loads, user sends a message, assistant response appears in the chat bubble list

### Model Switching (Task 2)

- [ ] **MODEL-01**: User can select from a list of available models in the UI and the selection is used for subsequent messages

## v1.1 Requirements — SpinoChat Brand Identity

**Defined:** 2026-05-25
**Scope:** Visual + identity overhaul of the existing working chatbot — rebrand to "SpinoChat", introduce jungle aesthetic + Spinosaurus mascot ("Spino"), themed motion and states. Backend behavior unchanged.
**Context:** Portfolio project. No production-grade requirements (legal, GDPR, accessibility certification, etc.) imposed by this milestone.

### Brand

- [ ] **BRAND-01**: All visible product naming in the UI reads "SpinoChat" or short-form "Spino" — header title, browser tab title, meta description, landing-state copy
- [ ] **BRAND-02**: The tagline "The AI that survived" is placed at least once on the landing/empty state
- [ ] **BRAND-03**: README.md and CLAUDE.md project description updated to "SpinoChat"

### Visual identity (palette)

- [ ] **PAL-01**: Day-mode palette is a daytime-jungle theme — warm sunlit greens, beige/sand neutrals, soft amber highlights. Replaces current Soft Studio cream/tan day palette
- [ ] **PAL-02**: Night-mode palette is a night-jungle / sunset theme — deep teals/blues, warm sunset orange/coral accents, optional bioluminescent-style accent for highlights. Replaces current Soft Studio slate dark palette
- [ ] **PAL-03**: Both palettes pass minimum readable contrast for body text against background (WCAG AA — pragmatic enforcement, not formal audit)
- [ ] **PAL-04**: All existing `studio-*` Tailwind tokens get re-mapped hex values; no new token names introduced (palette swap is hex-only; no rename pass needed)

### Mascot (Spino)

- [ ] **MASC-01**: A Spinosaurus-inspired mascot replaces the current capybara SVG in `MessageBubble` (assistant role)
- [ ] **MASC-02**: Mascot renders crisply at all sizes — vector (SVG / Rive) or PNG rendered at integer-multiple of native size
- [ ] **MASC-03**: Mascot has an idle breathing/blink animation (subtle, slow loop)
- [ ] **MASC-04**: Mascot has a distinct visual state during a "thinking" (streaming/reasoning) response — eyes glow or equivalent
- [ ] **MASC-05**: Mascot is also shown at larger size in the landing/empty state (hero placement) before any messages are sent

### Atmosphere (background)

- [ ] **BG-01**: Day-mode chat background uses a subtle vertical gradient + low-opacity silhouette band (e.g. fern fronds) along the bottom edge — must never overlap or compete with message content
- [ ] **BG-02**: Night-mode chat background uses a sunset gradient (deep top → warm bottom) + palm silhouettes at the bottom horizon
- [ ] **BG-03**: Background is implemented in a single shared component so day/night variants stay in lockstep with the theme toggle

### Themed states

- [ ] **STATE-01**: The typing indicator (`TypingIndicator` component) is re-skinned to feel jungle-themed — pulsing ripple, footstep pattern, or equivalent — not generic dots
- [ ] **STATE-02**: The reasoning block (`ReasoningBlock` component) header is restyled to match the jungle palette and uses themed iconography instead of the generic "thinking" icon
- [ ] **STATE-03**: The send-loading state (during a request) uses a themed mascot animation instead of a generic spinner — at minimum the mascot's "thinking" state from MASC-04

### Stretch (optional — only if earlier phases ship cleanly)

- [ ] **AMB-01**: An ambient motion layer (slow drifting leaves OR dust particles OR fog) overlays the chat background. Performance budget: must not drop frame rate measurably; toggleable via a UI control; OFF by default
- [ ] **AMB-02**: Ambient motion respects `prefers-reduced-motion` (auto-off when set)
- [ ] **SND-01**: An ambient jungle/rain audio layer can be toggled on from the UI. OFF by default. Volume control or simple on/off. No autoplay

### Out of v1.1 scope

| Item | Reason |
|------|--------|
| Backend changes | Visual/identity milestone only — backend (`agents.service.ts`, LangGraph, OpenRouter) unchanged |
| Mobile native apps | Web-first portfolio piece |
| Trademark filing, domain purchase | Deferred — pending decision on public release |
| Full WCAG audit | Pragmatic contrast check only; formal accessibility audit deferred |
| Per-user theme customization | Day/night toggle is sufficient |
| Internationalization of brand copy | English only |

## v2 Requirements

### Enhancement

- **ENH-01**: Persistent conversation history across sessions (requires database)
- **ENH-02**: Markdown rendering in assistant messages
- **ENH-03**: Message timestamps
- **ENH-04**: Copy-to-clipboard on messages
- **ENH-05**: Real web search tool (replace placeholder with Tavily/SerpAPI)
- **ENH-06**: Rate limiting on the chat endpoint
- **ENH-07**: Input validation with `ValidationPipe` and DTOs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Image / video / audio input | Task 1 spec explicitly limits to text-only |
| Authentication / user accounts | Not in scope for current tasks |
| Persistent history across sessions | User chose per-session; MemorySaver is sufficient |
| Real web search | Placeholder acceptable; not needed for core chat |
| Mobile app | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BACK-01 | Phase 1 | Pending |
| BACK-02 | Phase 1 | Pending |
| BACK-03 | Phase 1 | Pending |
| BACK-04 | Phase 1 | Pending |
| BACK-05 | Phase 1 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| CONV-01 | Phase 1 | Pending |
| CONV-02 | Phase 1 | Pending |
| DEPLOY-01 | Phase 1 | Pending |
| DEPLOY-02 | Phase 1 | Pending |
| DEPLOY-03 | Phase 1 | Pending |
| E2E-01 | Phase 1 | Pending |
| MODEL-01 | Phase 2 | Pending |
| BRAND-01..03 | Phase 12 | Pending |
| PAL-01..04 | Phase 12 | Pending |
| MASC-01..02 | Phase 12 | Pending |
| MASC-05 | Phase 12 | Pending |
| BG-01..03 | Phase 13 | Pending |
| MASC-03..04 | Phase 14 | Pending |
| STATE-01..03 | Phase 15 | Pending |
| AMB-01..02 | Phase 16 (stretch) | Pending |
| SND-01 | Phase 17 (stretch) | Pending |

**Coverage:**
- v1 requirements: 16 total — mapped (Phases 1-11)
- v1.1 requirements: 19 total — mapped to Phases 12-17 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-25 — v1.1 SpinoChat brand-identity requirements added*
