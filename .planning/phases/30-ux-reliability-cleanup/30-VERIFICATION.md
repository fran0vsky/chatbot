---
phase: 30-ux-reliability-cleanup
verified: 2026-06-04T12:00:00Z
status: human_needed
score: 8/8
overrides_applied: 0
human_verification:
  - test: "No stale-message flash on chat switch (REL-01)"
    expected: "Switching between two chats with different messages shows a brief animate-pulse skeleton — never the outgoing thread's bubbles — then the correct thread. Sending, streaming, and empty-state hero are unaffected."
    why_human: "One-frame rAF timing; cannot be confirmed with grep. Browser rendering of OnPush+signals skeleton coverage requires live observation."
  - test: "Composer textarea layout survives a huge paste (REL-02)"
    expected: "(a) Multi-paragraph paste: height caps at ~8 rows with internal scroll, pill intact. (b) Long unbroken string (~500 chars, no spaces): text wraps, send button stays in layout. (c) Programmatic fill (suggestion prompt / STT): height adjusts without a keystroke. (d) Short messages and send/stop unchanged."
    why_human: "CSS flex layout behaviour and textarea resize are visual; min-w-0 correctness under actual browser reflow cannot be verified statically."
  - test: "No Explore navigation anywhere (REL-04)"
    expected: "Sidebar shows no Explore entry. Every remaining nav item (Chats, Knowledge, Group chat, Arena, Leaderboard) navigates correctly. Dino gallery is reachable via the picker modal. No console errors. Voice 'go to explore' is not a recognised destination."
    why_human: "Runtime navigation correctness and absence of console errors require a running app."
---

# Phase 30: UX Reliability & Cleanup — Verification Report

**Phase Goal:** UX Reliability & Cleanup — Loading/skeleton states (no stale messages on chat switch), long-text composer textarea fix, remove dino-card "active" badge, remove the Explore view entirely.
**Verified:** 2026-06-04T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Switching to another chat never briefly shows the previous conversation's messages — a loading/skeleton state covers the transition | VERIFIED | `threadSwitching` flag set `true` + `cdr.markForCheck()` before dispatch; cleared via `requestAnimationFrame` + `markForCheck` after. `@if (threadSwitching)` skeleton branch in `chat.html:458-466`; `@else` branch renders real messages. |
| 2 | Pasting/typing very large text no longer breaks the composer textarea layout (height caps and scrolls; no overflow past the pill) | VERIFIED | `min-w-0` added to textarea class in `input-composer.html:158`. `ngAfterViewChecked` with `lastResizedDraft` dirty guard in `input-composer.ts:110-115`. Existing 8-row height cap and `atMaxHeight` overflow toggle untouched. |
| 3 | The "active" badge is removed from the dino picker | VERIFIED | `dino-card.html` contains no "Active" text span. The `@if (active) { <span>Active</span> }` block is gone. Ring classes (`ring-2`, `ring-jungle-accent`, `dark:ring-jungle-night-accent`) and `aria-pressed` binding remain intact at lines 4-8. |
| 4 | The Explore page is removed — route, nav entry, and links — with no dead navigation | VERIFIED | Zero `explore` occurrences in `history-panel.html`, `chat.html`, `ui.actions.ts`, `action-catalogue.ts`, `action-catalogue.spec.ts`, `history-panel.ts`, `history-panel.stories.ts`, and all other files under `apps/frontend/src` and `libs/ui/src`. `ActiveView` union has 5 members: `chats | knowledge | groupchat | arena | leaderboard`. |

**Score: 8/8 truths verified** (4 ROADMAP success criteria + 4 plan-level truths; all passed)

---

