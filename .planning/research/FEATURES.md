# Features Research

**Domain:** Bubble chat UI — Angular 21 SPA, Tailwind CSS
**Researched:** 2026-05-17
**Overall confidence:** HIGH (Angular 21 patterns drawn from stable framework docs; Tailwind patterns from well-established community conventions)

---

## Table Stakes (must have)

These are the minimum features for the chat UI to feel like a real chatbot. Missing any of them and users will notice immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Message list with bubbles | Core chat metaphor; every chat app has it | Low | User right, assistant left |
| Text input with send button | Primary interaction surface | Low | Button + Enter key both submit |
| Auto-scroll to latest message | Without it, users hunt for new content | Low | `scrollIntoView` after each push |
| Typing / loading indicator | Without it, silence feels like an error | Low | Animated dots or spinner in a ghost bubble |
| Disabled input while loading | Prevents double-submit | Low | `[disabled]="isLoading()"` on input + button |
| Error state display | API failures must surface to the user | Low | Inline error message beneath the list or in a bubble |
| Enter key submits | Universal expectation in chat inputs | Low | `(keydown.enter)` with `$event.preventDefault()` |
| Accessible labels | Screen reader support | Low | `aria-label` on input + button; role="log" on list |

---

## Differentiators (nice to have)

Features that improve UX but are not expected at MVP stage. Defer all of these until table stakes are solid.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Streaming response (token-by-token) | Feels faster; reduces perceived latency | High | Requires SSE or WebSocket on backend; out of scope Task 1 |
| Markdown rendering in assistant bubbles | Code blocks, bold, lists render nicely | Medium | `ngx-markdown` or `marked` + DOMPurify |
| Copy-to-clipboard on bubble | Quick message extraction | Low | Can add later with a hover button |
| Auto-resize textarea | Long inputs don't overflow | Low | CSS `field-sizing: content` or JS resize observer |
| Timestamp per message | Conversational context | Low | Simple `Date.now()` stored on the message model |
| Smooth scroll animation | Polished feel | Low | `behavior: 'smooth'` on `scrollIntoView` |
| Empty state / welcome screen | Guides first-time users | Low | Replace list with a prompt when messages = 0 |

---

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| NgRx / complex state management | Overkill for a single conversation array | Plain signal array in a `ChatService` |
| Angular CDK `ScrollingModule` (virtual scroll) | Designed for huge lists; adds complexity | Direct `ViewChild` + `scrollIntoView` |
| Inline styles on bubbles | Violates project conventions (Tailwind-only) | Tailwind utility classes via `[ngClass]` or `class` binding |
| Eager markdown parsing | Adds bundle size + XSS risk before it's needed | Defer until differentiators phase |
| iframe sandboxed response rendering | Extreme complexity, no benefit at text-only stage | Plain text interpolation is safe |

---

## Angular Chat UI Patterns

### Component structure

Three-component split is the right granularity for this project size. No more, no less.

```
app-chat-page            ← routed page component; owns message state + HTTP call
  app-message-list       ← renders scrollable list; owns ViewChild scroll anchor
    app-message-bubble   ← purely presentational; @Input() role + text
  app-chat-input         ← input bar; emits (send) EventEmitter<string>
```

**Why this split:**

- `chat-page` is the single source of truth for `messages` signal and `isLoading` signal. It calls `ChatService.send()` and appends results.
- `message-list` is isolated so it can own its own `ViewChild` scroll anchor without coupling to page logic.
- `message-bubble` is a pure presentational component — it just receives `role: 'user' | 'assistant'` and `text: string`. No logic, easy to test.
- `chat-input` emits a `(send)` event and manages its own local input string. The page listens and calls the service.

**Confidence:** HIGH — this is the idiomatic Angular standalone component decomposition for a chat UI.

All components must be standalone (enforced by ESLint `@angular-eslint/prefer-standalone: error`) with `changeDetection: ChangeDetectionStrategy.OnPush`.

