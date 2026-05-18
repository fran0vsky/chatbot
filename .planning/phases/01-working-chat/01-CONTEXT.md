# Phase 1: Working Chat - Context

**Gathered:** 2026-05-17
**Updated:** 2026-05-18 — added deployment decisions D-17 through D-26 (GCP Cloud Run + Firebase Hosting + CI/CD)
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers a fully working end-to-end chat application:
1. **Backend** — Switch LLM provider from Google Gemini to OpenRouter (via `@langchain/openai` with `baseURL` override), simplify LangGraph graph to `START → agent → END` (remove placeholder search tool), declare `@langchain/openai` as explicit dependency, fix Dockerfile `libs/` copy.
2. **Frontend** — Build bubble chat UI from scratch on the Angular SPA skeleton: `App → app-chat → app-message-bubble` component tree, `ChatService` for HTTP, per-session UUID thread ID, typing indicator, auto-scroll.
3. **Scope boundary** — Per-session memory only (MemorySaver stays). No model switching (Phase 2). No persistent history.

</domain>

<decisions>
## Implementation Decisions

### Component Structure
- **D-01:** Chat UI uses a three-level component tree: `App` (root, minimal — just hosts `app-chat`) → `app-chat` (messages list + input form, holds all chat state) → `app-message-bubble` (renders a single message bubble; receives message data as input).
- **D-02:** HTTP calls live in a dedicated `ChatService` (injectable Angular service with a `sendMessage()` method). The component does NOT call `HttpClient` directly. `ChatService` also generates and holds the `threadId` UUID for the session.

### Error Handling UX
- **D-03:** API errors are shown as inline bubbles in the message list, positioned immediately after the failed user message (not a toast or below-input text).
- **D-04:** Error bubbles are visually distinct from assistant messages: red/orange tint styling (e.g. `bg-red-50 border border-red-200 text-red-700`) with a warning icon — left-aligned like assistant messages.
- **D-05:** Error message text is generic and user-friendly: "Something went wrong. Please try again." — no HTTP status codes or technical details surfaced.
- **D-06:** No retry button — the input is re-enabled immediately after the error so the user can retype and resend.
- **D-07:** The failed user message stays visible in the chat list; the error bubble appears below it (standard chat app pattern: WhatsApp, Slack).

### Input Area
- **D-08:** Message field is an auto-expanding `<textarea>` — starts as a single line, grows up to ~5 lines as the user types. NOT a fixed single-line `<input>`.
- **D-09:** Enter key sends the message; Shift+Enter adds a newline. (Standard chatbot behavior matching Claude.ai, ChatGPT.)
- **D-10:** Both the textarea and the Send button are disabled while the assistant is responding (prevents double-send, avoids out-of-order messages).
- **D-11:** Send button shows an icon only (arrow or paper-plane SVG) — no text label.
- **D-12:** Textarea placeholder text: `"Message"`.

### Page Layout
- **D-13:** Full-viewport layout — chat fills the entire browser window. No centered card or surrounding background. Messages area takes all available vertical space; input bar is pinned at the bottom.
- **D-14:** Visible header at the top of the viewport showing the app name ("Chatbot"). This header is also the logical home for the Phase 2 model selector — implement it as a distinct header element that can accept content in Phase 2 without restructuring.
- **D-15:** Message bubbles have a max-width of ~75% of the message area, aligned to their side (user right, assistant left). Long messages do not stretch full-width.
- **D-16:** A border/divider line separates the scrollable messages area from the fixed input bar at the bottom.

### Claude's Discretion
- **Color scheme:** Claude picks a clean neutral light theme using Tailwind defaults (white/light-gray backgrounds, appropriate text contrast). No dark mode required for Phase 1.

### Deployment — Backend (GCP Cloud Run)
- **D-17:** Backend deploys to GCP Cloud Run. Container image stored in GCP Artifact Registry (not GHCR). Cloud Run handles HTTPS, scaling to zero, and public URL.
- **D-18:** GitHub Actions authenticates to GCP via Workload Identity Federation (WIF) — no long-lived service account JSON keys stored as secrets. GCP project ID and WIF pool/provider stored as GitHub Actions variables (not secrets).
- **D-19:** `OPENROUTER_API_KEY` is stored in GCP Secret Manager and mounted as an environment variable in the Cloud Run service (not passed as a build arg or hardcoded).
- **D-20:** `CORS_ORIGIN` env var in Cloud Run is set to the Firebase Hosting URL so the backend only accepts requests from the deployed frontend.

### Deployment — Frontend (Firebase Hosting)
- **D-21:** Frontend deploys to Firebase Hosting. `firebase.json` and `.firebaserc` in repo root define the hosting config (`dist/apps/frontend/browser` as the public directory, SPA rewrite to `index.html`).
- **D-22:** Firebase deploy in GitHub Actions uses a Firebase service account key stored as `FIREBASE_SERVICE_ACCOUNT` GitHub secret (standard Firebase CI approach).
- **D-23:** Frontend build passes the Cloud Run service URL as `BACKEND_URL` via Angular environment files (`environment.prod.ts`) so the deployed frontend hits the real Cloud Run backend.

