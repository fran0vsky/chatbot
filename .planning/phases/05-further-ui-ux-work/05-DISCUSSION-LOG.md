# Phase 5: Further UI/UX Work - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 5-further-ui-ux-work
**Areas discussed:** Message animations, Input auto-resize, Code block UX

---

## Area Selection

| Option | Selected |
|--------|----------|
| Message animations | ✓ |
| Input auto-resize | ✓ |
| Code block UX | ✓ |
| Mobile / responsive layout | |

---

## Message Animations

### How should new messages enter the chat?

| Option | Description | Selected |
|--------|-------------|----------|
| Slide + fade | Messages slide in from their side (user right, assistant left) while fading in | ✓ |
| Fade only | Simple opacity transition — subtle and safe | |
| Scale + fade | Scale from ~90% to 100% while fading in | |

**User's choice:** Slide + fade
**Notes:** Matches the bubble layout. User from right, assistant from left.

---

### Should the typing indicator animate in too?

| Option | Description | Selected |
|--------|-------------|----------|
| Animate it in too | Typing indicator slides in from the left like a regular assistant bubble | ✓ |
| Keep as-is | Only permanent messages get the animation | |

**User's choice:** Animate it in too

---

### Animation duration

| Option | Description | Selected |
|--------|-------------|----------|
| Snappy — ~150ms | Fast enough to feel instant, slow enough to register | ✓ |
| Smooth — ~250ms | More noticeable, slightly slower | |
| You decide | Claude picks 150–200ms | |

**User's choice:** ~150ms

---

### Which messages animate?

| Option | Description | Selected |
|--------|-------------|----------|
| Active session only | Only messages arriving during an active session; greeting and new-chat reset appear instantly | ✓ |
| All messages including on load | Every message animates, including initial greeting and post-reset | |

**User's choice:** Active session only
**Notes:** Avoids distracting cascade on page load and new-chat reset.

---

## Input Auto-Resize

### How should the textarea grow?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-grow with a max height | Grows to ~5 lines max, then scrolls internally | ✓ |
| Auto-grow unbounded | Keeps growing with no cap | |
| Fixed height with scroll | Keep current fixed height | |

**User's choice:** Auto-grow with max height
**Notes:** Already partially implemented — `autoResize()` exists with 5-line cap. Work is refinement only.

---

### Enter/Shift+Enter behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Enter sends, Shift+Enter newline | Standard chat behavior | ✓ |
| Enter always newline, button to send | More like a text editor | |

**User's choice:** Enter sends, Shift+Enter newline
**Notes:** Already implemented in `onKeydown`. No code change needed for this.

---

### Behavior at max height

| Option | Description | Selected |
|--------|-------------|----------|
| Show internal scroll | Switch to overflow-y-auto at max height | ✓ |
| Stay clipped, no scroll | Keep overflow-hidden | |

**User's choice:** Show internal scroll
**Notes:** Current `overflow-hidden` clips text above the fold when maxed out. Fix: toggle to `overflow-y-auto` when `scrollHeight >= lineHeight * maxRows`.

---

## Code Block UX

### What should a code block look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Copy button + language badge | Label top-left, copy button top-right | ✓ |
| Copy button only | Just the copy icon | |
| Language badge only | Shows language, no copy | |

**User's choice:** Copy button + language badge

---

### Copy button feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Icon swaps to checkmark for 2s | Matches Phase 3 message bubble copy pattern | ✓ |
| "Copied!" text label | More explicit | |
| You decide | Claude picks | |

**User's choice:** Icon swaps to checkmark for 2s
**Notes:** Consistent with existing message bubble copy button behavior.

---

### Header visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Header bar always shown above code block | ✓ |
| On hover only | Header fades in on hover | |

**User's choice:** Always visible
**Notes:** More discoverable — users know copying is available without hovering.

---

## Claude's Discretion

- Animation implementation technique: Angular `@trigger` vs CSS `@keyframes` class toggle — pick whichever integrates cleanest with OnPush + MessageBubble
- Code block header bar styling: background, font size, padding — must complement both desert day and night palettes
- Whether animation lives at `MessageBubble` level or `ChatComponent` message list level

## Deferred Ideas

- **Mobile / responsive layout** — discussed as a Phase 5 candidate, not selected. Natural next phase if mobile support is needed.