A `ChatService` (injectable in root) holds the `messages` signal array and the `isLoading` signal, and issues the `HttpClient` POST. The page injects the service and reads from its signals — no prop drilling needed.

---

### Message model

Define this interface in `apps/frontend/src/app/chat/` (not in `shared-types`, which is for cross-app contracts):

```typescript
export interface Message {
  id: string;          // crypto.randomUUID() — needed for @for trackBy
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;   // Date.now() — defer rendering, but cheap to store
}
```

The `threadId` for the backend comes from `ChatRequest.threadId?`. Generate once on session start with `crypto.randomUUID()` and hold it in `ChatService`. Pass it on every request so `MemorySaver` on the backend can maintain context across turns.

---

### Auto-scroll

**Verdict: `ViewChild` + `scrollIntoView` — not CDK ScrollingModule.**

CDK `ScrollingModule` (`CdkVirtualScrollViewport`) is designed for virtualizing lists of thousands of items. A chat conversation with dozens of messages has no need for it. It adds complexity and its scroll-to-bottom API is more cumbersome than plain DOM.

**Pattern (inside `message-list` component):**

```typescript
// message-list.ts
@Component({
  selector: 'app-message-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 overflow-y-auto h-full px-4 py-3">
      @for (msg of messages(); track msg.id) {
        <app-message-bubble [message]="msg" />
      }
      <div #scrollAnchor></div>
    </div>
  `
})
export class MessageList {
  messages = input.required<Message[]>();
  private scrollAnchor = viewChild.required<ElementRef>('scrollAnchor');