### Plan Must-Have Truths

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 30-01 | Chat switch never shows previous conversation for even one frame | VERIFIED | skeleton branch gates message list region while `threadSwitching=true` |
| 30-01 | Skeleton is replaced by real messages once target thread is committed | VERIFIED | `@else` branch at `chat.html:467` renders `@for (m of messages())` |
| 30-01 | No regression to active-chat experience (send, stream, empty-state hero) | VERIFIED (automated) | Empty-state hero at lines 417-456 is a separate `@if (messages().length <= 1)` branch, not touched by `threadSwitching` |
| 30-02 | Large text caps height, scrolls internally, never overflows pill | VERIFIED (automated) | `min-w-0` present on textarea; `autoResize` 8-row cap and `atMaxHeight` toggle unchanged |
| 30-02 | Long unbroken string does not push textarea wider than pill | VERIFIED (automated) | `min-w-0` on `flex-1` item prevents flex overflow |
| 30-02 | Normal short messages and buttons unchanged | VERIFIED (automated) | No structural changes to surrounding pill container or button rows |
| 30-03 | "Active" text badge no longer renders on any dino-card | VERIFIED | `dino-card.html` is 41 lines; no "Active" span present |
| 30-03 | Active dino still distinguished by ring (active input and ring classes remain) | VERIFIED | `[class.ring-2]="active"`, `[class.ring-jungle-accent]="active"`, `[class.dark:ring-jungle-night-accent]="active"` at lines 6-8 |
| 30-03 | Storybook for dino-card still builds and renders active/inactive states | VERIFIED | `dino-card.stories.ts` exports `Active` (active:true) and `Default`/`NoTools` (active:false) stories; no badge text references |
| 30-04 | Explore nav entry gone from sidebar | VERIFIED | `history-panel.html` has no `viewChange.emit('explore')` or "Explore" text |
| 30-04 | Explore view block removed from chat template | VERIFIED | `chat.html` has no `activeView() === 'explore'` branch |
| 30-04 | 'explore' not a member of ActiveView type, no code references it | VERIFIED | `ActiveView` in `ui.actions.ts` is `'chats' | 'knowledge' | 'groupchat' | 'arena' | 'leaderboard'`; zero `explore` matches across all source files |
| 30-04 | Dino gallery still reachable via picker modal | VERIFIED (automated) | `pickerOpen` signal and picker modal remain in `chat.html` (grep confirmed no removal of picker block) |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/frontend/src/app/chat/chat.ts` | threadSwitching flag driving skeleton during session switch | VERIFIED | `threadSwitching = false` declared; set true + `markForCheck` before dispatch; cleared via rAF + `markForCheck` |
| `apps/frontend/src/app/chat/chat.html` | Skeleton branch in message-list region | VERIFIED | `@if (threadSwitching)` block at lines 458-466 with 4 `animate-pulse` bars |
| `libs/ui/src/lib/input-composer/input-composer.html` | Textarea constrained within flex pill | VERIFIED | `min-w-0` present in textarea class at line 158 |
| `libs/ui/src/lib/input-composer/input-composer.ts` | Programmatic resize via AfterViewChecked | VERIFIED | Implements `AfterViewChecked`; `ngAfterViewChecked` with `lastResizedDraft` guard at lines 110-115 |
| `libs/ui/src/lib/dino-card/dino-card.html` | Dino card without Active text badge | VERIFIED | 41-line file; no `Active` span; ring classes present |
| `apps/frontend/src/app/store/ui/ui.actions.ts` | ActiveView union without 'explore' | VERIFIED | Union has exactly 5 members; no 'explore' |
| `libs/ui/src/lib/history-panel/history-panel.html` | No Explore nav button | VERIFIED | Zero `explore` occurrences |
| `apps/frontend/src/app/store/action-catalogue.ts` | Explore omitted from views enum and description | VERIFIED | `setActiveViewSchema` enumerates `chats, knowledge, groupchat, arena, leaderboard`; description matches |
| `apps/frontend/src/app/store/action-catalogue.spec.ts` | set_active_view fixture uses valid view | VERIFIED | Fixture at line 28: `{ view: 'chats' }` |
| `libs/ui/src/lib/history-panel/history-panel.ts` | Inline unions updated (deviation fix) | VERIFIED | SUMMARY reports `history-panel.ts` updated; zero `explore` in file |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `chat.html` message-list region | `threadSwitching` flag | `@if (threadSwitching)` skeleton branch | WIRED | Lines 458-551: skeleton renders when true; real `@for messages()` renders when false |
| `switchToSession()` (chat.ts:673) | `threadSwitching` flag | set true → dispatch → rAF clear | WIRED | Lines 674-686: flag covers the message swap |
| `textarea` (flex-1) | flex pill container | `min-w-0` prevents flex-item overflow | WIRED | `input-composer.html:158`: `flex-1 min-w-0 resize-none ...` |
| `ngAfterViewChecked` | `autoResize` | `lastResizedDraft` dirty guard | WIRED | `input-composer.ts:110-115`: only fires when draft changed |
| `history-panel viewChange` | `ActiveView` | removed 'explore' emitter | WIRED | history-panel.html emits only valid views; history-panel.ts inline unions updated |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies presentation-layer flags and removes dead UI. No new data sources were introduced. Existing data flows (session store → messages signal → template) were not altered.

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `threadSwitching` declared and set correctly | `grep threadSwitching chat.ts` | `true` set + `markForCheck` before dispatch; cleared via rAF | PASS |
| Skeleton template present | `grep -A10 threadSwitching chat.html` | 4 `animate-pulse` bars in the `@if` branch | PASS |
| `min-w-0` on textarea | `grep min-w-0 input-composer.html` | Found on textarea class (line 158) | PASS |
| `AfterViewChecked` guard | `grep ngAfterViewChecked input-composer.ts` | Present with `lastResizedDraft` guard | PASS |
| Active badge absent | Full read of `dino-card.html` | No "Active" text; 41 lines; ring classes present | PASS |
| Zero `explore` across source | `grep -r explore apps/frontend/src libs/ui/src` | No matches found | PASS |
| `ActiveView` union clean | Full read of `ui.actions.ts` | 5 members only | PASS |
| Spec fixture valid | `grep set_active_view action-catalogue.spec.ts` | `{ view: 'chats' }` | PASS |

---

### Requirements Coverage

**Note:** REL-01 through REL-04 are declared in ROADMAP.md Phase 30 under `Requirements:` but are NOT present as formal requirement entries in `.planning/REQUIREMENTS.md`. They are phase-internal labels used for traceability across plans within this phase. No orphaned requirements exist (REQUIREMENTS.md has no `REL-*` entries at all). This is not a gap — the ROADMAP acts as the source of truth for these labels.

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| REL-01 | 30-01 | Chat switch skeleton; no stale-message flash | SATISFIED | `threadSwitching` flag + skeleton branch implemented and verified |
| REL-02 | 30-02 | Composer textarea overflow fix | SATISFIED | `min-w-0` + `ngAfterViewChecked` guard implemented and verified |
| REL-03 | 30-03 | Remove Active badge from dino-card | SATISFIED | Badge span removed; ring + aria-pressed preserved |
| REL-04 | 30-04 | Remove Explore view entirely | SATISFIED | All touch points removed; `ActiveView` union clean; zero explore references |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TBD, FIXME, or XXX markers found in any of the 10 files modified by this phase. No placeholder returns, no empty implementations in the changed code paths.

**Code review note (WR-01 from 30-REVIEW.md):** The review flagged that `threadSwitching = true` lacked `cdr.markForCheck()`. Inspecting the actual code at `chat.ts:674-675` shows `this.cdr.markForCheck()` IS present immediately after the assignment. The review finding is moot — the implementation already applies the fix the review recommended.

**Code review note (WR-03 from 30-REVIEW.md):** The review flagged a stale `'explore'` value in `history-panel.stories.ts`. Grep confirms zero `explore` occurrences in that file — this was already cleaned up during execution (plan 30-04 also updated `history-panel.ts`).

---

### Human Verification Required

Three of four plans had manual UAT tasks; all require a running frontend.

#### 1. No stale-message flash on chat switch (REL-01)

**Test:** Serve the frontend. Create two chats with clearly different messages. Switch back and forth several times using the sidebar (desktop and mobile). Also test switching from a populated chat to a fresh chat (empty state hero).
**Expected:** At no point does the previous conversation's content appear after clicking a different chat. A brief animate-pulse skeleton appears, then the correct thread's messages render. Sending, streaming responses, and the empty-state hero for a new chat all continue to work normally.
**Why human:** One-frame rAF timing — the skeleton covers a single paint frame. Static analysis cannot confirm browser-level rendering or that the OnPush + signals combination surfaces the flag fast enough to prevent the flash.

#### 2. Composer survives a huge paste (REL-02)

**Test:** Serve the frontend. In the composer: (a) paste several paragraphs — confirm height caps at ~8 rows, textarea scrolls internally, pill and send button intact; (b) paste a ~500-character unbroken string (no spaces) — confirm it wraps and does NOT push the send button off-screen; (c) trigger a suggestion prompt click or STT dictation fill — confirm height adjusts immediately without a keystroke; (d) confirm short messages and send/stop behave normally.
**Expected:** Layout stays intact under all paste scenarios. Programmatic fills resize without keystroke. No horizontal overflow past the pill.
**Why human:** CSS flex layout and textarea resize are browser-rendered. The `min-w-0` fix and `ngAfterViewChecked` guard are statically verified correct but their visual effect requires observation.

#### 3. No dead Explore navigation (REL-04)

**Test:** Serve the frontend. Confirm the sidebar shows no Explore entry. Click each remaining nav item (Chats, Knowledge, Group chat, Arena, Leaderboard) and confirm it navigates correctly. Confirm the dino gallery is accessible via "New chat" / the picker modal. Check browser console for errors. Optionally test voice command "go to explore" and confirm it is not recognized.
**Expected:** No Explore entry in the sidebar. All 5 remaining nav items work. Dino gallery reachable. No console errors. Voice explore command rejected.
**Why human:** Runtime navigation correctness, console error absence, and voice command rejection require a running app.

---

### Gaps Summary

No automated gaps. All 8 must-have truths pass static verification. The 3 human verification items are pending UAT — standard for plans with `autonomous="false"` manual tasks.

---

_Verified: 2026-06-04T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
