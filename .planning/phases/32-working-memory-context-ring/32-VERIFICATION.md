---
phase: 32-working-memory-context-ring
verified: 2026-06-08T10:05:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 2 human UAT items pending
overrides_applied: 0
human_verification:
  - test: "Image reuse across turns (CTX-01)"
    expected: "An image attached on turn N is still referenceable on turn N+2 without re-attaching. After attaching 2 more images, the oldest image is no longer in context (N=2 cap confirmed)."
    why_human: "Requires a running app and live LLM responses; multimodal replay cannot be confirmed through static code analysis alone."
  - test: "Tool-result reuse without re-download (CTX-02)"
    expected: "After fetch_page retrieves a URL, a follow-up question is answered from the cached result without a second tool_call_start event for the same URL. The model is still free to re-fetch on freshness-sensitive queries."
    why_human: "Requires a running app, a web-capable dino, and live network observation of the streaming SSE events to confirm absence of a second fetch."
  - test: "Context-usage ring fills live, warns at ~80%, is warn-only (CTX-03)"
    expected: "Donut ring is visible near the send button on a fresh thread. Draft changes cause live % update. Past ~80% the arc turns amber and the tooltip shows approximate tokens + percent. Nothing is auto-removed from the conversation when the limit is exceeded."
    why_human: "Visual confirmation, real-time DOM updates, and absence-of-trim verification all require a running browser."
  - test: "Ring absent from groupchat and arena composers"
    expected: "The ring does not appear in the group-chat or arena input areas."
    why_human: "Requires visual inspection of those views in a running app."
---

# Phase 32: Working Memory + Context Ring — Verification Report

**Phase Goal:** Within an active chat thread, make earlier attached images and fetched tool results
reusable on later turns without re-attaching or re-downloading, and add a live context-usage ring
in the composer that shows approximate context-window fill with a near-limit warning.

**Verified:** 2026-06-08T10:05:00Z
**Status:** human_needed — all automated checks pass; 4 human UAT items (ring and live replay
behaviors) must be confirmed in a running app.
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ChatHistoryItem carries optional imageDataUrl + tool-call fields and role 'tool', so prior images and tool results survive the client→backend hop | VERIFIED | `libs/shared-types/src/lib/chat.types.ts` lines 10–23: role union is `'user' \| 'assistant' \| 'tool'`; `imageDataUrl?`, `toolName?`, `toolArgs?`, `toolResult?` all present and typed correctly |
| 2 | buildHistory() forwards prior user images (capped last 2) and tool messages with toolResult | VERIFIED | `apps/frontend/src/app/chat/chat.ts` lines 1192–1250: flatMap keeps `role:'tool'` when `toolName \|\| toolResult`; image-cap walk strips `imageDataUrl` beyond IMAGE_CAP=2; HISTORY_CAP=20 counts only user/assistant turns |
| 3 | Backend historyMessages reconstructs multimodal HumanMessage + AIMessage/ToolMessage pair faithfully | VERIFIED | `apps/backend/src/app/agents/agents.service.ts` lines 188–220: flatMap with four cases; `type:'image_url'` shape for prior images mirrors current-turn builder; AIMessage(tool_calls) + ToolMessage(tool_call_id) pair with synthetic id `replay-{toolName}-{index}` |
| 4 | Context-usage ring is a presentational OnPush @org/ui component with live estimate from shared-types helpers, warning colour at 80%, warn-only | VERIFIED | `libs/ui/src/lib/usage-ring/usage-ring.ts`: standalone OnPush, no injected services; `libs/ui/src/lib/usage-ring/usage-ring.html`: SVG donut with `stroke-dasharray` from `dashLength`, amber class when `isWarning`; `libs/shared-types/src/lib/model-context.ts`: `estimateTextTokens`, `IMAGE_TOKEN_COST=1000`, `getContextWindow` with `DEFAULT_CONTEXT_WINDOW=8000`; `contextUsage computed()` in chat.ts lines 184–218 wires all components |
| 5 | A fresh single-turn message with no prior images or tool results produces the same conversation array as before the change (no regression) | VERIFIED | Backend unit test at agents.service.spec.ts lines 213–257 passes (`node apps/backend/vitest.run.mjs agents.service` — 22/22 passed); plain user+assistant history yields zero ToolMessages and plain string content |

