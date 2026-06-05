---
phase: 31-tool-reliability-search-cheerio
verified: 2026-06-05T13:54:30Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live web_search smoke test against Tavily"
    expected: "A current-events query yields 5 real results with titles, ~200-char snippets, and clickable source URLs. Blanking TAVILY_API_KEY causes the assistant to surface 'TAVILY_API_KEY is not configured.' rather than crashing."
    why_human: "Requires a real Tavily API key, running backend, and a live dino chat session — cannot be verified with grep or unit tests."
  - test: "Live fetch_page smoke test with Cheerio extraction"
    expected: "Asking a dino to read/summarise a real article URL returns clean title + headings + body text with no nav/cookie-banner noise. Pointing it at a PDF or image URL returns 'Unsupported content type' rather than binary garbage."
    why_human: "Requires a running backend and outbound HTTP to a real article and a binary URL — cannot be verified programmatically."
---

# Phase 31: Tool Reliability — Web Search + Cheerio Fetch Verification Report

**Phase Goal:** The web tools return real, usable data instead of sparse or regex-mangled output.
**Verified:** 2026-06-05T13:54:30Z
**Status:** human_needed (all automated checks PASS; two live smoke tests pending human execution)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `web_search` returns relevant real results for a current-events query — DuckDuckGo IA replaced with Tavily | VERIFIED (automated) | `web-search.tool.ts` POSTs to `https://api.tavily.com/search` with `search_depth:'basic'`, `max_results:5`; no DDG code anywhere in the tools directory |
| 2 | `fetch_page` uses Cheerio to extract clean main-content text (title, headings, body), replacing the regex `htmlToText` strip | VERIFIED (automated) | `fetch-page.tool.ts` imports `{ load } from 'cheerio'`; no `htmlToText` function exists; `extractMainContent` strips chrome and walks `h1-h6/p/li` in document order |
| 3 | Both tools degrade gracefully (clear error string) when the provider is unavailable or rate-limited | VERIFIED (automated) | 3 distinct web_search error strings confirmed in code and covered by unit tests; fetch_page has oversize/binary/HTTP-error/protocol-error paths; all return strings, never throw |

**Score: 5/5 automated must-haves verified** (3 roadmap truths + 2 PLAN-level truths below)

