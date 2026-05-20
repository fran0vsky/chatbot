# Phase 3: UI/UX Refinement - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 polishes the existing chat interface for a better user experience. No new capabilities are added — everything delivered here improves what's already built.

**Scope:** Markdown rendering in assistant messages, rotating textarea placeholder, copy button on assistant bubbles, "New chat" header button, send button styling refinement.

**Not in scope:** New models, persistent history, authentication, real web search, mobile-specific layouts, accessibility audits, streaming responses.

</domain>

<decisions>
## Implementation Decisions

### Markdown Rendering
- **D-01:** Assistant messages render full markdown: headings, bold/italic, code blocks with language tags, inline code, bullet lists, numbered lists. Plain text is unaffected.
- **D-02:** Use `ngx-markdown` — Angular-native library with directive-based API, fits standalone component pattern.
- **D-03:** Syntax highlighting via `highlight.js` (built into ngx-markdown). Language auto-detection enabled.
- **D-04:** Only assistant message bubbles render markdown. User message bubbles stay plain text (`whitespace-pre-wrap`).

### Empty State / Input Placeholder
- **D-05:** No welcome overlay, no clickable suggested prompts. The message area stays empty and clean on load.
- **D-06:** The textarea placeholder rotates through 3–4 example prompts via a JS interval. Rotation stops (and placeholder clears) as soon as the user focuses the input or starts typing. Examples (Claude picks specific text): e.g., `"Explain quantum computing..."`, `"Write a poem about the ocean..."`, `"Help me debug this code..."`, `"Summarize the history of jazz..."`.
- **D-07:** Placeholder cycling is implemented in `ChatComponent` using `setInterval` / `clearInterval` — no external library.

### Message Actions
- **D-08:** Copy button appears on hover over **assistant** message bubbles only (not user bubbles). Clicking copies the raw markdown text to clipboard via the Clipboard API. Button is a small icon (copy icon SVG), positioned in the top-right corner of the bubble on hover.
- **D-09:** "New chat" button in the header — icon button (pencil or plus SVG icon) placed to the **left of the model selector**, both grouped on the right side of the header. Clicking clears `messages`, resets `draft`, and generates a new `threadId` in `ChatService`. No confirmation dialog.
- **D-10:** No regenerate button. User asks again if they want a different response.

### Input Area & Header Polish
- **D-11:** Send button stays icon-only. Refine existing styling: improve hover/active state (e.g., `hover:bg-blue-600 active:scale-95 transition`). No label added.
- **D-12:** No keyboard shortcut hint text near the input.
- **D-13:** Header layout: `"Chatbot"` title anchored left; model selector and "New chat" icon grouped on the right (`flex items-center gap-2`).

### Claude's Discretion
- Specific SVG icon used for the "New chat" button (pencil vs. plus vs. compose) — pick whichever looks cleanest.
- Exact placeholder example strings (keep them varied and interesting).
- Interval timing for placeholder rotation (suggested: 3000ms).
- Exact hover transition for the copy button (fade-in vs. instant).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Goals & Constraints
- `.planning/ROADMAP.md` — Phase 3 goal; depends on Phase 2
- `.planning/PROJECT.md` — locked constraints: Tailwind-only, Angular standalone + OnPush, no inline styles

### Files to Modify
- `apps/frontend/src/app/chat/chat.html` — main chat template (header, message list, input form)
- `apps/frontend/src/app/chat/chat.ts` — `ChatComponent` class (placeholder rotation, new chat logic, model state)
- `apps/frontend/src/app/chat/chat.service.ts` — `ChatService` (threadId reset for new chat)
- `apps/frontend/src/app/chat/message-bubble/message-bubble.html` — bubble template (markdown rendering, copy button)
- `apps/frontend/src/app/chat/message-bubble/message-bubble.ts` — `MessageBubble` component (copy logic, typing input)
- `apps/frontend/src/app/chat/message-bubble/message-bubble.scss` — bubble styles (hover states)

### Prior Phase Decisions (respected, not re-decided)
- `.planning/phases/01-working-chat/01-CONTEXT.md` — D-10 (input/button disabled during loading), D-14 (header reserved for right-side element)
- `.planning/phases/02-choose-your-model/02-CONTEXT.md` — D-04 (native `<select>` for model), D-05 (selector right-aligned in header), D-07 (selector disabled during loading)

### Conventions
- `apps/frontend/CLAUDE.md` — Angular rules: standalone, OnPush, Tailwind-only, no `any`, services for HTTP
- `.planning/codebase/CONVENTIONS.md` — naming, linting, TypeScript strict mode

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatComponent.isLoading` — already disables input/button/selector; bind same pattern to "New chat" button
- `ChatComponent.messages` / `ChatComponent.draft` — clearing these + resetting `threadId` is all "New chat" needs
- `MessageBubble` `[typing]` input — already exists; copy button logic slots in alongside it
- Bouncing-dot typing indicator — keep as-is, no changes needed

### Established Patterns
- Angular OnPush + `ChangeDetectorRef.detectChanges()` — used in `ChatComponent.send()`; placeholder rotation must call `cdr.markForCheck()` after updating the placeholder string
- Tailwind-only styling — all new UI (copy button, "New chat" button, hover states) must use Tailwind classes; no inline styles
- `@ViewChild('textareaRef')` already in `ChatComponent` — reuse to hook `focus` event for stopping placeholder rotation
- SVG icons already in template (send arrow, error triangle) — follow same inline SVG pattern for new icons

### Integration Points
- `ngx-markdown` directive applied to the assistant bubble `<div>` — replaces the `{{ message.text }}` interpolation in the `@else` branch of `message-bubble.html`
- `ChatService.threadId` — expose a `resetThread()` method (or just reassign `threadId` publicly) so `ChatComponent` can call it from "New chat"
- Clipboard API (`navigator.clipboard.writeText`) — call from `MessageBubble` copy handler; needs `message.text` as input (raw string, not rendered HTML)

</code_context>

<specifics>
## Specific Ideas

- **Placeholder rotation:** The user explicitly wants greyed-out example text that "disappears when you start typing" — standard HTML `placeholder` attribute already provides this. The rotation cycles which placeholder string is shown via JS interval.
- **Copy button position:** Top-right corner of the bubble on hover, small icon, subtle — consistent with how ChatGPT and Claude.ai handle it.
- **"New chat" icon:** Pencil/compose or plus icon — grouped with the model selector on the right, separated by a small gap.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-UI/UX Refinement*
*Context gathered: 2026-05-20*
