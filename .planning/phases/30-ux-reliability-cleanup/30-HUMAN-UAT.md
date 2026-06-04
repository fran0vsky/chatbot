---
status: partial
phase: 30-ux-reliability-cleanup
source: [30-VERIFICATION.md]
started: 2026-06-04T17:05:00Z
updated: 2026-06-04T17:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. No stale-message flash on chat switch (REL-01)
expected: Create two chats with distinct messages, then switch back and forth. No frame of the previous thread's messages appears — only the animate-pulse skeleton placeholder, then the target thread's content. The empty-state hero and sending/streaming are unaffected.
result: [pending]

### 2. Composer layout under huge / unbroken text (REL-02)
expected: (a) Multi-paragraph paste caps at ~8 rows with internal scroll, pill intact; (b) a 500-char unbroken string wraps without pushing the send button off-layout; (c) a suggestion-prompt / dictation fill resizes the textarea immediately; (d) normal short messages and send/stop are unaffected.
result: [pending]

### 3. No dead Explore navigation (REL-04)
expected: No Explore nav entry or view renders anywhere. Chats / Knowledge / Group chat / Arena / Leaderboard all navigate correctly. The dino gallery is reachable via "New chat" / picker modal. No console errors.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
