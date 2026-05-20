# Phase 2: Choose Your Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 2-Choose Your Model
**Areas discussed:** Model list, Selector UI style, Model switch behavior

---

## Model list

### Where does the model list come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded in frontend | Fixed array of 2-4 curated models in frontend code | ✓ |
| Fetched from OpenRouter API | Call /models endpoint at startup — 200+ models, needs filtering | |

**User's choice:** Hardcoded in frontend

---

### Which models should be in the hardcoded list?

| Option | Description | Selected |
|--------|-------------|----------|
| gpt-4o-mini + claude-3-haiku | Fast/cheap models from two biggest providers, noticeably different styles | ✓ |
| gpt-4o-mini + gpt-4o | Two OpenAI models — similar style, gpt-4o smarter | |
| gpt-4o-mini + claude-3-haiku + gemini-flash | Three models across three providers | |
| You decide | Claude picks a sensible 2-3 model shortlist | |

**User's choice:** gpt-4o-mini + claude-3-haiku

---

### How should models be labeled in the selector?

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly names | "GPT-4o mini" and "Claude 3 Haiku" | ✓ |
| Raw model IDs | "openai/gpt-4o-mini" and "anthropic/claude-3-haiku" | |
| You decide | Claude picks appropriate display names | |

**User's choice:** Friendly names

---

## Selector UI style

### What style should the model selector use?

| Option | Description | Selected |
|--------|-------------|----------|
| Native `<select>` dropdown | Standard HTML select, Tailwind-styled, accessible, mobile-friendly | ✓ |
| Pill/tab switcher | Two side-by-side pill buttons, more visual | |
| You decide | Claude picks simplest clean approach | |

**User's choice:** Native `<select>` dropdown

---

### Where in the header should the selector sit?

| Option | Description | Selected |
|--------|-------------|----------|
| Right side of header | App name left, selector right — standard toolbar layout | ✓ |
| Left side, next to app name | Selector right after "Chatbot" — compact but may feel cramped | |
| You decide | Claude picks natural position based on existing markup | |

**User's choice:** Right side of header

---

### Should the selector have a visible label?

| Option | Description | Selected |
|--------|-------------|----------|
| No label — selector alone | Dropdown shows selected model name directly | ✓ |
| "Model:" label before dropdown | Explicit label, takes more header space | |

**User's choice:** No label — selector alone

---

## Model switch behavior

### What happens to conversation history when switching models?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep history, switch model | Same threadId continues — new model sees prior messages | ✓ |
| Fresh conversation on switch | New threadId generated — history cleared | |

**User's choice:** Keep history, switch model

---

### How should the selected model reach the backend?

| Option | Description | Selected |
|--------|-------------|----------|
| Add `model` field to `ChatRequest` | Extend shared-types: `ChatRequest { message, threadId?, model? }` | ✓ |
| Separate /session endpoint | POST /api/agents/session sets active model server-side | |

**User's choice:** Add model field to ChatRequest

---

### Should the selector be disabled while the assistant is responding?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, disable during loading | Consistent with existing input/button behavior | ✓ |
| No, allow switching anytime | User can change model mid-flight | |

**User's choice:** Yes, disable during loading

---

## Claude's Discretion

- Backend model caching strategy (`Map<string, ChatOpenAI>` vs per-request instantiation) — implementation detail left to planner/executor
- Tailwind styling specifics for the `<select>` element

## Deferred Ideas

None — discussion stayed within phase scope.
