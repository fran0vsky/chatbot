---
phase: 30-ux-reliability-cleanup
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - apps/frontend/src/app/chat/chat.html
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/store/action-catalogue.spec.ts
  - apps/frontend/src/app/store/action-catalogue.ts
  - apps/frontend/src/app/store/ui/ui.actions.ts
  - libs/ui/src/lib/dino-card/dino-card.html
  - libs/ui/src/lib/history-panel/history-panel.html
  - libs/ui/src/lib/history-panel/history-panel.ts
  - libs/ui/src/lib/input-composer/input-composer.html
  - libs/ui/src/lib/input-composer/input-composer.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 30 delivered four targeted changes: thread-switch skeleton screen, textarea overflow fix, Active badge removal from `dino-card`, and Explore view removal. The skeleton screen and the textarea `overflow-y-auto` / `overflow-hidden` toggle are implemented correctly. The Active badge is gone from `dino-card.html` and the `active` input is retained (still used by `dino-picker`). No new security issues were introduced.

Four warnings and three info items were found; no blockers.

The most actionable issues are:

1. The `threadSwitching` flag is a plain boolean on an OnPush component — the view reads it directly in the template but mutations outside `requestAnimationFrame` (the `true` assignment) are not guarded by `cdr.markForCheck()`, so the skeleton can fail to paint in certain timing windows.
2. Stale `'explore'` string in `history-panel.stories.ts` will break Storybook's argType control after the Explore view was removed.
3. `finishRequest()` calls `persistActiveSession` with potentially empty `sessionTitle` / zero `sessionCreatedAt` without the fallback guard used everywhere else, so a session completed without a title produces a persisted "Untitled" record with `createdAt = 0`.

---

## Warnings

### WR-01: `threadSwitching = true` mutates a plain field without triggering OnPush re-render

**File:** `apps/frontend/src/app/chat/chat.ts:674`
**Issue:** `threadSwitching` is an ordinary class field (`threadSwitching = false`). `ChatComponent` uses `ChangeDetectionStrategy.OnPush`. The assignment `this.threadSwitching = true` at line 674 is made directly in `switchToSession()` — an event handler — with no subsequent `cdr.markForCheck()` or `cdr.detectChanges()` call before Angular's next CD pass. The template at `chat.html:458` reads this field synchronously. If the event does not already sit inside an Angular Zone tick that triggers a fresh CD cycle (possible in test environments or when the event is triggered programmatically), the skeleton will not appear and stale message bubbles will paint during the switch.

The `false` leg is correctly guarded: `requestAnimationFrame(() => { this.threadSwitching = false; this.cdr.markForCheck(); })`. The `true` leg lacks the same discipline.

**Fix:**
```typescript
switchToSession(session: ConversationSession): void {
  this.threadSwitching = true;
  this.cdr.markForCheck(); // add this line — ensure OnPush picks up the flag
  this.saveCurrentSession();
  // ...rest unchanged
}
```

---

### WR-02: `finishRequest()` persists with empty title / zero `createdAt`

**File:** `apps/frontend/src/app/chat/chat.ts:1014`
**Issue:** `finishRequest()` calls `this.persistActiveSession(this.sessionTitle, this.sessionCreatedAt)` without the `|| 'Untitled'` and `|| Date.now()` fallback guards that every other callsite uses (`onStop()` line 656, `saveCurrentSession()` line 735). If a streaming response completes before `onSend()` sets `sessionTitle` (not a normal path, but possible if `dispatchRequest` is called directly), the session is persisted with `title = ''` and `createdAt = 0`.

**Fix:**
```typescript
private finishRequest(): void {
  this.isLoading = false;
  this.persistActiveSession(
    this.sessionTitle || 'Untitled',
    this.sessionCreatedAt || Date.now(),
  );
  this.cdr.detectChanges();
  this.scrollToBottom();
}
```

---

### WR-03: Stale `'explore'` value in `history-panel.stories.ts` breaks Storybook control

**File:** `libs/ui/src/lib/history-panel/history-panel.stories.ts:11` and `:64`
**Issue:** Phase 30 removed the Explore view. `HistoryPanel`'s `activeView` input type was narrowed to the remaining five views: `'chats' | 'knowledge' | 'groupchat' | 'arena' | 'leaderboard'`. The stories file still lists `'explore'` as a valid `inline-radio` option and sets `activeView: 'explore'` in the `ExploreActive` story. At runtime Storybook will pass a value that is outside the declared union type; depending on Angular compiler strictness, this can cause a template error or a confusing no-highlight state on all nav buttons.

**Fix:** Remove `'explore'` from the `options` array, update `ExploreActive` story to use a current view (e.g. `'chats'`), or delete the story entirely.

