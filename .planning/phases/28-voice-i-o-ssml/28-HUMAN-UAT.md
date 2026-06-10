---
status: passed
phase: 28-voice-i-o-ssml
source: [28-VERIFICATION.md]
started: 2026-06-01T00:00:00Z
updated: 2026-06-11T00:00:00Z
---

## Current Test

Human UAT complete.

## Tests

### 1. Audio smoke test per dino
expected: Hovering an assistant message and clicking the speaker button produces audible speech in the active dino's voice character (distinct rate/pitch per dino). The global "Dino is speaking…" header indicator appears, and the Stop button halts speech immediately.
result: passed

### 2. SSML honesty
expected: The browser never speaks raw SSML/XML markup literally — `SsmlHint` is mapped to utterance rate/pitch/volume and `<speak>`-style tags are not read aloud.
result: passed

### 3. Chrome live dictation (VOX-03)
expected: In Chrome, tapping the mic button prompts for permission, then interim transcription populates the composer draft live; the pulse ring shows while listening; on final result the mic returns to idle; nothing auto-submits (user reviews and sends); transcript is capped at 10,000 chars.
result: passed

### 4. Firefox graceful absence
expected: In Firefox (no SpeechRecognition), the mic button is not rendered at all and the composer works normally — no broken/disabled state.
result: passed

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