### Full Must-Have Truth Table (from PLAN frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | web_search calls Tavily POST with `search_depth='basic'`, `topic='general'`, `max_results=5`; DDG code gone | VERIFIED | Lines 24-37 of web-search.tool.ts; Grep confirms zero DDG/RelatedTopics/flattenTopics references in tools dir |
| 2 | Successful search returns top 5 results with title + ~200-char snippet + source URL | VERIFIED | Lines 54-62 of web-search.tool.ts; `SNIPPET_LEN=200`, `slice(0, 199) + '…'`; unit test happy path asserts 5 results + truncation |
| 3 | Three distinct degradation strings for unconfigured / 429 / provider-down; no secondary fallback | VERIFIED | Lines 19-21, 39-41, 43-45, 63-65 of web-search.tool.ts; web-search.tool.spec.ts tests all 3 paths + HTTP 500 variant |
| 4 | `TAVILY_API_KEY` read via `process.env['TAVILY_API_KEY']`; documented in `.env.example` | VERIFIED | Line 18 of web-search.tool.ts; `.env.example` line 4 with Secret Manager comment |
| 5 | fetch_page parses HTML with Cheerio; drops chrome; prefers article/main/[role=main]; soft-fallback; `htmlToText` regex gone | VERIFIED | Lines 14-63 of fetch-page.tool.ts; chrome selectors on line 18; heuristic root-selection lines 24-37; soft-fallback lines 125-137 |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/app/agents/tools/web-search.tool.ts` | Tavily-backed web_search, top-5, 3 degradation strings | VERIFIED | 80 lines; Tavily POST; TavilyResult/TavilyResponse interfaces; no `any`; name/schema unchanged |
| `apps/backend/src/app/agents/tools/web-search.tool.spec.ts` | 6 Vitest tests: happy + unconfigured + 429 + down + HTTP 500 + empty | VERIFIED | 104 lines; 6 tests; all pass (`6 passed` confirmed by live vitest run) |
| `apps/backend/src/app/agents/tools/fetch-page.tool.ts` | Cheerio extraction, MAX_BYTES guard, content-type gating, soft-fallback | VERIFIED | 161 lines; imports `{ load } from 'cheerio'`; MAX_BYTES=2_500_000; binary gate before `res.text()`; soft-fallback to `$('body').text()` |
| `apps/backend/src/app/agents/tools/fetch-page.tool.spec.ts` | 9 Vitest tests: HTML fixture, soft-fallback, JSON, text/plain, PDF, image/png, oversize, 404, file:// | VERIFIED | 202 lines; 9 tests; all pass (`9 passed` confirmed by live vitest run) |
| `.env.example` | `TAVILY_API_KEY=` entry with Secret Manager comment | VERIFIED | Line 4; follows OPENROUTER_API_KEY pattern with "Production value is stored in Secret Manager" comment |
| `package.json` | `cheerio` in dependencies | VERIFIED | `"cheerio": "^1.2.0"` in dependencies section |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `webSearchTool` | Tavily `/search` endpoint | `fetch POST` with `Authorization: Bearer ${apiKey}` | WIRED | Lines 24-37 web-search.tool.ts; key from `process.env['TAVILY_API_KEY']`; missing key returns before fetch |
| `webSearchTool` | `results[]` array | `(await res.json()) as unknown as TavilyResponse` | WIRED | Line 47-48; result mapped to formatted string; returned to agent loop |
| `fetchPageTool` | `cheerio.load()` | `import { load } from 'cheerio'` | WIRED | Line 2 import; called in `extractMainContent` line 15; also called in soft-fallback line 126 |
| `fetchPageTool` | binary gate | content-type check before `res.text()` | WIRED | Lines 86-93; returns `Unsupported content type` string without calling `res.text()` — verified in spec via `expect(textFn).not.toHaveBeenCalled()` |
| `fetchPageTool` | oversize guard | Content-Length header + actual read length | WIRED | Lines 96-109; both checks present; error returned before Cheerio parse |

---

## Data-Flow Trace (Level 4)

Both tools are utilities (not UI components) — they transform an input string to an output string. Level 4 data-flow applies to rendered components, not tool functions. The input (`query`/`url`) is provided by the agent loop and LangChain's `tool()` wrapper; the output string is consumed by the agent loop. No hollow-prop or disconnected-state risk applies here.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| web-search.tool tests pass | `node apps/backend/vitest.run.mjs web-search.tool` | `6 passed (6)` | PASS |
| fetch-page.tool tests pass | `node apps/backend/vitest.run.mjs fetch-page.tool` | `9 passed (9)` | PASS |
| No DDG code in tools dir | Grep for `duckduckgo\|RelatedTopics\|AbstractText\|flattenTopics\|htmlToText` | No matches | PASS |
| cheerio in package.json | Grep `cheerio` in package.json | `"cheerio": "^1.2.0"` | PASS |
| TAVILY_API_KEY in .env.example | Grep `.env.example` | Line 4 present | PASS |

---

## Probe Execution

No conventional probe scripts exist for this phase. Spot-checks above substitute.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TOOL-01 | 31-01-PLAN.md | `web_search` → Tavily (top-5 title+snippet+URL, 3 degradation strings) | SATISFIED | web-search.tool.ts rewritten; 6 unit tests green; DDG code absent |
| TOOL-02 | 31-02-PLAN.md | `fetch_page` → Cheerio extraction (title/headings/body, byte cap, content-type gating) | SATISFIED | fetch-page.tool.ts rewritten with cheerio; 9 unit tests green; htmlToText absent |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TBD/FIXME/XXX/TODO/HACK markers in either tool file. No `any` types. No placeholder return values. No empty handlers.

---

## Human Verification Required

Two manual live smoke tests are pending (Task 4 in each plan). These are the only remaining gate items.

### 1. Live web_search smoke test against Tavily

**Test:** Obtain a free Tavily API key at tavily.com. Add `TAVILY_API_KEY=<key>` to the local backend `.env`. Start the backend (`npx nx serve @org/backend`). Open a chat with a dino that has `web_search` enabled. Ask a current-events question (e.g. "What happened in the news today?"). Observe the tool result.

**Expected:** The tool returns 5 real results, each with a title, a content snippet (~200 chars), and a source URL. The URLs are distinct and clickable. Then blank the API key and ask the same question — the assistant should surface "Search unavailable: TAVILY_API_KEY is not configured." without crashing.

**Why human:** Requires a real Tavily API key and a live network call to `api.tavily.com`. Unit tests mock the HTTP layer; they cannot verify that Tavily's actual API contract matches the implementation.

### 2. Live fetch_page smoke test with Cheerio extraction

**Test:** With the backend running, ask a dino with `fetch_page` (e.g. Veloce) to read and summarise a real article URL (e.g. a Wikipedia article or a news page). Observe the tool result. Then provide a PDF or image URL (e.g. a `.pdf` or `.png` URL) and observe the tool result.

**Expected:** The article yields clean text with the page title, headings, and body paragraphs — no nav menus, cookie banners, footer text, or script content. The PDF/image URL returns "Unsupported content type: application/pdf" (or the relevant type) rather than binary garbage.

**Why human:** Requires a live HTTP fetch of real URLs. Content-type handling and Cheerio extraction are unit-tested against fixtures, but real-world pages may have unusual structures; only a live test confirms the heuristic works on real content.

---

## Gaps Summary

No gaps. All automated must-haves are VERIFIED. The phase goal — web tools returning real, usable data — is fully implemented and unit-tested. The two pending items are live-environment smoke tests that cannot be automated.

---

_Verified: 2026-06-05T13:54:30Z_
_Verifier: Claude (gsd-verifier)_
