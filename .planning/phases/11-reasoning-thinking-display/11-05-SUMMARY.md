# Plan 11-05 Summary — Compose ReasoningBlock + Add R1 Model

## Status: Complete

## What was built

1. **MessageBubble wired** — `ReasoningBlock` imported (relative sibling path) and added to `imports` array. Inside the assistant branch `<div>`, an `@if (message.reasoning)` guard renders `<app-reasoning-block [reasoning]="message.reasoning ?? ''" [streaming]="false" [durationMs]="message.reasoningDurationMs" [autoCollapsed]="true">` immediately before the `<markdown>` element. Tool/error/user branches unchanged.

2. **WithReasoning story added** — `message-bubble.stories.ts` gains `export const WithReasoning: Story` with a multi-line reasoning field and `reasoningDurationMs: 4200`. Demonstrates collapsed default for the persisted-message view.

3. **DeepSeek R1 added to model selector** — `chat.ts` `models` array gets `{ id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free, reasoning)' }` as the last entry. Default `selectedModel = 'openai/gpt-4o-mini'` unchanged.

4. **Streaming reasoning block in chat.html** — the streaming section's condition expanded from `@if (streamingText().length > 0)` to `@if (streamingText().length > 0 || streamingReasoning().length > 0)`. Inside that container: an `@if (streamingReasoning().length > 0)` guard renders the live `<app-reasoning-block [reasoning]="streamingReasoning()" [streaming]="true" [autoCollapsed]="reasoningCollapsed()">` ABOVE the streaming `app-message-bubble`. This handles: reasoning-only phase, collapsed-reasoning + text phase, text-only (non-reasoning model) phase.

5. **ReasoningBlock import in ChatComponent** was already added in 11-04 — confirmed in `imports` array.

## Key files modified

- `libs/ui/src/lib/message-bubble/message-bubble.ts` — ReasoningBlock added to imports
- `libs/ui/src/lib/message-bubble/message-bubble.html` — ReasoningBlock in assistant branch
- `libs/ui/src/lib/message-bubble/message-bubble.stories.ts` — WithReasoning story added
- `apps/frontend/src/app/chat/chat.ts` — DeepSeek R1 model entry
- `apps/frontend/src/app/chat/chat.html` — streaming reasoning block

## Deviations

- **Nx unavailable**: same environment constraint. TypeScript gate runs clean via `tsc --noEmit`.
- Expanded streaming condition (`|| streamingReasoning().length > 0`) to handle the reasoning-only-streaming phase before any text arrives — this ensures the reasoning block appears live as reasoning streams, not only after the first text token.

## Self-Check: PASSED

Frontend TypeScript clean. End-to-end UX functional: user selects DeepSeek R1 → reasoning streams in live block → collapses on first content token (handled by 11-04 signal logic) → final assistant message shows collapsed reasoning block above answer → persists across sidebar navigation.
