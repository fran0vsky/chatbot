# Phase 31: Tool Reliability — Web Search + Cheerio Fetch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 31-tool-reliability-search-cheerio
**Areas discussed:** Search provider, Search result shape, Cheerio extraction, Degradation/fallback, fetch_page hardening, Tavily query tuning, Testing approach, Tool descriptions/schema

---

## Search Provider

| Option | Description | Selected |
|--------|-------------|----------|
| Tavily | Built for LLM agents; ~1k free credits/mo; ranked clean results + snippets | ✓ |
| Brave Search API | Real independent web index; ~2k free queries/mo; raw web results, format yourself | |
| SearXNG (self-hosted) | No key/quota but requires running + maintaining a service on the VM | |

**User's choice:** Tavily
**Notes:** Simplest integration + best result quality for agent use; avoids extra ops burden during the VM/nginx/certbot hardening milestone.

### Tavily depth
| Option | Description | Selected |
|--------|-------------|----------|
| Basic | 1 credit/query; ~1k queries/mo effective | ✓ |
| Advanced | 2 credits/query; richer snippets; ~500/mo | |

**User's choice:** Basic — fetch_page covers deep reads.

### Key handling
| Option | Description | Selected |
|--------|-------------|----------|
| Match OpenRouter pattern | process.env + .env.example + Secret Manager | ✓ |
| .env only for now | Document in .env.example, defer Secret Manager | |

**User's choice:** Match OpenRouter pattern.

---

## Search Result Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Top 5: title + snippet + URL | URLs let model cite + chain into fetch_page | ✓ |
| Top 3: title + snippet + URL | Fewer results, lower tokens | |
| Tavily answer + sources | Compact but bakes in Tavily summarization | |

**User's choice:** Top 5 with title + snippet + URL.

### Output cap
| Option | Description | Selected |
|--------|-------------|----------|
| Per-snippet cap, generous total | ~200 char/snippet, all 5 through (~1–1.5KB) | ✓ |
| Tight total cap | ~800 chars total | |
| No cap | Whatever Tavily sends | |

**User's choice:** Per-snippet cap, generous total.

---

## Cheerio Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Cheerio semantic heuristic | Drop chrome, prefer article/main, else largest text block; title + headings + p | ✓ |
| Readability + jsdom | Best-in-class but adds heavy jsdom dep | |
| Cheerio, body text only | Loses title/heading structure | |

**User's choice:** Cheerio semantic heuristic.

### Output structure
| Option | Description | Selected |
|--------|-------------|----------|
| Title + headings + body in order | Structure for model to navigate | ✓ |
| Title + flat body text | Simpler, loses structure | |

**User's choice:** Title + headings + body text.

---

## Degradation / Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Clear error string, no fallback (search) | Distinct messages: down / 429 / unconfigured | ✓ |
| Fall back to DuckDuckGo IA | Keeps the sparse code path alive | |
| Fall back to secondary API (Brave) | Robust but doubles integration + key | |

**User's choice (web_search):** Clear error strings, no fallback.

| Option | Description | Selected |
|--------|-------------|----------|
| Clear error; soft-fallback on empty (fetch) | Empty extraction → cleaned whole-body text | ✓ |
| Clear error string only | Empty → "could not extract" message | |

**User's choice (fetch_page):** Clear errors + soft-fallback to whole-body text.

---

## fetch_page Hardening

| Option | Description | Selected |
|--------|-------------|----------|
| Cap by bytes before parsing | Content-Length / ~2–3MB read cap, abort larger | ✓ |
| Rely on timeout only | 10s timeout only | |

**User's choice:** Cap by bytes before parsing.

| Option | Description | Selected |
|--------|-------------|----------|
| Pass text/* & JSON raw, refuse binary | Cleaned text for text/json; error for binary | ✓ |
| HTML only | Everything non-HTML rejected | |

**User's choice:** Pass text/* & JSON raw, refuse binary.

---

## Tavily Query Tuning

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it general/simple | topic='general', no time_range, no extra args | ✓ |
| Expose a recency hint | Optional model-set 'recent' flag → news/time_range | |

**User's choice:** Keep it general/simple.

---

## Testing Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests, mocked fetch, happy + error paths | 3 degradation cases + Cheerio fixture + soft-fallback | ✓ |
| Happy-path only | One success test per tool | |

**User's choice:** Unit tests with mocked fetch, happy + error paths.

---

## Tool Descriptions / Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Update descriptions, keep schemas | web_search notes it returns URLs for fetch_page | ✓ |
| Leave descriptions as-is | No hint that tools compose | |

**User's choice:** Update descriptions, keep schemas.

---

## Claude's Discretion

- Exact snippet/heading formatting and error-string wording.
- Precise byte cap within the ~2–3MB range.
- Largest-text-block heuristic implementation details.

## Deferred Ideas

- Result caching for Tavily credits (note: Phase 32 partially covers reuse via persisted tool results).
- Secondary/fallback search provider (Brave as backup) — rejected for this phase.
- Model-controlled recency/news flag on web_search — deferred.