```typescript
argTypes: {
  activeView: {
    control: 'inline-radio',
    options: ['chats', 'knowledge', 'groupchat', 'arena', 'leaderboard'],
  },
},
// ...
export const ExploreActive: Story = {
  args: {
    sessions: sampleSessions,
    activeSessionId: '',
    activeView: 'chats', // was 'explore' — view no longer exists
  },
};
```

---

### WR-04: `autoResize` reads `scrollHeight` after forcing `height: auto` — can produce off-by-one when `overflow-hidden` is already applied

**File:** `libs/ui/src/lib/input-composer/input-composer.ts:218-228`
**Issue:** `autoResize` sets `textarea.style.height = 'auto'` and then reads `textarea.scrollHeight`. This is the standard pattern. However, `atMaxHeight` controls whether the template applies `overflow-hidden` or `overflow-y-auto` on the textarea. On the _first_ call after `atMaxHeight` switches to `true` the browser has already applied `overflow-hidden` (from the previous CD cycle). Setting `height: auto` on an element with `overflow: hidden` causes the browser to collapse the textarea to its minimum intrinsic height, then `scrollHeight` is recalculated. In practice the height still snaps to `maxHeight` (line 226) because `Math.min(scrollHeight, maxHeight)` — but only if `scrollHeight` reflects the content, which it may not under `overflow: hidden`. This is a subtle cross-browser layout issue that manifests as an off-by-one row when the user types to exactly 8 lines.

**Fix:** Before measuring, temporarily force `overflow: visible` (or remove the overflow constraint), measure, then restore:

```typescript
autoResize(textarea: HTMLTextAreaElement): void {
  const prevOverflow = textarea.style.overflow;
  textarea.style.overflow = 'hidden'; // prevent scrollbar flash
  textarea.style.height = 'auto';
  const computed = getComputedStyle(textarea);
  const parsed = parseFloat(computed.lineHeight);
  const lineHeight = Number.isNaN(parsed) ? 24 : parsed;
  const maxRows = 8;
  const maxHeight = lineHeight * maxRows;
  const target = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = target + 'px';
  textarea.style.overflow = prevOverflow;
  this.atMaxHeight = textarea.scrollHeight > maxHeight;
}
```

---

## Info

### IN-01: `DinoCard.active` input is now unused in all production rendering paths

**File:** `libs/ui/src/lib/dino-card/dino-card.ts:20`
**Issue:** Phase 30 removed the Active badge from `dino-card.html`. The template now reads `active` only to set a focus ring (`[class.ring-2]="active"` etc. — lines 6–8). This is intentional design, but the `@Input() active = false;` field plus the `aria-pressed` binding still signal a dual purpose (selection indicator + visual ring) that is no longer consistent — the badge that formerly made the selection visible to non-keyboard users is gone. The `active` input is still passed by `dino-picker.html` so this is not dead code from a compilation standpoint, but the ring alone provides weak affordance.

**Suggestion:** No code change required. Consider adding a comment to the template explaining that the ring is the sole active indicator, so future reviewers don't re-add the badge.

---

### IN-02: `switch_chat` action in the catalogue only dispatches `setActiveSessionId` — does not switch thread or load messages

**File:** `apps/frontend/src/app/store/action-catalogue.ts:77-79`
**Issue:** `switch_chat` dispatches `SessionActions.setActiveSessionId({ id: sessionId })`. In `ChatComponent.switchToSession()`, a full session switch also calls `this.chatService.setThread(session.id)`, `SessionActions.switchSession({ session })`, and `DinoActions.setActiveDino(...)`. The catalogue's `switch_chat` only dispatches the id update; the thread context and message list will be out of sync if the voice assistant uses this path. The companion subscription in `ChatComponent` does not react to `setActiveSessionId` to complete the switch.

This is a pre-existing issue that phase 30 did not introduce, but since phase 30 added `setActiveViewSchema` to the catalogue and the tests verify catalogue correctness, it is worth surfacing.

**Suggestion:** Either document that `switch_chat` is intentionally partial (user must also navigate to the chat view), or extend the action or add a seam effect that triggers the full `switchToSession` path.

---

### IN-03: `history-panel.html` user chip has hardcoded name "Franek" and "Free Plan"

**File:** `libs/ui/src/lib/history-panel/history-panel.html:259-261`
**Issue:** The user chip at the bottom of the sidebar renders `Franek` and `Free Plan` as static strings. These are not bound to any `@Input()`. The chip button has no `(click)` handler either. This is benign for a single-user demo but will require a template change (not just a config change) when multi-user or auth is added.

**Suggestion:** Move the display name and plan tier into `@Input()` properties, or add a TODO comment if this is intentionally deferred.

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
