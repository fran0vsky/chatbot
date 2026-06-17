---
phase: 40-skill-recall-cadence
plan: "02"
subsystem: frontend-chat-component
tags: [skill-recall, streaming, signals, knowledge-surface, OnPush]
dependency_graph:
  requires: [StreamSkillActiveEvent, selectRelevantSkill, skill_active-emission]
  provides: [activeSkill-signal, skill-hint-ui]
  affects: [apps/frontend/src/app/chat/chat.ts, apps/frontend/src/app/chat/chat.html]
tech_stack:
  added: []
  patterns: [signal-per-event-type, OnPush-markForCheck, Tailwind-only-hint]
key_files:
  created: []
  modified:
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html
decisions:
  - "D-01: activeSkill signal typed { id: string; title: string } | null — null means no skill selected (no hint rendered)"
  - "D-02: Hint placed in Knowledge view Skills section below <app-skill-manager> — unobtrusive, consistent location with the skills data"
  - "D-03: Hint uses jungle-ink-muted for label + jungle-accent for the skill title — matches surrounding muted text tokens"
  - "D-04: Reset in both startNewChat and switchToSession — covers new conversation + session switch lifecycle points (T-40-02-02 mitigated)"
metrics:
  duration_minutes: 15
  completed_date: "2026-06-17"
  tasks_completed: 2
  files_changed: 2
---

# Phase 40 Plan 02: Skill Recall Cadence (Frontend UI Hint) Summary

**One-liner:** activeSkill signal consuming skill_active SSE event renders a small, read-only active-skill hint in the Knowledge Skills section; cleared on new conversation and session switch.

## What Was Built

1. **activeSkill signal** — new `readonly activeSkill = signal<{ id: string; title: string } | null>(null)` declared alongside streaming signals in `chat.ts`. Null when no skill was selected this conversation.

2. **case 'skill_active' in handleStreamEvent** — mirrors the `reasoning_token`/`image` pattern: sets the signal from `event.skillId`/`event.skillTitle`, calls `this.cdr.markForCheck()`, and returns. No change to any other case.

3. **Reset on session change** — `activeSkill.set(null)` added to both `startNewChat()` and `switchToSession()`. Ensures a stale skill from a prior thread is never shown for a new chat (T-40-02-02 mitigated).

4. **UI hint in chat.html** — `@if (activeSkill())` block below `<app-skill-manager>` in the Knowledge Skills section. Shows "Active skill this chat: <title>" with `text-xs text-jungle-ink-muted dark:text-jungle-night-muted` label and `text-jungle-accent dark:text-jungle-night-accent font-medium` accent on the title. Tailwind only; no inline styles; no edit/delete affordance (read-only).

## Task 3: HUMAN-UAT (Pending)

**Task 3 — End-to-end UAT — one skill per conversation, observable** is a `type="manual"` task that requires a live environment and was not executed by this agent.

**Steps required:**
- Run backend + frontend locally with `DATABASE_URL` + `OPENROUTER_API_KEY` set
- Teach a dino 2-3 distinct skills with clear `when_to_activate` triggers
- Start a conversation matching ONE skill's trigger — confirm: (a) hint names that skill, (b) backend log shows the same skill selected, (c) subsequent turns in the same thread keep the same skill
- Start a fresh conversation with no matching skill — confirm no hint appears, nothing skill-related injected
- Confirm teach/edit/delete in Skills manager still works unchanged

**Acceptance criteria:**
- A conversation pulls exactly one relevant skill, shown in the hint and backend log (Success Criteria 1 & 2)
- Same skill persists across turns; a no-match conversation shows no hint (Success Criterion 3)
- Teach/edit/delete skill flows unchanged (Success Criterion 3)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the `activeSkill` signal is wired directly to the `skill_active` stream event from the backend. No placeholder values or mock data.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The hint shows only the current user's own taught skill title back to that same user (T-40-02-01 accepted by design). The stale-state reset covers T-40-02-02.

## Self-Check

### Files exist:
- `apps/frontend/src/app/chat/chat.ts` — FOUND (contains activeSkill signal + case 'skill_active')
- `apps/frontend/src/app/chat/chat.html` — FOUND (contains @if (activeSkill()) hint block)

### Commits:
- `533215c` feat(40-02): add activeSkill signal and handle skill_active stream event
- `b717b76` feat(40-02): render small active-skill hint in Knowledge Skills section

## Self-Check: PASSED
