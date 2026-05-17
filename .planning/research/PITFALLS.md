# Pitfalls Research

**Project:** NestJS + LangGraph + OpenRouter + Angular chatbot
**Researched:** 2026-05-17
**Sources:** Codebase inspection (HIGH confidence) + LangChain/LangGraph/Angular library knowledge (MEDIUM confidence where verified against code patterns, LOW confidence flagged explicitly)

---

## Critical Pitfalls

---

### P1: Broken Docker image — missing `libs/` copy step

**Confidence:** HIGH (confirmed by direct Dockerfile inspection)

**What goes wrong:**
`apps/backend/Dockerfile` copies `apps/backend` and `apps/backend-e2e` into the builder stage but omits `libs/`. The backend imports `@org/shared-types` from `libs/shared-types/`. The Nx build resolves this via `tsconfig.base.json` path aliases, which point to the source file at `libs/shared-types/src/index.ts`. Because that source tree is absent in the Docker build context, `npx nx build backend --prod` inside the container either fails or produces a bundle referencing a non-existent path.

Evidence from `apps/backend/Dockerfile`:
```dockerfile
COPY apps/backend ./apps/backend
COPY apps/backend-e2e ./apps/backend-e2e
# libs/ is never copied — @org/shared-types is unresolvable
```

**Warning sign:** `npx nx build backend` succeeds locally (full monorepo present) but `docker build` throws `Cannot find module '@org/shared-types'` or a Webpack module-not-found error.

**Prevention:**
```dockerfile
COPY apps/backend ./apps/backend
COPY libs ./libs
# Remove apps/backend-e2e — not needed in production image
```

Also add `tsconfig.base.json` to the COPY list because Nx path aliases are defined there:
```dockerfile
COPY nx.json tsconfig.base.json ./   # already present — keep
COPY apps/backend ./apps/backend
COPY libs ./libs
```

**Which phase:** Fix in Phase 1 (OpenRouter wiring) because the very first CI run on the changed backend will trigger `docker-build` on `main`. The broken Dockerfile will silently pass until someone runs the image.

---

### P2: OpenRouter — wrong base URL format causes silent 404s

**Confidence:** MEDIUM (based on OpenRouter API specification knowledge; not verified against live docs in this session)

**What goes wrong:**
OpenRouter exposes an OpenAI-compatible API. The required base URL is `https://openrouter.ai/api/v1`. Common mistakes:

| Wrong value | Symptom |
|-------------|---------|
| `https://openrouter.ai/` | 404 on every request |
| `https://openrouter.ai/v1` | 404 (missing `/api` segment) |
| `https://api.openrouter.ai/v1` | Connection refused (wrong host) |
| Trailing slash omitted from correct URL | Depends on SDK path joining — usually safe but verify |

When using `@langchain/openai`'s `ChatOpenAI` to point at OpenRouter, the config is:
```typescript
import { ChatOpenAI } from '@langchain/openai';

const model = new ChatOpenAI({
  modelName: 'openai/gpt-4o-mini',   // see P3 for model ID format
  openAIApiKey: process.env['OPENROUTER_API_KEY'],
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',  // required by OpenRouter
      'X-Title': 'Chatbot',                     // optional but recommended
    },
  },
});
```

The `configuration.defaultHeaders` block is specifically required; omitting `HTTP-Referer` causes OpenRouter to reject requests with a 400 or silently route them incorrectly.

**Warning sign:** Response is `{ error: { message: "No endpoints available...", code: 404 } }` despite a valid API key. Also: HTTP 400 with message about missing referrer header.

**Prevention:**
- Put base URL in an env var (`OPENROUTER_BASE_URL`) with a default, never hardcode.
- Add a startup guard that checks `OPENROUTER_API_KEY` is set (similar to the existing `GOOGLE_API_KEY` gap — see P6).
- Smoke-test with a direct `curl` or a minimal script before wiring into LangGraph.

**Which phase:** Phase 1 (OpenRouter wiring). The entire point of that phase.

---

### P3: OpenRouter — wrong model ID format causes model-not-found errors

**Confidence:** MEDIUM (based on OpenRouter documentation patterns; not verified live)

