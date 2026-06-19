---
status: partial
phase: 42-custom-dino-creator
source: [42-VERIFICATION.md]
started: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CDINO-01: End-to-end custom dino creation

expected: Click the "Create a dino" tile in the dino picker, fill in name + description + reaction prompt + model + tools + optional avatar image, click Save. The new dino appears in the picker with its name and avatar. It persists across page reload.
result: [pending]

### 2. CDINO-02: Custom dino persona in chat

expected: Open a chat with the newly created custom dino. The dino replies in its authored persona (the system prompt written at creation). Only the tools selected at creation time are invokable — unchecked tools do nothing.
result: [pending]

### 3. CDINO-03: Edit and delete a custom dino

expected: Click Edit on a custom dino card — form pre-fills with name/description/model/tools. Change the name and save — updated name appears in picker and persists after reload. Click Del, confirm the dialog — dino disappears from picker permanently without a page refresh.
result: [pending]

### 4. CDINO-04: Custom dino in group chat

expected: In group-chat mode, select the custom dino alongside built-in dinos. The custom dino takes turns and its replies reflect its authored persona. The Phase 41 engine drives turn order.
result: [pending]

### 5. Degraded path: AVATAR_BUCKET unset

expected: With AVATAR_BUCKET env var absent, an avatar upload attempt in the creator form returns a clear "avatar upload is not configured" error (HTTP 400) surfaced inline. The form's other fields (name, prompt, model, tools) remain usable. Backend does not crash.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
