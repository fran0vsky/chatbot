# Phase 3: UI/UX Refinement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 3-UI/UX Refinement
**Areas discussed:** Markdown rendering, Empty state, Message actions, Input area polish

---

## Markdown Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Full markdown | Headings, bold/italic, code blocks, inline code, bullet/numbered lists via library | ✓ |
| Code blocks only | Detect fenced code blocks only, everything else plain text | |
| Plain text | Keep whitespace-pre-wrap as-is, no rendering | |

**User's choice:** Full markdown (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| ngx-markdown | Angular-native, directive-based API | ✓ |
| marked.js + DomSanitizer | Lightweight parser, manual sanitization | |
| You decide | Claude picks | |

**User's choice:** ngx-markdown (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with highlight.js | Syntax coloring for code blocks | ✓ |
| Styled but no coloring | Monospace + background, no language coloring | |
| You decide | Claude picks | |

**User's choice:** Yes, with highlight.js (Recommended)

---

## Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Welcome message + starter prompts | Clickable suggested questions fill the textarea | |
| Just a welcome message | Centered heading, no clickable prompts | |
| Nothing — blank canvas | Keep current empty state | |

**User's choice:** Initially leaned toward option 1, then revised.

**Notes:** User stepped back from clickable suggestions. Final decision: no welcome overlay, no clickable prompts. Just update the textarea `placeholder` to rotate through example prompts (greyed-out text that disappears on typing). User said: *"only the random greyed out suggestion which disappears on typing into chatbox"*.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed single example | One static placeholder string | |
| Rotating examples | Cycles through 3–4 examples via JS interval | ✓ |

**User's choice:** Rotating examples

---

## Message Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Copy button on hover | Small icon appears on hover over assistant bubble | ✓ |
| No copy button | Users select text manually | |

**User's choice:** Yes — copy button on hover (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| New chat button in header | Clears messages, resets threadId | ✓ |
| No — refresh to reset | Page refresh already resets session | |

**User's choice:** Yes — "New chat" button in header (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| No regenerate — keep it simple | User asks again if needed | ✓ |
| Regenerate button on last message | Re-sends last user message | |

**User's choice:** No regenerate — keep it simple

---

## Input Area Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Keep icon-only, refine styling | Improve hover/active state, keep arrow icon | ✓ |
| Add a label — 'Send' | Text label for explicitness | |
| You decide | Claude picks | |

**User's choice:** Keep icon-only, just refine styling

| Option | Description | Selected |
|--------|-------------|----------|
| No hint — keep it clean | No keyboard shortcut text visible | ✓ |
| Subtle hint text | Small line below textarea: "Enter to send · Shift+Enter for new line" | |

**User's choice:** No hint — keep it clean (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Chatbot left / selector + new-chat icon right | Compact grouping on right | ✓ |
| Chatbot left / new-chat center / selector right | Three distinct zones | |
| You decide | Claude arranges | |

**User's choice:** 'Chatbot' left — model selector + 'New chat' icon right (Recommended)

---

## Claude's Discretion

- Specific SVG icon for "New chat" (pencil vs. plus vs. compose)
- Exact placeholder example strings (3–4 examples)
- Interval timing for placeholder rotation
- Hover transition style for copy button (fade-in vs. instant)

## Deferred Ideas

None — discussion stayed within phase scope.