**What goes wrong:**
OpenRouter model IDs use the format `provider/model-name`, e.g. `openai/gpt-4o-mini`, `anthropic/claude-3-haiku`, `google/gemini-flash-1.5`. Passing just `gpt-4o-mini` (the OpenAI native format) results in:
- OpenRouter returning a 404 or routing to an unexpected fallback
- No TypeScript error at compile time (it is just a string)

This is the most common OpenRouter integration mistake. The error often manifests as a cryptic LangChain error message rather than a clear "model not found".

**Warning sign:** LLM returns an error object in content rather than text, or the graph loops unexpectedly because the model response is malformed.

**Prevention:**
- Define model IDs as named constants with the full `provider/model` string.
- Add a unit test that asserts the model ID matches the regex `/^[a-z0-9-]+\/[a-z0-9._:-]+$/i`.
- Document the OpenRouter model list URL in a comment next to the constant.

**Which phase:** Phase 1 (OpenRouter wiring).

---

### P4: LangGraph MemorySaver — unbounded in-memory growth

**Confidence:** HIGH (confirmed by code inspection of `agents.service.ts:31`)

**What goes wrong:**
`MemorySaver` stores the full message array for every `thread_id` it has ever seen, in a plain JavaScript `Map` on the Node.js heap. The append reducer in `AgentState` (`reducer: (x, y) => x.concat(y)`) means the array only ever grows. In a long chat session or after many sessions, two things happen:

1. **Per-thread growth:** A single long conversation accumulates every `HumanMessage`, `AIMessage`, and `ToolMessage` ever exchanged. The entire history is sent to the LLM on every turn (LangGraph passes all messages to the model node). Eventually the message array exceeds the model's context window and the request fails.

2. **Cross-thread accumulation:** Because `thread_id` defaults to `'default'` when `body.threadId` is absent (see `agents.service.ts:78`), all requests without an explicit thread ID merge into one ever-growing conversation, corrupting memory for all users sharing that default thread.

Evidence from code:
```typescript
// agents.service.ts:78
async runAgent(message: string, threadId = 'default'): Promise<...>
// Every call without a threadId shares one global accumulating history
```

**Warning sign:**
- Responses start including context from other users' conversations.
- After many turns, the LLM throws a context-length error (e.g., `context_length_exceeded`).
- Node.js process memory climbs continuously and never releases.

**Prevention (for Task 1 / per-session scope):**
- Frontend must generate a `threadId` (UUID) per browser session and send it on every request. Never rely on the default.
- Add a `maxMessages` trim: before invoking the graph, slice the state to the last N messages (e.g., 20) to bound context window usage.
- Document that `MemorySaver` is intentionally ephemeral; if the Node process restarts, memory resets — this is acceptable per project constraints.

**Prevention (future / production):**
- Replace with `@langchain/langgraph-checkpoint-postgres` or a Redis-backed checkpointer.
- Add TTL-based eviction of idle threads.

**Which phase:** Phase 1 (thread ID management must be correct before the UI is built). The frontend UUID generation addresses the shared-default-thread bug.

---

### P5: LangGraph thread_id not sent from frontend — all users share one thread

**Confidence:** HIGH (confirmed by code: `ChatRequest.threadId` is optional and the default is `'default'`)

**What goes wrong:**
`ChatRequest` defines `threadId` as optional (`threadId?: string`). If the frontend never populates it, every user shares the `'default'` thread. Their messages are interleaved in the same `MemorySaver` bucket, and each user gets responses that incorporate everyone else's conversation history.

This is a combination of P4's default-thread problem and an explicit missing frontend feature (the frontend has no chat service yet at all).

**Warning sign:** User B's response contains context from User A's question. Easily spotted in development by opening two browser tabs.

