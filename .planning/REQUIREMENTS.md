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

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 after roadmap creation — traceability confirmed*