**Score:** 5/5 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `libs/shared-types/src/lib/chat.types.ts` | ChatHistoryItem with image + tool-call fields | VERIFIED | Role union widened; 4 optional fields added; text still required |
| `libs/shared-types/src/lib/model-context.ts` | MODEL_CONTEXT_WINDOWS, DEFAULT_CONTEXT_WINDOW, getContextWindow, estimateTextTokens, IMAGE_TOKEN_COST | VERIFIED | All 5 exports present; DEFAULT=8000; IMAGE_TOKEN_COST=1000; 8 model entries including fallback variants |
| `apps/frontend/src/app/chat/chat.ts` | buildHistory() + contextUsage computed + currentDraft signal | VERIFIED | buildHistory() at line 1192; contextUsage computed at line 184; SYSTEM_PROMPT_ALLOWANCE=800, IMAGE_CAP=2 |
| `apps/backend/src/app/agents/agents.service.ts` | flatMap historyMessages with multimodal + tool replay | VERIFIED | Lines 188–220; four cases; no `any` |
| `apps/backend/src/app/agents/agents.service.spec.ts` | 3 new tests: image replay, tool replay, single-turn parity | VERIFIED | Lines 116–257; all 3 cases present and passing |
| `libs/ui/src/lib/usage-ring/usage-ring.ts` | Standalone OnPush UsageRing, no services | VERIFIED | Standalone, OnPush, selector `app-usage-ring`, percent/tokens/warnThreshold inputs, no inject() |
| `libs/ui/src/lib/usage-ring/usage-ring.html` | SVG donut with stroke-dasharray, warning colour, aria-label/title | VERIFIED | Background + foreground circles; `[attr.stroke-dasharray]="dashLength + ' ' + circumference"`; amber classes when isWarning; role="img", aria-label, title |
| `libs/ui/src/lib/usage-ring/usage-ring.stories.ts` | 4 fill-state Storybook stories | VERIFIED | Low (15%), Mid (55%), Warning (85%), Full (100%) — all 4 present |
| `libs/ui/src/lib/input-composer/input-composer.ts` | contextPercent, contextTokens inputs + draftChange output + UsageRing import | VERIFIED | Lines 95–100; contextPercent nullable default null; draftChange EventEmitter; UsageRing in imports array |
| `libs/ui/src/lib/input-composer/input-composer.html` | app-usage-ring before send button, gated on contextPercent !== null | VERIFIED | Lines 205–212; @if (contextPercent !== null) block renders app-usage-ring before send/stop button |
| `apps/frontend/src/app/chat/chat.html` | Main chat composers bound; group/arena composers NOT bound | VERIFIED | Two main chat composers (lines ~495–512 and ~593–611) bind contextPercent/contextTokens/draftChange; groupComposer and arena textarea have no such bindings |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| buildHistory() (chat.ts) | streamAgent historyMessages (agents.service.ts) | ChatHistoryItem[] over ChatRequest.history | WIRED | chat.ts line 1273 passes `this.buildHistory()` as history arg; agents.service.ts line 188 consumes it via flatMap |
| contextUsage computed() (chat.ts) | app-input-composer [contextPercent]/[contextTokens] | Angular inputs | WIRED | chat.html lines 504–505 bind `[contextPercent]="contextUsage().percent"`, `[contextTokens]="contextUsage().tokens"` |
| (draftChange) output (input-composer) | currentDraft signal (chat.ts) | EventEmitter | WIRED | chat.html line 511 `(draftChange)="currentDraft.set($event)"`; input-composer.html line 202 emits on textarea (input) |
| estimateTextTokens / getContextWindow (model-context.ts) | contextUsage computed (chat.ts) | @org/shared-types import | WIRED | chat.ts uses both helpers; shared-types/index.ts re-exports model-context.js |
| UsageRing (@chatbot/ui) | InputComposer | Angular imports array | WIRED | input-composer.ts line 16 imports UsageRing; line 69 adds it to imports array; template renders `<app-usage-ring>` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `usage-ring.html` | `percent`, `tokens` | Passed via `@Input()` from InputComposer, which gets them from chat.ts `contextUsage()` computed | Yes — contextUsage sums real message text lengths, image count, tool results, draft, divided by real model window | FLOWING |
| `agents.service.ts` historyMessages | `history: ChatHistoryItem[]` | Passed from chat.ts `buildHistory()` which reads `this.messages()` from localStorage-backed signal | Yes — real message data from session; not stubbed | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 22 backend tests pass (image replay, tool replay, single-turn parity) | `node apps/backend/vitest.run.mjs agents.service` | 22/22 passed, 2 files, 1.07s | PASS |
| Barrel exports: model-context re-exported from @org/shared-types | Grep `model-context` in `libs/shared-types/src/index.ts` | `export * from './lib/model-context.js'` present | PASS |
| UsageRing exported from @chatbot/ui barrel | Grep `UsageRing` in `libs/ui/src/index.ts` | `export { UsageRing } from './lib/usage-ring/usage-ring.js'` present | PASS |
| contextPercent null by default (ring hidden from non-chat contexts) | Read input-composer.ts | `@Input() contextPercent: number \| null = null` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CTX-01 | 32-01 | Earlier attached image referenceable later without re-attaching | AUTOMATED VERIFIED / UAT PENDING | ChatHistoryItem carries imageDataUrl; buildHistory() forwards it (capped last 2); backend reconstructs multimodal HumanMessage; unit tests pass |
| CTX-02 | 32-01 | Fetched page reused on follow-up instead of re-downloaded | AUTOMATED VERIFIED / UAT PENDING | tool role in ChatHistoryItem; buildHistory() forwards toolName/toolArgs/toolResult; backend emits AIMessage(tool_calls)+ToolMessage pair; unit test for tool replay passes |
| CTX-03 | 32-02 | Context-usage ring visible in chat with approximate fill + near-limit warning | AUTOMATED VERIFIED / UAT PENDING | UsageRing component exists; contextUsage computed wired to composer; warning colour at 80%; warn-only (no auto-trim) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `libs/ui/src/lib/input-composer/input-composer.html` | 122 | `title="Emoji (coming soon)"` | INFO | Pre-existing stub — the emoji button was introduced in commit `bc3d3aa` (Phase 33) before Phase 32 touched the file. Phase 32 did not introduce this marker and it is not within the scope of CTX-01/02/03. Not a blocker for this phase. |

