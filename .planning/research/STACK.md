# Stack Research

**Project:** Chatbot — OpenRouter provider swap
**Researched:** 2026-05-17
**Overall confidence:** HIGH (OpenRouter API and LangChain ChatOpenAI integration patterns have been stable and well-documented since 2024)

---

## Recommended Approach

Replace `ChatGoogleGenerativeAI` with `ChatOpenAI` from `@langchain/openai`, pointed at OpenRouter's OpenAI-compatible endpoint. This is the officially documented and community-standard approach. No extra packages are needed beyond what is implied by the swap.

**One-liner:** `new ChatOpenAI({ modelName, openAIApiKey, configuration: { baseURL, defaultHeaders } })`

---

## OpenRouter Integration

### Package Choice

**Use `@langchain/openai`.** Do not use the bare `openai` SDK or `@openrouter/ai-sdk-provider`.

| Package | Verdict | Reason |
|---------|---------|--------|
| `@langchain/openai` | **Recommended** | Native LangChain integration; `ChatOpenAI` supports `configuration.baseURL` and `configuration.defaultHeaders`; works with `model.bindTools()`, `MemorySaver`, and all LangGraph patterns exactly as the current Gemini code does. Drop-in replacement at the service layer. |
| `openai` (bare SDK) | Avoid | Requires writing a custom LangChain wrapper or abandoning LangChain abstractions; would require significant refactoring of `AgentsService` and lose `bindTools` / state-graph compatibility. |
| `@openrouter/ai-sdk-provider` | Avoid | This is a Vercel AI SDK adapter, not a LangChain adapter. Incompatible with LangGraph without a full framework switch. |

**Install:**

```bash
npm install @langchain/openai
```

`@langchain/core` and `@langchain/langgraph` are already present — no additional peer dependencies needed.

After the swap, `@langchain/google-genai` can be removed from `package.json` (it is only used in `agents.service.ts`):

```bash
npm uninstall @langchain/google-genai
```

---

### baseURL and Auth

OpenRouter exposes an OpenAI-compatible chat-completions endpoint:

```
https://openrouter.ai/api/v1
```

Authentication uses a standard Bearer token in the `Authorization` header, identical to the OpenAI SDK convention. `ChatOpenAI` accepts this via the `openAIApiKey` constructor option (which it forwards as `Authorization: Bearer <key>`).

```typescript
import { ChatOpenAI } from '@langchain/openai';

this.model = new ChatOpenAI({
  modelName: 'openai/gpt-4o-mini',          // OpenRouter model ID
  openAIApiKey: process.env['OPENROUTER_API_KEY'],
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:4200',   // see Required Headers below
      'X-Title': 'Chatbot',
    },
  },
});
```

The `configuration` object is passed directly to the underlying `openai` SDK client that `@langchain/openai` uses internally, so any field accepted by `new OpenAI({ ... })` from the bare `openai` package is valid here.

**Confidence: HIGH** — OpenRouter officially documents this exact pattern in their "Frameworks" guide. The `configuration.baseURL` + `configuration.defaultHeaders` path has been stable in `@langchain/openai` since v0.1.x.

---

### Required Headers

OpenRouter requires/expects two headers:

| Header | Required? | Value | Purpose |
|--------|-----------|-------|---------|
| `Authorization` | **Required** | `Bearer <OPENROUTER_API_KEY>` | Auth — sent automatically by `ChatOpenAI` via `openAIApiKey` |
| `HTTP-Referer` | Recommended | URL of your app (e.g. `http://localhost:4200`) | Rate-limit attribution and abuse detection; requests without it still work but may be throttled more aggressively |
| `X-Title` | Optional | Human-readable app name (e.g. `"Chatbot"`) | Shown in OpenRouter's dashboard usage logs for your API key |

Both `HTTP-Referer` and `X-Title` are passed via `configuration.defaultHeaders` as shown above. They are not required for the API call to succeed, but OpenRouter's documentation explicitly requests them for proper attribution, and they add zero complexity.

**Confidence: HIGH** — documented on openrouter.ai/docs as stable API surface.

---

### Model IDs

OpenRouter uses a namespaced format: `<provider>/<model-slug>`.

| Model | OpenRouter ID | Notes |
|-------|--------------|-------|
| GPT-4o mini | `openai/gpt-4o-mini` | Default target for this project per PROJECT.md; fast, cheap, 128k context |
| GPT-4o | `openai/gpt-4o` | Higher capability, higher cost |
| Claude 3.5 Haiku | `anthropic/claude-3-5-haiku` | Fast Anthropic alternative |
| Claude 3.5 Sonnet | `anthropic/claude-3-5-sonnet` | Strong Anthropic alternative |
| Gemini 2.0 Flash | `google/gemini-2.0-flash-001` | Back to Gemini via OpenRouter if needed |
| Llama 3.1 70B | `meta-llama/llama-3.1-70b-instruct` | Free tier available |

