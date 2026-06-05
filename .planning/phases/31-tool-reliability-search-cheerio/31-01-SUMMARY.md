---
phase: 31-tool-reliability-search-cheerio
plan: "01"
subsystem: backend/tools
tags: [tools, web-search, tavily, testing]
dependency_graph:
  requires: []
  provides: [Tavily-backed web_search with top-5 results, degradation strings, unit tests]
  affects: [agents/tools/web-search.tool.ts, .env.example]
tech_stack:
  added: []
  patterns: [fetch POST to Tavily /search, vi.stubEnv + vi.stubGlobal for unit tests]
key_files:
  created:
    - apps/backend/src/app/agents/tools/web-search.tool.spec.ts
  modified:
    - apps/backend/src/app/agents/tools/web-search.tool.ts
    - .env.example
decisions:
  - "Tavily auth via Authorization: Bearer header (not api_key in body) — cleaner separation of credentials from payload"
  - "Per-snippet cap of 200 chars (not global cap) so each result is individually readable"
  - "Empty string for TAVILY_API_KEY treated as unconfigured (falsy check) — prevents accidental fetch with blank key"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-05"
  tasks_completed: 3
  tasks_total: 4
  files_modified: 3
---

# Phase 31 Plan 01: Tavily web_search Replacement Summary

Replaced the DuckDuckGo Instant Answer `web_search` with a Tavily-backed implementation returning real top-5 results (title + 200-char snippet + source URL) and three distinct degradation strings for unconfigured/rate-limited/provider-down cases.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Document TAVILY_API_KEY in .env.example | 6eb9496 | .env.example |
| 2 | Rewrite web_search to use Tavily | 2864f0a | web-search.tool.ts |
| 3 | Unit tests for web_search (happy + 3 degradation) | 1f44be1 | web-search.tool.spec.ts |

## Task 4: Pending (Manual / HUMAN-UAT)

**Task 4 — Live smoke test against Tavily** was NOT executed — it is a `type="manual"` task requiring a real Tavily API key and a running backend. Steps to complete:

1. Obtain a free Tavily API key at tavily.com
2. Add `TAVILY_API_KEY=<your-key>` to the local backend `.env`
3. Run the backend (`npx nx serve @org/backend`)
4. Ask a dino with `web_search` a current-events question (e.g., "what happened in the news today?")
5. Confirm 5 real results with titles, snippets, and clickable source URLs
6. Blank the key and confirm the "TAVILY_API_KEY is not configured" message appears

## Implementation Details

### web-search.tool.ts Changes

- Removed: `DdgRelatedTopic`, `DdgResponse` interfaces, `flattenTopics` function, `MAX_LEN` global, DuckDuckGo URL construction
- Added: `TavilyResult`, `TavilyResponse` interfaces; POST to `https://api.tavily.com/search` with `Authorization: Bearer` header
- Degradation strings:
  - Unconfigured: `Search unavailable: TAVILY_API_KEY is not configured.`
  - Rate-limited (429): `Search rate-limited: the search provider is over quota, try again later.`
  - Generic failure: `Search failed: HTTP <status> from search provider.` or `Search failed: <error message>`
  - Empty results: `No results found for: <query>`
- Description updated to mention returned source URLs usable with `fetch_page`
- `name: 'web_search'` and `schema: z.object({ query: z.string().min(1).max(200) })` unchanged

### Test Coverage

6 tests across 5 cases:
- Happy path: 5 results formatted with title/snippet/URL; long content (300 chars) truncated to ~200 chars with ellipsis
- Unconfigured: unconfigured string returned, `fetch` was NOT called
- Rate-limited: 429 response returns distinct rate-limit string
- Provider down (network error): generic failure string with error message
- Provider down (HTTP 500): generic failure string with status code
- Empty results: no-results string with query echoed back

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx nx lint @org/backend --quiet` — PASSED (0 errors, 0 warnings in modified files)
- `npx nx build @org/backend --skip-nx-cache` — PASSED (webpack compiled successfully)
- `node apps/backend/vitest.run.mjs web-search.tool` — PASSED (6/6 tests)

## Threat Model Compliance

| Threat | Mitigation Applied |
|--------|--------------------|
| T-31-01-01 (TAVILY_API_KEY disclosure) | Key only read via `process.env['TAVILY_API_KEY']`; error strings carry status/message only, never the key itself |
| T-31-01-02 (LLM-generated query injection) | `zod` enforces 1..200 chars; query sent as JSON body field (no URL interpolation) |
| T-31-01-03 (DoS via Tavily fetch) | Accepted per plan; 429 and network failures return strings, never throw |

## Self-Check: PASSED

- `apps/backend/src/app/agents/tools/web-search.tool.ts` — exists, contains `TAVILY_API_KEY` and `tavily.com/search`
- `apps/backend/src/app/agents/tools/web-search.tool.spec.ts` — exists, 6 tests all green
- `.env.example` — contains `TAVILY_API_KEY=your-tavily-key-here`
- Commits 6eb9496, 2864f0a, 1f44be1 — all present in git log