  constructor() {
    // React to signal changes; AfterRenderPhase ensures DOM is updated
    afterRender(() => {
      this.scrollAnchor().nativeElement.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
```

**Why `afterRender`:** In Angular 17+ the `afterRender` / `afterNextRender` lifecycle hooks are the recommended way to do DOM reads/writes after signal-driven rendering. `AfterViewChecked` works but fires on every CD cycle even when unrelated things change. `afterRender` is cleaner and correctly scoped to the render pipeline.

**Alternative that also works:** `effect(() => { /* read messages signal */ }, { ... })` combined with `afterNextRender` inside. But the `afterRender` approach above is simpler and sufficient.

**Confidence:** HIGH — `afterRender` was introduced in Angular 17 and is stable in Angular 21.

---

### Loading state

The loading/typing indicator should appear as a "ghost" assistant bubble at the bottom of the list while `isLoading()` is true.

**Pattern:**

```html
<!-- inside message-list template -->
@if (isLoading()) {
  <div class="flex items-start gap-2">
    <div class="bg-gray-200 text-gray-500 rounded-2xl rounded-tl-none px-4 py-3 text-sm max-w-xs">
      <span class="inline-flex gap-1">
        <span class="animate-bounce">.</span>
        <span class="animate-bounce [animation-delay:150ms]">.</span>
        <span class="animate-bounce [animation-delay:300ms]">.</span>
      </span>
    </div>
  </div>
}
```

The three bouncing dots use Tailwind's `animate-bounce` utility with staggered `animation-delay` via an arbitrary value. This is pure Tailwind — no custom CSS needed.

**State machine in `ChatService`:**

```typescript
isLoading = signal(false);
messages = signal<Message[]>([]);

send(text: string, threadId: string): void {
  // append user message immediately
  this.messages.update(msgs => [...msgs, { id: uuid(), role: 'user', text, createdAt: Date.now() }]);
  this.isLoading.set(true);

  this.http.post<ChatResponse>('/api/agents/chat', { message: text, threadId } satisfies ChatRequest)
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe({
      next: res => this.messages.update(msgs => [...msgs, { id: uuid(), role: 'assistant', text: res.response, createdAt: Date.now() }]),
      error: () => this.messages.update(msgs => [...msgs, { id: uuid(), role: 'assistant', text: 'Something went wrong. Please try again.', createdAt: Date.now() }])
    });
}
```

`finalize` ensures `isLoading` is cleared on both success and error paths — avoids forgetting to clear it in the error handler.

**Confidence:** HIGH — `signal`, `finalize`, and the `satisfies` operator are all stable in this stack.

---

### Message state management

**Verdict: `ChatService` with Angular signals — no NgRx.**

The conversation state for a single chat page is simple enough to live in a service. NgRx would add `actions`, `reducers`, `selectors`, `effects` — that is substantial ceremony for an array of message objects and a boolean loading flag.

**Structure:**

```
apps/frontend/src/app/chat/
  chat.service.ts          ← signals: messages, isLoading, threadId; send() method
  chat-page.ts             ← injects ChatService; passes signals to children
  chat-page.html
  message-list/
    message-list.ts        ← input: messages, isLoading; handles scroll
    message-list.html
  message-bubble/
    message-bubble.ts      ← input: message (Message); purely presentational
    message-bubble.html
  chat-input/
    chat-input.ts          ← local inputText signal; emits (send) output
    chat-input.html
  chat.types.ts            ← Message interface
```

`ChatService` is `providedIn: 'root'`. Since there is only one chat page and no need for multiple instances, root scope is fine and avoids needing to provide it in the component.

**Why not `inject(HttpClient)` directly in the component:** Keeping HTTP in a service keeps components testable and matches the NestJS conventions in this project (separation of concerns is a stated convention).

**Confidence:** HIGH — this is the standard Angular 17+ pattern for application-level state without a state management library.

---

## Tailwind Styling Patterns

### Page layout

The chat page must fill the viewport height with the input bar pinned at the bottom. The standard approach:

```html
<!-- chat-page.html -->
<div class="flex flex-col h-screen bg-gray-50">
  <header class="shrink-0 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
    <h1 class="text-lg font-semibold text-gray-800">Chat</h1>
  </header>

  <main class="flex-1 overflow-hidden">
    <app-message-list [messages]="chatService.messages()" [isLoading]="chatService.isLoading()" />
  </main>

  <footer class="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
    <app-chat-input (send)="onSend($event)" [disabled]="chatService.isLoading()" />
  </footer>
</div>
```

`h-screen` + `flex flex-col` locks the outer container to the viewport. `flex-1 overflow-hidden` on the message area lets it grow and enables its own internal scroll. `shrink-0` on header/footer prevents them from being squeezed.

### User vs assistant bubble distinction

The key visual language: user bubbles on the right in a brand color, assistant bubbles on the left in a neutral gray.

```html
<!-- message-bubble.html -->
<div
  class="flex w-full"
  [class.justify-end]="message().role === 'user'"
  [class.justify-start]="message().role === 'assistant'"
>
  <div
    class="max-w-[75%] px-4 py-2.5 text-sm leading-relaxed"
    [class]="message().role === 'user'
      ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none'
      : 'bg-gray-200 text-gray-800 rounded-2xl rounded-tl-none'"
  >
    {{ message().text }}
  </div>
</div>
```

**Bubble shape convention:** `rounded-2xl` on all corners, then remove the corner that touches the "tail" direction. User (right-aligned): remove `rounded-tr-none`. Assistant (left-aligned): remove `rounded-tl-none`. This is the universally recognized chat bubble shape.

**Width cap:** `max-w-[75%]` keeps bubbles from spanning the full container width on wide screens, which reads poorly. A fixed `max-w-xs` or `max-w-sm` also works for a narrow chat panel.

**Note on `[class]` binding:** When using a conditional expression that produces a full class string, Angular's `[class]` binding correctly replaces/merges classes. For OnPush components this is fine — the binding updates only when the input signal reference changes.

### Input bar

```html
<!-- chat-input.html -->
<form class="flex gap-2 items-end" (ngSubmit)="submit()">
  <input
    type="text"
    [(ngModel)]="inputText"
    placeholder="Type a message…"
    aria-label="Message input"
    [disabled]="disabled()"
    (keydown.enter)="$event.preventDefault(); submit()"
    class="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm
           focus:outline-none focus:ring-2 focus:ring-blue-500
           disabled:opacity-50 disabled:cursor-not-allowed"
  />
  <button
    type="submit"
    [disabled]="disabled() || !inputText.trim()"
    aria-label="Send message"
    class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
           hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
           disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Send
  </button>
</form>
```

`(keydown.enter)` is Angular's built-in key event binding. `$event.preventDefault()` prevents a newline being inserted in case the input is later changed to a textarea. The `disabled:` variant class handles both the loading state and the empty-input guard.

**Note:** `[(ngModel)]` requires importing `FormsModule` in the standalone component's `imports` array. Alternatively use a reactive `signal` for the input value and bind `[value]` + `(input)` to avoid `FormsModule` as a dependency — the signal approach fits better with the OnPush + signals convention of this project.

### Scrollable message list

```html
<!-- message-list.html -->
<div class="flex flex-col gap-3 overflow-y-auto h-full px-4 py-4">
  @for (msg of messages(); track msg.id) {
    <app-message-bubble [message]="msg" />
  }
  @if (isLoading()) {
    <!-- typing indicator bubble (see above) -->
  }
  <div #scrollAnchor class="h-0 w-0"></div>
</div>
```

`overflow-y-auto` on the list container (not the page) keeps the scroll area contained. `h-full` works here because the parent has `overflow-hidden` which gives the list a definite height to fill.

---

## Accessibility Basics

| Requirement | Implementation |
|-------------|----------------|
| Message list is a live region | `role="log" aria-live="polite"` on the list container |
| Input has a label | `aria-label="Message input"` on the `<input>` |
| Send button has a label | `aria-label="Send message"` on the `<button>` |
| Keyboard submit | `(keydown.enter)` on input; `type="submit"` on button inside `<form>` |
| Disabled states announced | `[disabled]` binding ensures `aria-disabled` is set by the browser |
| Focus management | After send, refocus the input: `this.inputRef.nativeElement.focus()` in `chat-input` after emit |

The `role="log"` on the message list tells screen readers this is an append-only log region. `aria-live="polite"` announces new messages without interrupting the user.

**Confidence:** MEDIUM — `role="log"` is a standard ARIA live region pattern; the `aria-live` behavior is well-documented in ARIA spec. Exact Angular binding mechanics are HIGH confidence.

---

## Feature Dependencies

```
Message state (ChatService.messages signal)
  → Message list rendering (@for loop)
  → Auto-scroll (afterRender reads signal change)
  → Typing indicator (isLoading signal gates @if)

Chat input submit
  → Disables input (isLoading signal)
  → Appends user message (service.send)
  → Triggers HTTP call (service.send)
  → Appends assistant message or error message on response
```

---

## MVP Recommendation

Build in this order within Task 1:

1. `ChatService` with `messages` signal, `isLoading` signal, `threadId`, and `send()` method — this is the foundation everything else reads from.
2. `message-bubble` component — purely presentational, no dependencies, easy to visually verify in isolation.
3. `message-list` component — wires up the bubble list and scroll anchor.
4. `chat-input` component — input bar with submit logic.
5. `chat-page` component — assembles all three, injects `ChatService`, routes to `/` (replace the empty `appRoutes`).
6. Wire `app-root` to render `app-chat-page` directly (no router-outlet needed if chat is the only page at this stage).

**Defer:** Markdown rendering, streaming, timestamps, copy button — none of these are required for CHAT-01 through CHAT-04.

---

## Sources

- Angular official docs (component architecture, signals, `afterRender`, `viewChild` function): https://angular.dev/guide/components — HIGH confidence
- Angular `afterRender` / `afterNextRender` API: https://angular.dev/api/core/afterRender — HIGH confidence
- ARIA `role="log"` live region: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/log_role — MEDIUM confidence
- Tailwind CSS utility docs (animate-bounce, rounded-*, disabled:): https://tailwindcss.com/docs — HIGH confidence
- Project conventions: `.planning/codebase/CONVENTIONS.md` — HIGH confidence (first-party)
- Project requirements: `.planning/PROJECT.md` — HIGH confidence (first-party)
