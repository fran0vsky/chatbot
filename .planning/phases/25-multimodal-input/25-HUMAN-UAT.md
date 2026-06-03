---
status: pending
phase: 25-multimodal-input
source: [25-01-SUMMARY.md]
started: "2026-06-04T00:00:00Z"
updated: "2026-06-04T00:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Attach + vision reasoning (VIS-01, VIS-02)
expected: With the backend running (local `.env` → `spinochat_dev`) and `OPENROUTER_API_KEY` set: start a chat with Iris (Troodon). Click the attach button OR paste a screenshot into the composer → a thumbnail preview appears with a remove (×) button. Send with a question like "what's in this image?" → the user bubble shows the image inline and Iris describes it accurately.
result: [pending]

### 2. OCR (VIS-03)
expected: Attach a screenshot containing text and ask "extract the text". Iris reproduces the visible text accurately (preserving order/line breaks), not a paraphrase.
result: [pending]

### 3. Image-only send + paste
expected: Pasting an image with no typed text still enables the send button and produces a response. Pasting plain text still types normally (no interference).

result: [pending]

### 4. Graceful degradation (VIS-04)
expected: If the free vision model is rate-limited (429) or slow (>20s), the turn still completes via the paid `gpt-4o-mini` fallback rather than erroring. Oversized (>5 MB) or non-image files are rejected with a friendly message and not sent.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
