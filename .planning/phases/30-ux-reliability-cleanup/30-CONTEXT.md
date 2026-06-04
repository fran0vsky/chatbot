# Phase 30: UX Reliability & Cleanup - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning
**Source:** Direct planning (ROADMAP Phase 30 + codebase inspection)

<domain>
## Phase Boundary

Four independent frontend reliability/cleanup items. No backend, no DB, no new
features. All changes live in the Angular frontend (`apps/frontend`) and the
shared UI lib (`libs/ui`).

- REL-01 — Loading/skeleton state on chat switch (no stale-message flash)
- REL-02 — Composer textarea no longer breaks layout on very large text
- REL-03 — Remove the "Active" badge from the dino picker cards
- REL-04 — Remove the Explore view entirely (nav entry, view block, type member, voice-action)
</domain>

<decisions>
## Implementation Decisions

### REL-01 — Stale-message flash on chat switch
- `switchToSession()` ([chat.ts:671](../../../apps/frontend/src/app/chat/chat.ts#L671)) swaps `messages` via the
  synchronous `switchSession` reducer ([session.reducer.ts:40](../../../apps/frontend/src/app/store/session/session.reducer.ts#L40)).
- Cover the transition with a transient `threadSwitching` flag on ChatComponent: set true at the top of
  `switchToSession`, render a skeleton in the message-list region instead of the previous thread's bubbles,
  and clear it after the target thread's messages are committed (next animation frame / microtask).
- Skeleton uses Tailwind `animate-pulse` placeholder rows consistent with existing surfaces — no inline styles.
  Check `libs/ui` for an existing skeleton primitive before hand-rolling.

### REL-02 — Composer textarea overflow
- The autoresize already caps height at 8 rows and toggles `atMaxHeight` overflow scroll
  ([input-composer.ts:202](../../../libs/ui/src/lib/input-composer/input-composer.ts#L202)). Vertical is handled.
- The remaining defect is horizontal overflow: the textarea is `flex-1` inside `flex items-center gap-1`
  ([input-composer.html:153](../../../libs/ui/src/lib/input-composer/input-composer.html#L153)) but has no `min-w-0`,
  so a long unbroken paste forces it wider than the pill. Prime fix: add `min-w-0` to the textarea (flex children
  default to `min-width:auto`). Verify by reproducing with a large paste.

### REL-03 — Dino-card "Active" badge
- Remove only the `@if (active) { <span>…Active</span> }` badge ([dino-card.html:17](../../../libs/ui/src/lib/dino-card/dino-card.html#L17)).
- Keep the `active` input and its ring highlight (lines 6-8) — that's the selection affordance, not a badge.
- Update `dino-card.stories.ts` only if it asserts on the badge text.

### REL-04 — Remove Explore
- Delete in lockstep so no dangling `'explore'` member remains:
  - Nav button: [history-panel.html:87-111](../../../libs/ui/src/lib/history-panel/history-panel.html#L87)
  - View block: [chat.html:100-114](../../../apps/frontend/src/app/chat/chat.html#L100)
  - `ActiveView` union member: [ui.actions.ts:6](../../../apps/frontend/src/app/store/ui/ui.actions.ts#L6)
  - Voice action catalogue: `'explore'` in the allowed views list + description ([action-catalogue.ts:42,94](../../../apps/frontend/src/app/store/action-catalogue.ts#L42)) and the `set_active_view` fixture in `action-catalogue.spec.ts:28`.
- The dino gallery stays reachable via the existing picker modal (`openPicker` → chat.html ~620), so removing
  Explore loses no capability (per ROADMAP scope note: supersedes the Explore integration of Phases 19-20).

### Claude's Discretion
- Exact skeleton markup, number of placeholder rows, and the precise flag-clear timing for REL-01.
- Whether REL-02 needs an additional `break-words`/`whitespace` tweak beyond `min-w-0` (decide after repro).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Frontend conventions
- `apps/frontend/CLAUDE.md` — standalone components, OnPush, Tailwind-only, no `console.log`, no `any`, types from `@org/shared-types`
- `.planning/phases/27-ngrx-state-refactor/27-01-PLAN.md` — store/action-catalogue patterns (ActiveView, setActiveView)

### Affected files
- `apps/frontend/src/app/chat/chat.ts`, `apps/frontend/src/app/chat/chat.html`
- `libs/ui/src/lib/input-composer/input-composer.{ts,html}`
- `libs/ui/src/lib/dino-card/dino-card.html`, `libs/ui/src/lib/history-panel/history-panel.html`
- `apps/frontend/src/app/store/ui/ui.actions.ts`, `apps/frontend/src/app/store/action-catalogue.{ts,spec.ts}`
</canonical_refs>

<specifics>
## Specific Ideas
- Keep the `active`/selection ring; only the textual badge is removed (REL-03).
- REL-01 and REL-04 both edit `chat.html` — sequence them (REL-04 depends on REL-01) to avoid a merge collision.
</specifics>

<deferred>
## Deferred Ideas
None — the four items fully scope the phase.
</deferred>

---

*Phase: 30-ux-reliability-cleanup*
*Context gathered: 2026-06-04 via direct planning*
