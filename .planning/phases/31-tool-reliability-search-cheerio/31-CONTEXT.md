# Phase 31: Tool Reliability — Web Search + Cheerio Fetch - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the two existing web tools return real, usable data:
- **`web_search`** — replace the DuckDuckGo Instant Answer API (sparse, mostly empty results) with **Tavily**, a real free-tier search provider.
- **`fetch_page`** — replace the regex `htmlToText` strip with **Cheerio**-based main-content extraction (title, headings, body).
- Both degrade gracefully with clear, model-readable error strings when the provider is unavailable or rate-limited.

**In scope:** search-provider swap (Tavily), Cheerio parsing, `TAVILY_API_KEY` env var + `.env.example` entry, tool-description refresh, unit tests.
**Out of scope:** new tools, MCP, changes to tool gating / dino registry, caching layer, a second/fallback search provider.

</domain>

<decisions>
## Implementation Decisions

### Search Provider
- **D-01:** Use **Tavily** as the `web_search` provider (replaces DuckDuckGo IA). Chosen over Brave (raw web, not LLM-tuned) and SearXNG (self-hosting/ops burden on the VM).
- **D-02:** Use Tavily **`basic`** search depth (1 credit/query) — not `advanced`. Doubles effective free quota (~1k queries/mo); the model can call `fetch_page` when it needs full content.
- **D-03:** `TAVILY_API_KEY` read via `process.env['TAVILY_API_KEY']`, documented in `.env.example`, prod value in **GCP Secret Manager** — mirrors the existing `OPENROUTER_API_KEY` handling exactly.

### Search Result Shape
- **D-04:** `web_search` returns the **top 5** results, each with **title + content snippet + source URL**. URLs are required so the model can cite sources and chain into `fetch_page`.
- **D-05:** Cap each result's snippet (~200 chars) but let all 5 results through (~1–1.5KB total). No tight global cap. (Replaces today's 600-char total cap.)

### Cheerio Extraction (fetch_page)
- **D-06:** Cheerio **semantic heuristic**: load HTML, drop `script`/`style`/`nav`/`footer`/`aside` (and similar chrome), prefer `<article>` / `<main>` / `[role=main]`, else fall back to the largest text block. One light dep (`cheerio`) — no `@mozilla/readability` / `jsdom`.
- **D-07:** Output = **title + headings + body text in document order** (headings interleaved with paragraphs) so the model can navigate structure. Keep the existing ~5KB (`MAX_TEXT_LEN`) cap.

### Degradation / Fallback
- **D-08:** `web_search` returns **distinct, model-readable error strings** per failure case — provider down, rate-limited (HTTP 429), and key missing/unconfigured — with **no secondary provider**. (No DDG fallback, no Brave fallback.)
- **D-09:** `fetch_page` keeps clear error strings for timeout / non-200 HTTP / disallowed protocol. **Soft-fallback:** if the Cheerio heuristic extracts nothing usable, fall back to cleaned whole-body text rather than returning empty.

### fetch_page Hardening
- **D-10:** Guard against oversized responses — check `Content-Length` and/or cap the read at ~2–3MB; abort larger pages with a clear error **before** parsing with Cheerio. (Keeps the existing 10s `AbortSignal.timeout` + http/https-only guard.)
- **D-11:** Non-HTML content: pass `text/*` and JSON through as cleaned raw text (capped); refuse binary (PDF/image/etc.) with a clear "unsupported content type" error rather than dumping bytes.

### Tavily Query Tuning
- **D-12:** Keep the Tavily call **simple** — single `topic='general'`, no `time_range`, no extra schema args. Do **not** add a model-controlled recency/news flag. Tavily already ranks fresh results well; avoids mis-tuning generic queries.

### Testing
- **D-13:** **Unit tests with mocked `fetch` / Tavily responses**, covering happy paths + error paths: the 3 `web_search` degradation cases (down / 429 / unconfigured), Cheerio extraction against a small HTML fixture, and the empty-content soft-fallback for `fetch_page`. Use the repo's existing Vitest setup.

### Tool Descriptions / Schema
- **D-14:** Refresh `web_search`'s LangChain **description** to note it returns source URLs the model can pass to `fetch_page` for deeper reading (improves tool chaining). **Keep input schemas unchanged** (`query` / `url`) — no breaking change.

### Claude's Discretion
- Exact snippet/heading formatting, error-string wording, the precise byte cap within the ~2–3MB range, and the largest-text-block heuristic details are left to the planner/implementer, provided the decisions above hold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` § "Phase 31: Tool Reliability — Web Search + Cheerio Fetch" — goal, requirements (TOOL-01, TOOL-02), and the 3 success criteria.

### Code to modify
- `apps/backend/src/app/agents/tools/web-search.tool.ts` — current DuckDuckGo IA implementation being replaced.
- `apps/backend/src/app/agents/tools/fetch-page.tool.ts` — current regex `htmlToText` implementation being replaced.
- `apps/backend/src/app/agents/tools/index.ts` — tool registry (`tools` array); no new tools added, exports unchanged.

### Conventions
- `apps/backend/CLAUDE.md` — backend rules: env vars via `process.env['VAR']`, document every new env var in `.env.example`, NestJS `Logger` (no `console.log`), no `any`.
- `.env.example` — current env doc; add `TAVILY_API_KEY` following the `OPENROUTER_API_KEY` pattern (local dev value; prod in Secret Manager).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- LangChain `tool()` + `zod` schema pattern (both web tools already use it) — keep the same shape; only swap internals + refresh description.
- `web_search` already has a snippet-flattening + char-cap structure to adapt for the new top-5/per-snippet shape.
- `fetch_page` already guards protocol (http/https) and uses `AbortSignal.timeout(10_000)` + a `MAX_TEXT_LEN` cap — extend, don't replace, these guards.

### Established Patterns
- Env/secret handling: `process.env['OPENROUTER_API_KEY']` with `.env.example` doc + GCP Secret Manager in prod — `TAVILY_API_KEY` follows it.
- Tools return **plain strings** (including error strings) to the agent loop — degradation must be a returned string, never a thrown error to the client.
- Vitest is the test runner; backend has existing `*.spec.ts` (e.g. `agents.service.spec.ts`).

### Integration Points
- `tools/index.ts` `tools` array feeds the manual agent loop / dino tool gating (Phase 18). No registry change needed — same tool names (`web_search`, `fetch_page`).
- `cheerio` is **not** yet a dependency — must be added to the backend.

</code_context>

<specifics>
## Specific Ideas

- Success criterion #1 explicitly names Tavily / Brave / SearXNG as acceptable; **Tavily** is the locked choice and must be documented in-phase.
- Criterion #2 wording "title, headings, body" maps directly to D-07's output structure.
- "Current-events query" is the canonical web_search test case (criterion #1) — keep one such query in the test/verification narrative even though tuning stays general (D-12).

</specifics>

<deferred>
## Deferred Ideas

- **Result caching** (search/fetch result cache to save Tavily credits) — not in scope; revisit if quota becomes a constraint. Note: Phase 32 (Working Memory + Context Ring) persists fetched tool results in thread context, which partially covers reuse.
- **Secondary/fallback search provider** (Brave as backup) — deliberately rejected for this phase (D-08); could be a future hardening item.
- **Model-controlled recency/news flag** on web_search — deferred (D-12); add later only if generic results prove stale.

</deferred>

---

*Phase: 31-tool-reliability-search-cheerio*
*Context gathered: 2026-06-05*
