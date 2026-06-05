# Phase 32: Working Memory + Context Ring - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Within an active chat thread, make earlier **attached images** and **fetched tool results** reusable on later turns (instead of dropped or re-downloaded), and add a **context-usage ring** in the composer that shows approximate context-window fill with a near-limit warning.

**Key architectural fact (verified during scout):** Chat sessions persist to **localStorage** (`ConversationSession[]` via `history.service.ts`), **not** the DB — the `sessions`/`messages` Drizzle tables exist but are unused for chat history. Each `ChatMessage` already stores `imageDataUrl` and `toolName`/`toolArgs`/`toolResult` in localStorage. The agent loop is fully stateless and receives a **text-only** `history` from the client each turn. So the working-memory substrate already exists client-side; this phase **feeds stored images + tool results back into model context** and adds the ring. **No DB/schema change for MVP.**

**In scope:** retain + replay earlier images (capped) and tool results into the per-turn context; context-ring UI in the composer with token estimation + near-limit warning.
**Out of scope:** vector/semantic retrieval (that's Phase 21 cross-thread memory); DB persistence of working memory; auto-trimming/summarizing context; intent-based "include image only when referenced" retrieval.

</domain>

<decisions>
## Implementation Decisions

### Image Reuse
- **D-01:** Retain the **last N attached images** (cap; suggest N≈2–3, tunable) in the thread's working context — older images drop off. Chosen over "all thread images" (unbounded vision-token cost / window blowout) and "only most recent" (loses a still-relevant earlier image once a newer one is attached).
- **D-02:** Retained images are sent to the model **every turn** (deterministic, no retrieval/intent logic). Pairs with the D-01 cap to bound cost. Rejected "only when referenced" — needs heuristics, MVP-inappropriate, closer to Phase 21.
- **D-03:** Requires threading `imageDataUrl` through `buildHistory()` ([chat.ts:827](apps/frontend/src/app/chat/chat.ts#L827)) — currently maps to `{role, text}` only — and reconstructing **multimodal `HumanMessage`** entries for prior image turns in the backend `historyMessages` mapper ([agents.service.ts:183](apps/backend/src/app/agents/agents.service.ts#L183)).

### Tool-Result Reuse
- **D-04:** Reconstruct prior tool calls as LangChain **`ToolMessage`** entries in the conversation (faithful replay of what the model already "has"), rather than folding results into history text. Discourages needless re-calling and preserves tool-call structure. Note: a faithful `ToolMessage` replay needs its preceding `AIMessage` carrying the matching `tool_call` id — the client stores `toolName`/`toolArgs`/`toolResult` per message; reconstructing the AIMessage+ToolMessage pair is the implementer's task.
- **D-05:** **Always reuse** stored tool results, but **keep the tool available so the model may re-fetch** when it judges freshness matters (the model already decides tool calls — no extra logic). Rejected "always reuse, never re-fetch" (stale on time-sensitive queries) and "recent-only reuse" (re-downloads unnecessarily).
- **D-06:** Reused tool text is already bounded by Phase 31 (`fetch_page` ~5KB cap, search top-5 capped). Global growth is governed by the context ring (warn-only) + the existing 20-turn `HISTORY_CAP`, not a separate tool-result cap.

### Context Ring — Limit & Behavior
- **D-07:** The ring measures an **approximate token estimate of the assembled context** (system prompt + replayed history + retained images + reused tool results + current draft) against the **active dino model's real context window**. Maintain a small per-model window map (extend [model-capabilities.ts](apps/backend/src/app/agents/model-capabilities.ts)); the dino registry is a fixed, known set, so this is bounded. **Fallback to a conservative fixed budget (~8k tokens)** for any model whose window isn't known. *(User delegated this denominator decision to Claude.)*
- **D-08:** Token estimate is **approximate and documented** (e.g. char/4 heuristic; image tokens approximated by a flat per-image cost). Exactness is explicitly not required (per ROADMAP scope note).
- **D-09:** **Single warning state at ~80%** of the budget (color shift + tooltip). Rejected two-stage (80/95%) for MVP simplicity.
- **D-10:** **Warn-only** at/over the limit — nothing is auto-removed. The 20-turn `HISTORY_CAP` already makes true overflow rare, and silently dropping the user's images/data would be a confusing UX. Rejected auto-trim for MVP.

### Context Ring — Placement & Visual
- **D-11:** Ring lives **in the composer** (near the input/send button) — where attention is when typing and naturally adjacent to the "cost" of the next turn. Rejected chat-header and floating-corner placements.
- **D-12:** Visual = a **donut fill showing %**, **shifting to a warning color past 80%**, with a **tooltip showing approximate token usage** on hover. Matches the "ring" wording and is self-explanatory.

### Claude's Discretion
- Exact value of N for the image cap (D-01; suggest 2–3).
- Precise token-estimation heuristic and per-image token approximation (D-08).
- Exact per-model window numbers and the fixed-fallback value within the ~8k ballpark (D-07).
- Tooltip copy, donut animation, exact warning color/label, and the AIMessage+ToolMessage reconstruction approach (D-04) — within the locked directions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` § "Phase 32: Conversation Working Memory + Context Ring" — goal, requirements (CTX-01/02/03), 4 success criteria, and the in/out scope note.

### Prior phase context (dependencies)
- `.planning/phases/31-tool-reliability-search-cheerio/31-CONTEXT.md` — `fetch_page`/`web_search` output shapes + ~5KB cap that bound reused tool text (D-06); also flags Phase 32 as partially covering the deferred result-caching idea.

### Code to modify
- `apps/frontend/src/app/chat/chat.ts` § `buildHistory()` (lines ~827–836) — text-only history mapper; must carry `imageDataUrl` + tool-call data (D-03).
- `apps/backend/src/app/agents/agents.service.ts` § `streamAgent` `historyMessages` (lines ~183–204) — text-only `HumanMessage`/`AIMessage` reconstruction; must build multimodal HumanMessages + replay ToolMessages (D-03, D-04).
- `apps/backend/src/app/agents/model-capabilities.ts` — extend with per-model context-window sizes for the ring denominator (D-07).
- `libs/shared-types/src/lib/chat.types.ts` — `ChatHistoryItem` is `{role, text}` only; likely needs to carry image + tool-call fields (or a richer history shape) for replay.
- `apps/frontend/src/app/chat/history.service.ts` — localStorage session store (the working-memory substrate; confirms no DB change needed).

### Conventions
- `apps/backend/CLAUDE.md` — NestJS rules (no `any`, `Logger` not `console`, env via `process.env['VAR']`).
- `apps/frontend/CLAUDE.md` — standalone OnPush components, Tailwind-only, types from `@org/shared-types`, no logic in components.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatMessage` (localStorage) already stores `imageDataUrl`, `toolName`, `toolArgs`, `toolResult` per message — the data for replay already exists; the gap is purely in what `buildHistory()` forwards and what the backend reconstructs.
- The backend already builds a **multimodal `HumanMessage`** for the *current* turn's `imageDataUrl` ([agents.service.ts:191](apps/backend/src/app/agents/agents.service.ts#L191)) — the same shape can be reused for retained prior images.
- The backend already constructs `ToolMessage`s during the live tool loop ([agents.service.ts:280](apps/backend/src/app/agents/agents.service.ts#L280)) — replay reuses the same shape.

### Established Patterns
- Agent loop is **stateless per request**; all multi-turn context arrives via the client `history` array (capped at 20 turns, `HISTORY_CAP` in chat.ts). Working memory must flow through this channel, not server state.
- Sessions persist to **localStorage only** — DB tables (`sessions`/`messages`) are unused for chat. No migration needed.
- One image per turn (Phase 25/26); non-vision dinos fall back to a vision-capable model server-side — retained images inherit this fallback behavior.

### Integration Points
- `ChatRequest` / `ChatHistoryItem` ([chat.types.ts](libs/shared-types/src/lib/chat.types.ts)) is the contract between `buildHistory()` and `streamAgent` — extending it touches both apps + shared-types.
- The ring needs the same token estimate the backend would assemble; decide whether estimation runs client-side (from localStorage messages) or is surfaced from the backend. Client-side estimate keeps it live as the user types the draft.

</code_context>

<specifics>
## Specific Ideas

- Success criterion #1 ("image attached earlier stays referenceable without re-attaching") maps to D-01/D-02/D-03.
- Success criterion #2 ("fetched page reused instead of re-downloaded") maps to D-04/D-05.
- Success criterion #3 ("context-usage ring … warning as it nears the limit") maps to D-07 through D-12.
- Success criterion #4 ("no regression to single-turn chat") — retained-context logic must be additive; a fresh single-turn message with no prior images/tools must behave exactly as today.

</specifics>

<deferred>
## Deferred Ideas

- **Per-model real window for ALL models with exhaustive tabulation** — MVP uses a bounded per-model map + ~8k fallback (D-07); fully comprehensive coverage can come later.
- **Auto-trim / summarize context near the limit** — explicitly deferred (D-10 is warn-only); revisit if real overflow becomes common.
- **Intent-based image inclusion ("only when referenced")** — deferred (D-02 sends every turn); closer to Phase 21 retrieval.
- **Two-stage ring warning (80/95%)** — deferred (D-09 single warn).
- **DB persistence of working memory across devices** — out of scope; localStorage is the substrate for MVP.
- Mascot todo (`2026-05-29-replace-placeholder-dino-mascots`) surfaced as a low-confidence (0.3) match — **not folded**; belongs to Phase 20, unrelated to working memory.

</deferred>

---

*Phase: 32-working-memory-context-ring*
*Context gathered: 2026-06-05*
