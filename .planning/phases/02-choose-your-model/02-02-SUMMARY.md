# Plan 02-02 Summary — Frontend Model Selector

**Status:** Complete
**Date:** 2026-05-20

## What was done

### Task 1 — ChatService.sendMessage() updated to forward model
`apps/frontend/src/app/chat/chat.service.ts` updated:
```ts
sendMessage(message: string, model?: string): Observable<ChatResponse> {
  const body: ChatRequest = { message, threadId: this.threadId, model };
  ...
}
```
When `model` is undefined the field is `undefined` in the body — the backend falls back to `gpt-4o-mini` (D-11).

### Task 2 — selectedModel state added to ChatComponent
`apps/frontend/src/app/chat/chat.ts` additions:
```ts
selectedModel = 'openai/gpt-4o-mini';
readonly models = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
] as const;
```
Plain class property (matching `isLoading = false` pattern — component uses OnPush + ChangeDetectorRef, not signals).

`sendMessage` call updated to pass `this.selectedModel`:
```ts
this.chatService.sendMessage(text, this.selectedModel).subscribe({ ... })
```

### Task 3 — Native <select> added to chat header
`apps/frontend/src/app/chat/chat.html` header updated:
- Added `flex justify-between items-center` to header classes
- "Chatbot" `<h1>` stays on the left (D-05)
- Native `<select>` added on the right with `@for` control flow (matching template style)
- `[value]="selectedModel"` + `(change)="selectedModel = $any($event.target).value"`
- `[disabled]="isLoading"` with `disabled:opacity-50 disabled:cursor-not-allowed` Tailwind classes
- No `<label>` (D-06), Tailwind-only styling (D-04), 2 options (D-01, D-02)

## Verification

**TypeScript (tsc --noEmit):** clean on `apps/frontend`

**Grep gates (all pass):**
- `grep -c 'selectedModel' apps/frontend/src/app/chat/chat.ts` → 2
- `grep -c 'model' apps/frontend/src/app/chat/chat.service.ts` → 2
- `grep -c '<select' apps/frontend/src/app/chat/chat.html` → 1

## Implementation notes
- Used plain properties (not signals) to match the existing `isLoading` pattern — consistent with OnPush + ChangeDetectorRef.detectChanges() approach
- `@for` control flow used in template (matching existing `@for` / `@if` style in the file)
- No FormsModule change needed — `(change)` event binding requires no form module

## Phase 2 success criteria
- SC-1: `<select>` visible in header right side with 2 model options ✓
- SC-2: Selecting Claude 3 Haiku sends `model: "anthropic/claude-3-haiku"` in request body ✓
- SC-3: Selection persists within session (plain property, not reset between sends); refreshing page resets to `gpt-4o-mini` default ✓
- D-03: Default on load is `openai/gpt-4o-mini` ✓
- D-07: `<select>` disabled while `isLoading` is true ✓
- MODEL-01 (frontend half): complete ✓