The model ID is passed as `modelName` in `ChatOpenAI`. For future model-switching (TASK MODEL-01), this is the single string that changes — the rest of the constructor stays identical across all OpenRouter-hosted models.

**Confirmation of GPT-4o mini ID:** `openai/gpt-4o-mini` — this is the canonical OpenRouter slug. **Confidence: HIGH.**

---

### Model Switching (MODEL-01 preparation)

Because model identity is entirely captured in `modelName`, the cleanest pattern for future model-switching is to accept the model ID as a parameter on `runAgent` (or on a separate `setModel` method) and construct `ChatOpenAI` lazily or on-demand:

```typescript
// Option A: pass modelName per-request (simplest, stateless)
async runAgent(message: string, threadId = 'default', modelName = 'openai/gpt-4o-mini') {
  const model = new ChatOpenAI({
    modelName,
    openAIApiKey: process.env['OPENROUTER_API_KEY'],
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': '...', 'X-Title': 'Chatbot' },
    },
  });
  // rebuild graph with this model, or use model directly
}

// Option B: store modelName on service, rebuild graph when it changes (Task 2)
```

Option A is simplest for Task 1; Option B fits the MODEL-01 requirement better. Either works because `ChatOpenAI` construction is cheap (no persistent connection is opened — OpenRouter is stateless HTTP).

---

### Environment Variable

Add to `.env` (and `.env.example`):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

Remove (or keep as unused):

```
GOOGLE_API_KEY=...   # no longer needed after swap
```

---

## Exact Diff Summary for agents.service.ts

| Before | After |
|--------|-------|
| `import { ChatGoogleGenerativeAI } from '@langchain/google-genai'` | `import { ChatOpenAI } from '@langchain/openai'` |
| `private readonly model: ChatGoogleGenerativeAI` | `private readonly model: ChatOpenAI` |
| `new ChatGoogleGenerativeAI({ model: 'gemini-2.0-flash-lite', apiKey: process.env['GOOGLE_API_KEY'] })` | `new ChatOpenAI({ modelName: 'openai/gpt-4o-mini', openAIApiKey: process.env['OPENROUTER_API_KEY'], configuration: { baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'HTTP-Referer': '...', 'X-Title': 'Chatbot' } } })` |

Everything else in `AgentsService` — `buildGraph`, `bindTools`, `MemorySaver`, `StateGraph`, `runAgent` — stays byte-for-byte identical. The LangChain interface `ChatOpenAI` exposes is the same as `ChatGoogleGenerativeAI` at the graph level.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| LangChain provider package | `@langchain/openai` | `openai` bare SDK | Requires rewriting graph integration; no `bindTools` compatibility |
| LangChain provider package | `@langchain/openai` | `@openrouter/ai-sdk-provider` | Vercel AI SDK only; incompatible with LangGraph |
| LLM default model | `openai/gpt-4o-mini` | `openai/gpt-4o` | Cost; gpt-4o-mini is sufficient for general chat and was explicitly chosen in PROJECT.md |
| Header injection | `configuration.defaultHeaders` | Axios interceptor / custom HTTP agent | `defaultHeaders` is the documented path; no custom HTTP layer needed |

---

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| `@langchain/openai` as correct package | HIGH | Only LangChain-native OpenAI-compatible client; officially documented |
| `baseURL: 'https://openrouter.ai/api/v1'` | HIGH | Stable, unchanged OpenRouter endpoint since launch |
| `openAIApiKey` maps to Bearer auth | HIGH | OpenAI SDK convention; LangChain passes it as `Authorization: Bearer` |
| `configuration.defaultHeaders` for HTTP-Referer / X-Title | HIGH | Stable `@langchain/openai` constructor option, passes through to `openai` SDK client |
| `openai/gpt-4o-mini` model ID | HIGH | Canonical OpenRouter slug format; `gpt-4o-mini` has been the slug since model launch |
| No graph refactor needed | HIGH | `ChatOpenAI` and `ChatGoogleGenerativeAI` share the same `BaseChatModel` interface |
| `@langchain/openai` version compatibility with existing `@langchain/core ^1.1.46` | MEDIUM | LangChain v1.x introduced breaking peer dep changes; verify compatible `@langchain/openai` version resolves against `@langchain/core ^1.1.46` during `npm install` — npm will error if not |

---

## Sources

- OpenRouter API docs (https://openrouter.ai/docs) — baseURL, auth, headers, model IDs. Confidence: HIGH (official).
- LangChain JS `@langchain/openai` README / docs (https://js.langchain.com/docs/integrations/chat/openai) — `ChatOpenAI` constructor options including `configuration`. Confidence: HIGH (official).
- Training data corroboration: `@langchain/openai` `configuration.baseURL` pattern is the de-facto standard community approach for any OpenAI-compatible endpoint (Together AI, Fireworks, Groq, OpenRouter all use this same pattern). Confidence: HIGH.
- Known gap: Did not verify current latest `@langchain/openai` version number against `@langchain/core ^1.1.46` peer dep range — check during `npm install` and pin if needed.