### CI/CD Pipeline
- **D-24:** `.github/workflows/ci.yml` is updated to add two deploy jobs after the existing `lint-test-build` job succeeds on `main`: `deploy-backend` (build Docker image → push to Artifact Registry → update Cloud Run service) and `deploy-frontend` (build Angular → firebase deploy).
- **D-25:** Existing GHCR push step is removed and replaced with Artifact Registry push.
- **D-26:** E2E Playwright test runs in CI against local dev servers (backend served via `nx serve backend`, frontend via `nx serve frontend`) with `OPENROUTER_API_KEY` available as a GitHub Actions secret. E2E covers: page loads, user types message, assistant response bubble appears.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Goals
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria (the 5 success criteria define what "done" means)
- `.planning/REQUIREMENTS.md` — Full v1 requirements (BACK-01 through CONV-02 are Phase 1 scope)
- `.planning/PROJECT.md` — Project context, key decisions, constraints (OpenRouter, GPT-4o mini, MemorySaver)

### API Contract
- `libs/shared-types/src/lib/chat.types.ts` — `ChatRequest { message: string; threadId?: string }` and `ChatResponse { response: string }` — use as-is, no modifications needed

### Backend (to be modified)
- `apps/backend/src/app/agents/agents.service.ts` — Current LangGraph implementation using `ChatGoogleGenerativeAI`; needs to be replaced with `ChatOpenAI` + OpenRouter config
- `apps/backend/src/app/agents/agents.controller.ts` — `POST /api/agents/chat` endpoint; no changes expected
- `apps/backend/src/app/agents/agents.module.ts` — Module wiring; may need provider updates
- `apps/backend/Dockerfile` — Missing `COPY libs/` step (BACK-05 bug to fix)
- `apps/backend/package.json` — `@langchain/openai` must be declared as explicit dep (BACK-04)

### Frontend (to be created)
- `apps/frontend/src/app/app.ts` — Current root component (Nx welcome placeholder); will become the minimal `app-chat` host
- `apps/frontend/src/app/app.config.ts` — Providers; `provideHttpClient()` already wired — `ChatService` can inject immediately
- `apps/frontend/src/app/app.routes.ts` — Routing config; currently empty

### Conventions
- `.planning/codebase/CONVENTIONS.md` — Naming, linting rules, Angular standalone requirement, Tailwind-only styling
- `.planning/codebase/ARCHITECTURE.md` — Component responsibilities, data flow pattern, entry points

No external ADRs or design specs were referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatRequest` / `ChatResponse` interfaces (`libs/shared-types`) — use as-is; already imported correctly in `AgentsController`
- `provideHttpClient()` in `app.config.ts` — already configured; `ChatService` can inject `HttpClient` with no setup
- `@angular/forms` — available in package.json; `ReactiveFormsModule` or `FormsModule` can be imported in `app-chat` for the textarea form control
- `AgentsController` — `POST /api/agents/chat` already exists and works; only the service layer needs changes

### Established Patterns
- Angular standalone components with `OnPush` change detection — enforced by ESLint (`@angular-eslint/prefer-standalone: error`); all new components follow this
- Tailwind CSS only for styling — no inline styles, no SCSS modules beyond global `styles.scss`
- NestJS `@Injectable()` services with `private readonly` constructor injection — follow for `ChatService` pattern on backend
- `process.env['VAR_NAME']` bracket notation for env vars in backend (e.g. `OPENROUTER_API_KEY`)
- External template files (`.html`) and style files (`.scss`) per component — no inline templates

### Integration Points
- `app-chat` replaces the `NxWelcome` component in `App`'s template — minimal change to the root component
- `ChatService` injects `HttpClient`, calls `POST http://localhost:3000/api/agents/chat` (dev) with `ChatRequest`, receives `ChatResponse`
- Backend `AgentsService` constructor — replace `new ChatGoogleGenerativeAI(...)` with `new ChatOpenAI({ apiKey: process.env['OPENROUTER_API_KEY'], configuration: { baseURL: 'https://openrouter.ai/api/v1' }, modelName: 'openai/gpt-4o-mini' })`
- Thread ID: `ChatService` generates a `crypto.randomUUID()` once on instantiation; passed as `threadId` in every `ChatRequest`

</code_context>

<specifics>
## Specific Ideas

- **OpenRouter wiring:** `@langchain/openai` package with `configuration.baseURL: 'https://openrouter.ai/api/v1'` — this is the LangChain-native approach, consistent with the existing LangGraph stack. Direct `openai` SDK is NOT preferred.
- **Model name format:** OpenRouter uses namespaced model IDs — the correct string is `'openai/gpt-4o-mini'` (not just `'gpt-4o-mini'`). This is a gotcha that must be correct.
- **Typing indicator:** Requirements specify "typing dots" (UI-03) — implement as an animated three-dot indicator rendered as an assistant-style bubble in the message list while `isLoading` is true.
- **Auto-scroll:** Use `scrollIntoView({ behavior: 'smooth' })` on the last message element via a `ViewChild` or `#lastMessage` template ref — simpler than CDK virtual scroll for this use case.
- **Thread ID:** `crypto.randomUUID()` is available in modern browsers without any library import.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Working Chat*
*Context gathered: 2026-05-17*
