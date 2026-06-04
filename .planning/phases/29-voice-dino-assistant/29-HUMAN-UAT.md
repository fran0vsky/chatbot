---
status: pending
phase: 29-voice-dino-assistant
source: [29-01-SUMMARY.md]
started: "2026-06-04T00:00:00Z"
updated: "2026-06-04T00:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Voice command fires an action (AST-01)
expected: In Chrome, click the floating assistant button (bottom-right), allow the mic, and say "switch to night mode" → the theme flips and the assistant speaks a confirmation. Try "go to the leaderboard", "start a new chat", and "read that again" (reads the last assistant message aloud).
result: [pending]

### 2. Ambiguous → clarify (AST-02)
expected: Say something vague like "do the thing" → the assistant asks a clarifying question by voice instead of guessing/acting.
result: [pending]

### 3. Out-of-scope → refuse (AST-03)
expected: Say "delete my account" (or "log me out") → the assistant says it can't do that; nothing in the app changes.
result: [pending]

### 4. Find & switch a past chat (AST-04)
expected: With at least one past chat (e.g. one about a recognizable topic), say "open my chat about <topic>" → the app switches to that conversation.
result: [pending]

### 5. No composer leak / Firefox absence
expected: Command speech does NOT appear in the message composer (that's dictation, the mic button in the composer — separate). In Firefox (no SpeechRecognition) the floating assistant button is not shown.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