No TBD/FIXME/XXX markers found in any file modified by Phase 32.

---

### Human Verification Required

#### 1. Image Reuse Across Turns (CTX-01)

**Test:** Run the app (`pnpm nx serve @org/backend` + `pnpm nx serve frontend`). Attach an image on
turn 1 and ask about it. On turn 3 (without re-attaching), ask a follow-up referencing the image (e.g.
"what colour was the object in that picture?"). Confirm the dino answers correctly from the retained
image. Then attach 2 more images on subsequent turns and confirm the dino no longer has context for the
original image (N=2 cap).

**Expected:** Dino answers from the retained image on turn 3. After 2 newer images are attached, the
original image is no longer in context.

**Why human:** Multimodal replay requires a live LLM response; static analysis verifies the code path
but cannot confirm the model actually receives and reasons over the replayed image bytes.

---

#### 2. Tool-Result Reuse Without Re-Download (CTX-02)

**Test:** With a web-capable dino (e.g. Veloce or Rexford), ask it to fetch a URL. On a follow-up
turn, ask a question answerable from that page. Monitor the SSE stream for `tool_call_start` events —
confirm no second fetch of the same URL. Optionally ask a freshness-sensitive question and confirm the
model is still free to re-fetch.

**Expected:** Follow-up is answered from the cached tool result with no second `tool_call_start` for
the same URL. The tool remains available.

**Why human:** Requires running backend + live OpenRouter calls; absence of a second fetch can only be
confirmed by observing the live SSE stream.

---

#### 3. Context-Usage Ring: Live Fill, ~80% Warning, Warn-Only (CTX-03)

**Test:** With a normal dino, observe the donut ring in the composer near the send button. On a fresh
thread it should show a low percentage. Type a long draft and watch the % climb in real time. Build up
a long conversation (long messages + attached image + fetched page) until the estimate crosses ~80%;
confirm the ring arc shifts to amber and the hover tooltip reads "~N tokens (~X%)". Confirm that
NOTHING is auto-removed from the conversation when over the limit.

**Expected:** Ring visible at low %, increases live with draft text, amber colour + tooltip past 80%,
all messages remain in the conversation sidebar.

**Why human:** Visual appearance, real-time DOM reactivity, and absence of auto-trim require browser
observation.

---

#### 4. Ring Absent From Groupchat and Arena

**Test:** Switch to the group-chat view and the arena view. Confirm no donut ring appears near the
input controls in either view.

**Expected:** No ring visible in group or arena composers.

**Why human:** Requires visual inspection of those views in a running browser.

---

### Gaps Summary

No automated gaps. All 5 must-have truths verified by code inspection and unit tests. The only
outstanding items are 4 human UAT checks (listed above) that require a running app and browser:
- CTX-01: image reuse — code path is complete; live LLM confirmation pending
- CTX-02: tool-result reuse — code path is complete; live SSE confirmation pending
- CTX-03: ring visual + live update + warn-only — code exists and is wired; visual confirmation pending
- Ring scope: groupchat/arena confirmed absent in HTML; visual confirmation pending

The "Emoji (coming soon)" title attribute in input-composer.html is pre-existing from Phase 33,
not introduced by Phase 32, and does not affect any CTX requirement.

---

_Verified: 2026-06-08T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
