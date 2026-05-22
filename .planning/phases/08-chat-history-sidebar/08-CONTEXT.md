# Phase 8: Chat History Sidebar - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert the existing toggleable history drawer into a ChatGPT-style persistent left sidebar on desktop, while keeping drawer behavior on mobile. Add date-grouped session organization. The HistoryService, HistoryPanel component, ConversationSession type, and ChatComponent wiring are all already built — this phase refines the presentation layer only.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Layout
- **D-01:** On desktop (≥ `lg` breakpoint, 1024px+): sidebar is always visible as a persistent column in the main flex layout — no toggle, no overlay, no backdrop. It pushes chat content to the right.
- **D-02:** On mobile (< `lg`): sidebar remains a toggleable overlay/drawer (current behavior: fixed position, translates in from left, backdrop behind it). The header toggle button is visible on mobile only.
- **D-03:** Sidebar width: `w-64` (256px) on desktop. The current `w-72` can shrink slightly to give more room to the chat area.
- **D-04:** Layout structure in `chat.html`: wrap the whole page in `flex flex-row h-screen`, the sidebar becomes a sibling flex column to the main chat column.

### Session Organization
- **D-05:** Sessions are grouped by date into labeled sections: **Today**, **Yesterday**, **Previous 7 days**, **Older**. Sections with no sessions are omitted entirely.
- **D-06:** Within each group, sessions are ordered newest-first (existing behavior preserved).
- **D-07:** Section labels use a small uppercase muted heading style consistent with the desert theme (e.g., `text-xs uppercase tracking-wide text-desert-brown-muted`).

### Session Titles
- **D-08:** Keep the current approach: first 50 chars of the first user message, appended with `…` if truncated. No change needed — it's already working.

### Responsive Toggle
- **D-09:** The "History" / hamburger toggle button in the `HeaderBar` is hidden on desktop (`lg:hidden`) since the sidebar is always visible there. On mobile it remains visible to open the drawer.
- **D-10:** On desktop, there is no close button inside the sidebar (no need — it's always open). On mobile the close (×) button inside the panel header remains.

### Claude's Discretion
- Visual details (padding, font sizes, hover states, empty state copy) — stay consistent with Phase 7 polish level (ChatGPT/Claude/Gemini reference). No user-specified constraints beyond "ChatGPT-like."

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Component — HistoryPanel
- `libs/ui/src/lib/history-panel/history-panel.ts` — component class (inputs, outputs, formatDate logic)
- `libs/ui/src/lib/history-panel/history-panel.html` — current template (fixed positioning, translate classes, backdrop)

### Existing Wiring — ChatComponent
- `apps/frontend/src/app/chat/chat.ts` — ChatComponent (historyOpen state, switchToSession, deleteSession, newChat)
- `apps/frontend/src/app/chat/chat.html` — current layout (history-panel as overlay before main content)

### Data Layer
- `apps/frontend/src/app/chat/history.service.ts` — HistoryService (localStorage CRUD, already complete)
- `libs/shared-types/src/lib/chat.types.ts` — ConversationSession type (id, title, messages, createdAt)

### Theme & Design Reference
- `.planning/phases/07-visual-overhaul/07-CONTEXT.md` — design references (ChatGPT/Claude/Gemini polish level, desert palette constraints)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HistoryPanel` (`libs/ui/src/lib/history-panel/`): already styled, has session list, delete, active state, empty state, new-chat button. Needs: date-grouping logic, responsive layout behavior (persistent vs. drawer).
- `HistoryService`: complete — no changes needed.
- `ConversationSession`: complete — no changes needed.
- `HeaderBar`: already emits `(historyToggled)` — only needs `lg:hidden` applied to its toggle button.

### Established Patterns
- Tailwind responsive prefix (`lg:`) for breakpoint-based layout — use it to switch sidebar between overlay and persistent column.
- `NgClass` already imported in `HistoryPanel` — usable for conditional classes.
- OnPush + `ChangeDetectorRef` pattern is in `ChatComponent` — no deviation.
- `@for … @empty` block already in history-panel template — extend with `@for` over grouped sections.

### Integration Points
- `chat.html` outer wrapper changes from `flex flex-col h-screen` to `flex flex-row h-screen` — the sidebar and main chat area become siblings.
- `HistoryPanel` on desktop: remove `fixed` positioning, become a normal flex column child (`hidden lg:flex`). On mobile the `fixed` overlay behavior is preserved via a separate mobile-only wrapper or conditional classes.
- `historyOpen` in `ChatComponent` continues to control mobile drawer state. On desktop it's irrelevant (sidebar always shown).

</code_context>

<specifics>
## Specific Ideas

- Reference: ChatGPT desktop sidebar — always visible ~260px left panel, date-grouped session list, "New chat" button at top.
- The date grouping logic belongs in `HistoryPanel` (pure computed transform of the `sessions` input — no service changes).
- On desktop, the backdrop `div` (currently `fixed inset-0 bg-black/40`) should not render at all — `lg:hidden` on that element.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 8-chat-history-sidebar*
*Context gathered: 2026-05-22*
