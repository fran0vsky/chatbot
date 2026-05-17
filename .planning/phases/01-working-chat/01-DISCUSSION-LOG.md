# Phase 1: Working Chat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 1-Working Chat
**Areas discussed:** Component structure, Error handling UX, Input area style, Page layout container

---

## Component Structure

### Where should the chat UI live?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated app-chat + app-message-bubble | App stays minimal; separate components for chat container and each message bubble | ✓ |
| Just app-chat (no bubble component) | App hosts app-chat; messages rendered inline with *ngFor | |
| Everything in App | Root App component holds all chat logic | |

**User's choice:** Dedicated app-chat + app-message-bubble

---

### Where should HTTP calls live?

| Option | Description | Selected |
|--------|-------------|----------|
| ChatService (injectable) | Dedicated service with sendMessage() method; reusable in Phase 2 | ✓ |
| Directly in app-chat component | Component injects HttpClient and calls API inline | |

**User's choice:** ChatService

---

## Error Handling UX

### What should the user see when the API call fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error bubble | Error appears as a chat bubble after the failed message | ✓ |
| Error text below input | Small red text under the input field | |
| Silent re-enable | Input re-enabled with no visual feedback | |

**User's choice:** Inline error bubble

---

### Should the error bubble include a retry button?

| Option | Description | Selected |
|--------|-------------|----------|
| No retry button — just re-enable input | User retypes; simpler implementation | ✓ |
| Retry button in the bubble | Re-sends last message automatically; requires storing last message | |

**User's choice:** No retry button

---

### Generic or specific error messages?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic user-friendly message | "Something went wrong. Please try again." — no technical details | ✓ |
| Show HTTP status in the bubble | "Error 503: Service temporarily unavailable." | |

**User's choice:** Generic user-friendly message

---

### Keep the failed user message or remove it?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the user message, add error bubble below | Standard chat pattern (WhatsApp, Slack) | ✓ |
| Remove the failed message | Pre-fill input with original text for re-send | |

**User's choice:** Keep message, add error bubble below

---

### Should error bubbles be visually distinct from assistant messages?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — red/orange tint + warning icon | bg-red-50 border-red-200 text-red-700 styling | ✓ |
| Same style as assistant messages | Error text alone distinguishes it | |

**User's choice:** Visually distinct with red/orange tint

---

## Input Area Style

### What type of input element?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-expanding textarea | Starts 1 line, grows up to ~5 lines | ✓ |
| Fixed single-line input | Always one line, horizontal scroll for long text | |

**User's choice:** Auto-expanding textarea

---

### How should the user submit?

| Option | Description | Selected |
|--------|-------------|----------|
| Enter to send, Shift+Enter for new line | Standard chatbot behavior (ChatGPT, Claude.ai) | ✓ |
| Send button only | Click/tap only | |
| Enter or button (both equal) | No new-line capability | |

**User's choice:** Enter to send, Shift+Enter for new line

---

### Disable input while loading?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — disable while assistant is responding | Prevents double-send; input + button grayed out | ✓ |
| No — keep input enabled | Allow typing next message while waiting | |

**User's choice:** Disable input while loading

---

### Send button appearance?

| Option | Description | Selected |
|--------|-------------|----------|
| Icon only (arrow/paper-plane SVG) | Compact, standard for chat UIs | ✓ |
| Text "Send" | Explicit but takes more space | |
| Icon + "Send" text | Most accessible, most space-consuming | |

**User's choice:** Icon only

---

### Textarea placeholder text?

| Option | Description | Selected |
|--------|-------------|----------|
| "Message" | Short, clean (like Claude.ai) | ✓ |
| "Type a message..." | More descriptive | |
| "Ask me anything..." | Friendlier, chatbot-focused | |

**User's choice:** "Message"

---

## Page Layout Container

### How should the chat fill the browser window?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-viewport | Chat fills entire browser window; input pinned at bottom | ✓ |
| Centered card/panel | Max-width container, background outside it | |

**User's choice:** Full-viewport

---

### Should there be a visible header?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — simple header with app name | Top bar; natural home for Phase 2 model selector | ✓ |
| No header | More message space; no obvious place for Phase 2 additions | |

**User's choice:** Yes, header with app name

---

### Color scheme?

| Option | Description | Selected |
|--------|-------------|----------|
| Light (white/light gray) | Clean, standard for web chat | |
| Dark | Easier on eyes in low light | |
| You decide | Claude picks a clean neutral light theme | ✓ |

**User's choice:** You decide (Claude's discretion)

---

### Message bubble max-width?

| Option | Description | Selected |
|--------|-------------|----------|
| Max width ~75% | Bubbles cap and align to their side | ✓ |
| Full width | Bubbles fill the entire message area | |

**User's choice:** Max width ~75%

---

### Visual separator between messages and input?

| Option | Description | Selected |
|--------|-------------|----------|
| Border/divider line | Subtle horizontal border | ✓ |
| Shadow on input bar | Box-shadow creates depth without a hard line | |
| You decide | Claude picks whichever looks clean | |

**User's choice:** Border/divider line

---

## Claude's Discretion

- **Color scheme:** Claude picks a clean neutral light theme using Tailwind defaults (white/light-gray backgrounds, appropriate text contrast)

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