**Prevention:**
- Generate a `threadId` with `crypto.randomUUID()` in the Angular `ChatService` at service initialization, not per-request (so the ID is stable for the session).
- Store it in a service-level field, not a component field (so navigation doesn't reset it unless desired).
- Make `threadId` required in `ChatRequest` (change `threadId?: string` to `threadId: string`) to get a compile-time error if it is ever omitted.

**Which phase:** Phase 1 (must be in the initial service implementation).

---

### P6: Missing startup guard for required environment variables

**Confidence:** HIGH (confirmed by code: no validation of `GOOGLE_API_KEY` or future `OPENROUTER_API_KEY` at startup)

**What goes wrong:**
The backend reads `process.env['GOOGLE_API_KEY']` in the `AgentsService` constructor and passes it directly to the LLM client. If the key is absent, the client is constructed with `apiKey: undefined`. The error only surfaces at the first HTTP request, not at boot time. After the switch to OpenRouter, the same pattern will apply to `OPENROUTER_API_KEY`.

This means: Docker containers start, pass health checks, serve traffic — and then return 500s to real users on their first LLM call.

Evidence from `agents.service.ts:36`:
```typescript
this.model = new ChatGoogleGenerativeAI({
  apiKey: process.env['GOOGLE_API_KEY'],  // silently undefined if not set
});
```

**Warning sign:** `docker compose up` succeeds; first chat request returns HTTP 500; logs show `AuthenticationError` or similar deep in the LangChain stack.

**Prevention:**
Add a NestJS `ConfigModule` with `validationSchema` (using Joi or `class-validator`) or a manual guard in `main.ts`:
```typescript
// main.ts — before NestFactory.create
const requiredVars = ['OPENROUTER_API_KEY'];
for (const v of requiredVars) {
  if (!process.env[v]) throw new Error(`Missing required env var: ${v}`);
}
```

Or use `@nestjs/config` with `validationSchema` for a more idiomatic solution.

**Which phase:** Phase 1 (the OpenRouter swap is the right moment to add this; it is currently not present for the Gemini key either).

---

### P7: Angular OnPush — new messages not rendering because reference not updated

**Confidence:** MEDIUM (based on Angular OnPush change detection mechanics; verified against project convention requiring OnPush on all components)

**What goes wrong:**
The project enforces `changeDetection: ChangeDetectionStrategy.OnPush` on all Angular components (per `apps/frontend/CLAUDE.md`). OnPush only re-renders when:
1. An `@Input()` reference changes
2. An `async` pipe emits
3. `markForCheck()` is called

The common mistake in a chat UI is mutating the messages array in place:
```typescript
// WRONG — OnPush will not detect this
this.messages.push(newMessage);

// CORRECT — new array reference triggers change detection
this.messages = [...this.messages, newMessage];
```

A subtler variant: a `Subject<Message[]>` that emits the same array reference after `.push()`. The `async` pipe sees the same object reference and skips rendering.

**Warning sign:** Sending a message appears to do nothing; no error in the console. Adding `console.log` shows the data is correct but the DOM does not update.

**Prevention:**
- Use an Angular `Signal` (`signal<Message[]>([])`) and call `update()`: `this.messages.update(msgs => [...msgs, newMessage])`. Signals always trigger change detection correctly.
- Or use an RxJS `BehaviorSubject<Message[]>` and call `next([...this.messages.value, newMessage])` — always emit a new array.
- Never call `.push()` on an array that is bound to an OnPush template. Add an ESLint custom rule or comment convention to enforce this.

**Which phase:** Phase 1 (chat UI implementation). Must be correct from the first commit of the message list component.

---

### P8: Angular chat scroll — auto-scroll breaks with dynamic content height

**Confidence:** MEDIUM (common Angular chat UI problem; based on framework knowledge)

**What goes wrong:**
The naive scroll-to-bottom implementation (`element.scrollTop = element.scrollHeight`) runs synchronously after pushing a new message. At that moment Angular has not yet rendered the new DOM nodes (they are scheduled for the next change detection cycle). `scrollHeight` is still the old value, so the scroll lands one message too high.

Secondary issue: if the user has manually scrolled up to read history, auto-scrolling to the bottom on every new message is jarring. Most chat UIs only auto-scroll when the user is already near the bottom.

**Warning sign:** After sending a message, the scroll position is off by roughly one message height. Becomes more noticeable with long assistant responses.

**Prevention:**
```typescript
// In the component, after updating the message list:
this.cdr.detectChanges(); // force sync render
this.messageContainer.nativeElement.scrollTop =
  this.messageContainer.nativeElement.scrollHeight;

// Or use AfterViewChecked + a flag:
ngAfterViewChecked() {
  if (this.shouldScrollToBottom) {
    this.scrollToBottom();
    this.shouldScrollToBottom = false;
  }
}
```

The cleanest approach in Angular 21 is to use `afterNextRender()` (available since Angular 17):
```typescript
afterNextRender(() => this.scrollToBottom(), { phase: AfterRenderPhase.Write });
```

**Which phase:** Phase 1 (chat UI). Note it in the implementation task, not a separate phase.

---

### P9: CORS — Angular dev server (4200) to NestJS (3000) misconfiguration

**Confidence:** HIGH (confirmed by code: CORS origin is set in `main.ts` but has an important edge case)

**What goes wrong:**
`main.ts` calls `app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' })`. This works in development. The pitfalls are:

1. **Missing credentials support:** If the frontend ever needs to send cookies or `Authorization` headers, `enableCors` must also set `credentials: true` and the `origin` must be an explicit value (not `*`). Using the current config without `credentials: true` will cause preflight failures the moment any auth-like header is added.

2. **Method/header allow-list:** NestJS's default CORS config allows GET, HEAD, PUT, PATCH, POST, DELETE. `Content-Type` and `Accept` are typically pre-allowed. This is usually fine, but if Angular's `HttpClient` adds custom headers (e.g., a future `X-Session-Id` for the thread ID), those headers must appear in `allowedHeaders`.

3. **Production origin not set:** If deployed without `CORS_ORIGIN` env var, the backend defaults to `http://localhost:4200`, which refuses requests from the real production domain. This is a silent failure in production.

**Warning sign:** Browser console shows `Access-Control-Allow-Origin` header missing. Preflight OPTIONS request returns 404 or 500. The NestJS CORS middleware must be registered before any global prefix or pipes.

**Prevention:**
- Keep `CORS_ORIGIN` in env var; document it clearly in `.env.example`.
- In `main.ts`, validate that `CORS_ORIGIN` is set in production: `if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) throw ...`
- Do not expand CORS to `*` as a debugging shortcut — it masks real problems and is dangerous.

**Which phase:** Phase 1. The current setup works for dev. Document the production footgun now so it is not forgotten at deployment time.

---

### P10: NestJS + LangGraph — unhandled promise rejections in the agent loop

**Confidence:** HIGH (confirmed by code: `AgentsService.runAgent` has no try/catch)

**What goes wrong:**
`runAgent` calls `this.graph.invoke(...)` with `await` but has no error handling. If the LLM API returns an error (network failure, rate limit, invalid model ID, context length exceeded), the rejected promise propagates through NestJS's async handler. NestJS will catch it at the default exception filter level and return HTTP 500, but:

1. The error is logged without context (no `thread_id`, no message content for debugging).
2. The MemorySaver state for that `thread_id` may be left in a partially-written intermediate state — the next request on that thread could inherit corrupted state.
3. Tool call errors inside `callTools` are not caught either — a tool failure causes the entire graph invocation to throw.

Evidence from `agents.service.ts:81`:
```typescript
const result = await this.graph.invoke(   // no try/catch
  { messages: [new HumanMessage(message)] },
  { configurable: { thread_id: threadId } },
);
```

**Warning sign:** HTTP 500 responses with no structured error body; logs show raw LangChain stack traces without context; users get no recoverable error message.

**Prevention:**
```typescript
async runAgent(message: string, threadId = 'default') {
  try {
    const result = await this.graph.invoke(...);
    // ...
    return { response };
  } catch (error) {
    this.logger.error(`Agent failed for thread ${threadId}`, error);
    throw new HttpException(
      { message: 'The assistant encountered an error. Please try again.' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
```

Also add `ValidationPipe` globally so malformed requests are caught at the controller layer, before reaching the agent.

**Which phase:** Phase 1 (the OpenRouter wiring phase, because LLM errors will be most common during that integration work).

---

### P11: ToolMessage type cast — `as unknown as BaseMessage` will cause graph errors with some LangGraph versions

**Confidence:** HIGH (confirmed by direct code inspection at `agents.service.ts:62`)

**What goes wrong:**
```typescript
results.push({ role: 'tool', content: result, tool_call_id: toolCall.id } as unknown as BaseMessage);
```

This pushes a plain object into the messages array. LangGraph's internal serialization and checkpointing (used by `MemorySaver`) calls methods like `.getType()`, `.toDict()`, or checks `instanceof BaseMessage` on state entries. A plain object has none of these methods. This works by accident in simple runs but will fail when:
- LangGraph serializes state to the checkpointer (present even with `MemorySaver`)
- Streaming mode is enabled
- The graph is inspected for debugging

The correct approach is:
```typescript
import { ToolMessage } from '@langchain/core/messages';

results.push(new ToolMessage({
  content: result,
  tool_call_id: toolCall.id,
  name: toolCall.name,
}));
```

Or use LangGraph's prebuilt `ToolNode` which handles this correctly internally.

**Warning sign:** Error messages referencing `getType is not a function` or similar in the LangGraph internals. May also cause silent message loss if LangGraph's message deserializer skips unknown types.

**Which phase:** Phase 1 (fix before adding OpenRouter; this is a correctness bug that could cause confusing behavior during integration testing).

---

## Moderate Pitfalls

---

### P12: `dotenv/config` loaded too late for NestJS providers

**Confidence:** MEDIUM

**What goes wrong:**
`main.ts` starts with `import 'dotenv/config'`, which is correct. However, if any NestJS provider, decorator, or module-level code runs before `bootstrap()` (e.g., in a module's `forRoot()` call, a static initializer, or a test bootstrap), `process.env` may not yet be populated. The current `AgentsService` reads `process.env['GOOGLE_API_KEY']` in the constructor, which runs after `bootstrap()`, so this is fine for now. But if the model is ever moved to a `forRoot()` static factory or a `useFactory` in the module definition, this ordering can break.

**Prevention:** Keep all `process.env` reads inside service constructors or factory providers, never in module-level static code. Consider `@nestjs/config` for a more robust solution.

**Which phase:** Phase 1 (low urgency, note during OpenRouter wiring).

---

### P13: Angular `HttpClient` error handling — raw HTTP errors surface in the UI

**Confidence:** MEDIUM

**What goes wrong:**
Without an HTTP interceptor or `catchError` in the chat service, any non-2xx response from the backend (e.g., the 500 from P10) causes an unhandled RxJS error. In an OnPush component subscribing via `async` pipe, this will terminate the observable — subsequent messages will never render, and the component will appear to freeze silently.

**Prevention:**
```typescript
// In ChatService
sendMessage(request: ChatRequest) {
  return this.http.post<ChatResponse>('/api/agents/chat', request).pipe(
    catchError(err => {
      return of({ response: 'Something went wrong. Please try again.' });
    })
  );
}
```

Or use an Angular HTTP interceptor for global error handling.

**Which phase:** Phase 1 (implement alongside the chat service).

---

### P14: Tailwind CSS purge — utility classes generated dynamically are stripped in production

**Confidence:** MEDIUM

**What goes wrong:**
Tailwind's content scanner reads source files to find class names. If classes are constructed via string interpolation (e.g., `'bg-' + color`), Tailwind cannot detect them and purges them from the production bundle. In a chat bubble layout, it is tempting to write:
```typescript
// WRONG
const bubbleClass = `rounded-${side === 'user' ? 'br' : 'bl'}-none`;
```

**Prevention:** Always use full, static class names. Use conditional object syntax:
```typescript
// CORRECT
[ngClass]="{ 'rounded-br-none': isUser, 'rounded-bl-none': !isUser }"
```

**Which phase:** Phase 1 (during chat bubble UI implementation).

---

### P15: npm workspaces + `node_modules` hoisting — `@langchain/openai` not installed

**Confidence:** MEDIUM

**What goes wrong:**
`@langchain/openai` is not currently in `package.json` (the current LLM is `@langchain/google-genai`). Switching to OpenRouter via `ChatOpenAI` requires installing `@langchain/openai`. Because this is an npm workspaces monorepo, the package must be added to the root `package.json`, not to `apps/backend/package.json` (which does not exist as a separate manifest). Forgetting to run `npm install` after editing `package.json` is a common source of `Cannot find module '@langchain/openai'` errors that are hard to distinguish from a path alias problem.

**Prevention:** Always run `npm install` (not `npm install --legacy-peer-deps` by default — but this project already uses `--legacy-peer-deps` in the Dockerfile, so use it consistently). Add `@langchain/openai` to the root `package.json` dependencies, not devDependencies.

**Which phase:** Phase 1, first step.

---

## Minor Pitfalls

---

### P16: Angular `async` pipe subscription lifecycle — multiple subscriptions on re-render

**Confidence:** LOW (common Angular pattern issue; not verified against current Angular 21 behavior)

**What goes wrong:**
If the `messages$` observable in the chat component is recreated (e.g., by assigning a new observable reference in the component class), the `async` pipe will unsubscribe from the old observable and subscribe to the new one. If this happens on every change detection cycle (e.g., because the observable is created inline in the template expression), it results in flicker and potentially missed emissions.

**Prevention:** Declare the observable as a class field initialized once. Do not create observables inside template expressions. Use Signals (`signal<Message[]>`) for simpler state management — they do not have this problem.

**Which phase:** Phase 1.

---

### P17: NestJS global prefix conflicts with Angular `HttpClient` base path

**Confidence:** MEDIUM

**What goes wrong:**
NestJS sets a global prefix `api` in `main.ts`. Angular `HttpClient` calls must include this prefix: `/api/agents/chat`. If the Angular service uses a relative URL without the prefix, or if the prefix is hardcoded inconsistently, requests return 404. During local development the proxy config (`angular.json` proxy) can mask this issue, leading to confusion when deploying.

Current state: No Angular `HttpClient` calls exist yet, so there is no bug. The risk is in the initial implementation.

**Prevention:** Use an Angular `InjectionToken` for the API base URL:
```typescript
export const API_BASE = new InjectionToken<string>('API_BASE', {
  factory: () => '/api'
});
```
Inject it in all services instead of hardcoding the string.

**Which phase:** Phase 1 (during chat service implementation).

---

### P18: Nx module boundary enforcement blocks cross-app imports

**Confidence:** HIGH (confirmed by ESLint config: `@nx/enforce-module-boundaries: error`)

**What goes wrong:**
`@nx/enforce-module-boundaries` is set to `error`. Direct imports between `apps/backend` and `apps/frontend` (e.g., importing a backend type directly from `apps/backend/src/...` in the frontend) will fail linting. All shared types must go through `libs/`.

This is not a bug — it is the correct pattern. The pitfall is a developer bypassing the rule by adding a raw relative path import, which breaks the lint step and makes the dependency graph incorrect for `nx affected`.

**Prevention:** Add any new shared types to `libs/shared-types/` and export them via `index.ts`. Never import across app boundaries without a lib intermediary.

**Which phase:** All phases. Already enforced by tooling; just needs awareness.

---

## Phase Mapping

| Pitfall | Severity | Phase to Address |
|---------|----------|-----------------|
| P1: Dockerfile missing `libs/` copy | Critical | Phase 1 — OpenRouter wiring |
| P2: OpenRouter wrong base URL | Critical | Phase 1 — OpenRouter wiring |
| P3: OpenRouter wrong model ID format | Critical | Phase 1 — OpenRouter wiring |
| P4: MemorySaver unbounded memory growth | Critical | Phase 1 — thread_id must be sent from UI |
| P5: thread_id not sent from frontend | Critical | Phase 1 — ChatService implementation |
| P6: Missing env var startup guard | Critical | Phase 1 — OpenRouter wiring |
| P7: OnPush — array mutation not detected | Critical | Phase 1 — message list component |
| P8: Auto-scroll timing with async render | Moderate | Phase 1 — chat UI |
| P9: CORS misconfiguration in production | Moderate | Phase 1 — document now, fix before deploy |
| P10: Unhandled LangGraph promise rejections | Critical | Phase 1 — OpenRouter wiring |
| P11: ToolMessage plain-object type cast | Critical | Phase 1 — fix before OpenRouter integration |
| P12: dotenv/config ordering risk | Minor | Phase 1 — low urgency, note during wiring |
| P13: HttpClient errors terminate observable | Moderate | Phase 1 — chat service |
| P14: Tailwind dynamic class purge | Moderate | Phase 1 — chat bubble component |
| P15: `@langchain/openai` not installed | Critical | Phase 1 — first step |
| P16: async pipe re-subscription on re-render | Minor | Phase 1 — chat component |
| P17: API base URL hardcoding | Moderate | Phase 1 — chat service |
| P18: Nx module boundary violations | Minor | All phases — enforced by tooling |

---

*Pitfalls research: 2026-05-17*
