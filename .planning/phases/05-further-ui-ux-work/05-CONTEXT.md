# Phase 5: Further UI/UX Work - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 adds three UX polish improvements to the desert-themed chatbot: message entry animations (slide+fade), input textarea resize refinement (overflow fix at max height), and code block enhancements (language badge + copy button in a persistent header bar).

**Scope:** Message animations, textarea overflow-at-max-height fix, code block header bar with language label and copy button.

**Not in scope:** Mobile/responsive layout, new chat capabilities, streaming responses, accessibility audits, new models, persistent history.

</domain>

<decisions>
## Implementation Decisions

### Message Animations
- **D-01:** New messages slide in from the side they appear on — user messages from right, assistant messages from left — while fading in simultaneously. Duration: ~150ms. Use CSS transitions or Angular animations.
- **D-02:** The typing indicator (bouncing dots bubble) also animates in with the same slide+fade treatment — slides in from the left like a regular assistant bubble.
- **D-03:** Only messages that arrive during an active session animate. Messages present on initial load (the greeting) and after a new-chat reset appear instantly — no cascade animation on load/reset.

### Input Auto-Resize
- **D-04:** The textarea already auto-grows up to 5 lines (`autoResize` in `ChatInput`). The refinement: when at max height, switch to `overflow-y-auto` (currently `overflow-hidden`) so the user can scroll through long text inside the textarea.
- **D-05:** Enter-to-send and Shift+Enter-for-newline are already implemented — no changes needed to that behavior.
- **D-06:** The `autoResize` method's hardcoded `lineHeight = 24` may not match the rendered line height. Fix to use actual `scrollHeight`-based calculation or derive from computed styles.

### Code Block UX
- **D-07:** A persistent header bar appears above every code block: language label on the left, copy button on the right. The bar is always visible (not hover-only).
- **D-08:** Language label shows the detected language string (e.g., `typescript`, `bash`, `json`). If no language is detected, show nothing in the label slot (or omit the label entirely for that block).
- **D-09:** Copy button icon swaps to a checkmark for 2 seconds after click, then reverts. Matches the existing message-bubble copy button behavior (Phase 3 pattern).
- **D-10:** Code block copy copies the raw code text (no HTML, no syntax tokens).

### Claude's Discretion
- Exact CSS animation implementation: Angular `@trigger` animations vs. Tailwind CSS keyframes vs. custom CSS classes — pick whichever integrates cleanest with the existing `MessageBubble` component and OnPush change detection.
- Header bar styling for code blocks: background color, font size for language label, button padding — must use Tailwind classes and complement both day-mode and night-mode desert palettes.
- Whether the animation is applied at the `MessageBubble` component level (preferred — encapsulated) or at the `ChatComponent` message list level.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Goals & Constraints
- `.planning/ROADMAP.md` — Phase 5 goal and dependency on Phase 4
- `.planning/PROJECT.md` — locked constraints: Tailwind-only, Angular standalone + OnPush, no inline styles

### Files to Modify
- `libs/ui/src/lib/message-bubble/message-bubble.html` — animation trigger attachment point
- `libs/ui/src/lib/message-bubble/message-bubble.ts` — animation definition (if Angular animations used)
- `libs/ui/src/lib/message-bubble/message-bubble.scss` — animation CSS (if CSS keyframes used)
- `libs/ui/src/lib/chat-input/chat-input.ts` — `autoResize` fix (overflow + line-height accuracy)
- `libs/ui/src/lib/chat-input/chat-input.html` — textarea class change at max height (overflow-y-auto)

### Prior Phase Decisions (respected, not re-decided)
- `.planning/phases/04-dark-theme-and-visual-polish/04-CONTEXT.md` — desert day/night palette tokens, D-09 (snake avatar on assistant bubbles)
- `.planning/phases/03-ui-ux-refinement/03-CONTEXT.md` — D-08 (message bubble copy button pattern — checkmark swap, top-right position)
- `.planning/phases/01-working-chat/01-CONTEXT.md` — D-10 (OnPush + ChangeDetectorRef pattern)

### Conventions
- `apps/frontend/CLAUDE.md` — Angular rules: standalone, OnPush, Tailwind-only, no `any`, services for HTTP
- `.planning/codebase/CONVENTIONS.md` — naming, linting, TypeScript strict mode

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MessageBubble` — animations belong here; already has `[typing]` input and role-based branching; snake avatar and copy button already in the assistant branch
- `ChatInput.autoResize()` — already implemented, needs overflow fix; `overflow-hidden` → `overflow-y-auto` when at max height
- `MessageBubble` copy button (Phase 3) — established pattern for checkmark-swap copy feedback; code block copy button follows the same pattern
- Prism.js in `ngx-markdown` — already rendering syntax-highlighted code blocks; need to wrap `<pre>` elements with a header bar

### Established Patterns
- Angular OnPush + `ChangeDetectorRef.markForCheck()` — animation state changes (e.g., `isNew` flag) must trigger CD
- Tailwind-only — all new UI (code block header bar, animation classes) must use Tailwind; custom desert palette tokens already defined in `tailwind.config.js`
- Inline SVG icons — send arrow, error triangle, copy/checkmark icons all inline SVG; code block copy button follows same pattern
- `group` / `group-hover` Tailwind pattern — used for message bubble copy button hover; code block header is always-visible so no group-hover needed

### Integration Points
- Code block header bar: `ngx-markdown` renders `<pre><code class="language-X">` elements; inject the header via a `AfterViewChecked` DOM post-processing step or a custom Prism plugin hook (Prism toolbar plugin). Downstream agent should investigate ngx-markdown's `[clipboard]` directive — it may already provide the copy hook.
- Message animation: Angular's `@Component` animations or a CSS `@keyframes` class toggled via `[class.is-new]="isNew"` on the bubble wrapper. The `isNew` flag defaults `false` on existing messages, set `true` only for messages appended during an active session.
- `ChatInput` overflow: when `textarea.scrollHeight >= lineHeight * maxRows`, toggle the element's overflow class from `overflow-hidden` to `overflow-y-auto`.

</code_context>

<specifics>
## Specific Ideas

- **Animation feel:** Snappy 150ms — fast enough to feel instant, slow enough to register. Consistent with Phase 3 hover transitions.
- **Code block header:** Always-visible bar (not hover-dependent) — more discoverable, consistent with how GitHub, Claude.ai, and ChatGPT render code blocks. Language label left, copy icon right.
- **Input refinement scope:** The auto-resize is already working; this is a targeted fix (overflow + line-height accuracy), not a rewrite.

</specifics>

<deferred>
## Deferred Ideas

- **Mobile / responsive layout** — discussed as a Phase 5 candidate but not selected. Natural next phase if mobile matters.

</deferred>

---

*Phase: 5-further-ui-ux-work*
*Context gathered: 2026-05-20*
