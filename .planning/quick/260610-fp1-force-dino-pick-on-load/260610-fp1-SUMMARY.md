---
quick_id: 260610-fp1
slug: force-dino-pick-on-load
date: 2026-06-10
status: complete
---

# Quick Task 260610-fp1 — Summary

## What changed

The app can no longer sit in a no-dino-chosen state on load/reload.

- **`apps/frontend/src/app/chat/chat.ts`**
  - New constructor `effect()`: once the dino roster has loaded and no
    `activeDinoId` is set, dispatch `UiActions.openPicker()`. Fires on fresh
    load/reload (and any time the selection is cleared).
  - New `dismissPicker()` method: no-op while `activeDinoId()` is falsy;
    otherwise delegates to `closePicker()`.

- **`apps/frontend/src/app/chat/chat.html`** (picker overlay)
  - Backdrop click now calls `dismissPicker()` instead of `closePicker()`.
  - Close (X) button wrapped in `@if (activeDinoId())` so it's hidden until a
    dino is selected — making the initial pick mandatory.

`pickDino()` already closes the picker on selection, so choosing any dino exits
the forced state normally.

## Verification

- `nx build frontend` — succeeded (only pre-existing prismjs CommonJS warnings).
- Logic trace: effect has no reactive dependency on `pickerOpen`, so it won't
  loop; it re-evaluates only when `dinos()` or `activeDinoId()` change.

## Notes

No store/reducer changes were needed — reused existing `openPicker`/`closePicker`
UI actions.

## Update — dedicated welcome screen (supersedes forced modal)

Per follow-up feedback, the forced-modal approach was replaced with a dedicated
welcome/onboarding screen — a friendlier landing than a modal over an empty chat.

- **Reverted** the auto-open `effect()`, `dismissPicker()`, and the
  non-dismissable modal tweaks (backdrop + hidden X). The "New chat" picker modal
  is back to its original always-dismissable behavior (used for mid-session dino
  switching, where a dino is already bound).
- **`chat.html`** — added a welcome branch as the first case of the center-column
  view switch: `@if (activeView() === 'chats' && !activeDinoId())`. It renders
  "Welcome to DinoAgents", the tagline, a one-line intro to what DinoAgents is,
  a "Pick your agent" heading, and the existing `<app-dino-picker>` grid inline
  (wired to `pickDino()`). Selecting a dino sets it active and drops the user into
  the normal chat view.

Net guarantee is unchanged — the app never sits in a no-dino chat state — but the
entry is now a proper welcome page instead of a locked modal.

`nx build frontend` — succeeded.
