---
status: pending
phase: 26-image-generation
source: [26-01-SUMMARY.md]
started: "2026-06-04T00:00:00Z"
updated: "2026-06-04T00:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Generate an image (IMG-01)
expected: With the backend running and `OPENROUTER_API_KEY` set, start a chat with Vinci (Parasaurolophus). Type a prompt like "a pixel-art volcano at sunset" and send. After a few seconds an image appears inline in Vinci's reply (with a short caption). Each generation costs ~$0.04.
result: [pending]

### 2. Inline render + download (IMG-02)
expected: The generated image renders inside the assistant bubble at a reasonable size; a "Download" link below it saves the PNG to disk.
result: [pending]

### 3. Persists in history
expected: Switching away and back to the chat (or reload) still shows the generated image in the conversation — it is stored on the message, not just transient.
result: [pending]

### 4. Graceful error
expected: If the image model errors or times out (>45s), the chat shows a friendly error message rather than hanging or crashing. A normal text dino is unaffected.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
