---
phase: 11
slug: reasoning-thinking-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (unit, via Nx defaults for NestJS + Angular) + Playwright (E2E in `frontend-e2e`) + Storybook (visual / component contract for presentational UI) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/frontend/jest.config.ts`, `libs/ui/jest.config.ts` (verify exact paths in Wave 0) |
| **Quick run command** | `pnpm nx affected -t test,lint --base=HEAD~1` |
| **Full suite command** | `pnpm nx run-many -t test,lint,build` then `pnpm nx e2e frontend-e2e` |
| **Estimated runtime** | ~90s affected; ~6 min full + E2E |

---

## Sampling Rate

- **After every task commit:** Run `pnpm nx affected -t test,lint --base=HEAD~1`
- **After every plan wave:** Run `pnpm nx run-many -t test,lint,build`
- **Before `/gsd:verify-work`:** Full suite green + Playwright E2E pass on default model (zero regression) + manual smoke on `deepseek/deepseek-r1:free`
- **Max feedback latency:** 90 seconds (affected); 360 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | REQ-1..9 | — | Wave 0 test stubs in place | scaffold | `pnpm nx affected -t test --base=HEAD~1` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | REQ-3 | — | `StreamEvent` union includes `reasoning_token`; `ChatMessage.reasoning?` field present | unit (compile) | `pnpm nx build shared-types` | ✅ | ⬜ pending |
| 11-03-01 | 03 | 1 | REQ-2 | T-V14 | `modelKwargs.reasoning` attached only when capability flag is set | unit (backend) | `pnpm nx test backend -t "buildGraph attaches reasoning modelKwargs only when capability is set"` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | REQ-1, REQ-3 | T-V7 | Non-reasoning model emits zero `reasoning_token`; reasoning model emits ≥1 | integration (backend) | `pnpm nx test backend -t "streamAgent reasoning gating"` | ❌ W0 | ⬜ pending |
| 11-03-03 | 03 | 2 | REQ-3, REQ-8 | — | `done.reasoning` = concat of all `reasoning_token.text`; `done.reasoningDurationMs` = lastTs − firstTs | integration (backend) | `pnpm nx test backend -t "done event includes concatenated reasoning"` + `pnpm nx test backend -t "reasoning duration"` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 2 | REQ-3 | — | `chat.service` accumulates `reasoning_token` into in-progress assistant message via signal | unit (frontend) | `pnpm nx test frontend -t "handleStreamEvent appends reasoning"` | ❌ W0 | ⬜ pending |
| 11-04-02 | 04 | 2 | REQ-7 | — | First content `token` after reasoning > 0 flips reasoning-collapsed signal within 1 frame | unit (frontend) | `pnpm nx test frontend -t "handleStreamEvent collapses on first token after reasoning"` | ❌ W0 | ⬜ pending |
| 11-04-03 | 04 | 2 | REQ-4 | — | `HistoryService.upsertSession` preserves `reasoning` round-trip | unit (frontend) | `pnpm nx test frontend -t "HistoryService preserves reasoning on assistant message"` | ❌ W0 | ⬜ pending |
| 11-05-01 | 05 | 2 | REQ-5, REQ-8 | T-XSS | `ReasoningBlock` renders text via `{{ }}` (no `[innerHTML]`); duration label rounds (`<1s` rule) | unit (component) | `pnpm nx test ui -t "ReasoningBlock"` | ❌ W0 | ⬜ pending |
| 11-05-02 | 05 | 2 | REQ-5, REQ-6 | — | Storybook story renders muted desert palette in light + dark themes | story (visual) | `pnpm nx storybook ui` (manual visual via Storybook) | ❌ W0 | ⬜ pending |
| 11-06-01 | 06 | 3 | REQ-5, REQ-9 | — | `MessageBubble` slots `ReasoningBlock` above content when reasoning non-empty; tool-call splice path unchanged | unit (component) | `pnpm nx test ui -t "MessageBubble with reasoning"` | ❌ W0 | ⬜ pending |
| 11-07-01 | 07 | 3 | REQ-2 | — | `deepseek/deepseek-r1:free` appears in model selector; default remains `openai/gpt-4o-mini` | unit (frontend) | `pnpm nx test ui -t "model-selector includes deepseek-r1"` | ✅ | ⬜ pending |
| 11-08-01 | 08 | 4 | REQ-7, REQ-9 | — | Live reasoning stream auto-collapses on first content token; tool-call interleaving keeps a single reasoning block per turn | E2E | `pnpm nx e2e frontend-e2e --grep "reasoning"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan IDs above are indicative — final plan numbers come from the planner. Map updates after PLAN.md files land.*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/app/agents/agents.service.spec.ts` — new describe blocks for reasoning extraction, duration timing, done-event enrichment, model-gated `modelKwargs`
- [ ] `apps/backend/src/app/agents/model-capabilities.spec.ts` — new file covering the `MODEL_CAPABILITIES` map
- [ ] `apps/frontend/src/app/chat/chat.service.spec.ts` — extend with `reasoning_token` parsing case
- [ ] `apps/frontend/src/app/chat/chat.spec.ts` — new or extended for `handleStreamEvent` auto-collapse and commit-turn-with-reasoning
- [ ] `apps/frontend/src/app/chat/history.service.spec.ts` — verify `ChatMessage.reasoning` round-trips through sessionStorage
- [ ] `libs/ui/src/lib/reasoning-block/reasoning-block.spec.ts` — new unit test for `ReasoningBlock`
- [ ] `libs/ui/src/lib/reasoning-block/reasoning-block.stories.ts` — new Storybook story (Req 5 acceptance)
- [ ] `apps/frontend-e2e/src/reasoning.spec.ts` — new E2E covering reasoning stream + auto-collapse + tool-call interleaving
- [ ] `pnpm add @langchain/openrouter` — replaces `ChatOpenAI` + baseURL for the reasoning code path (per RESEARCH §Pitfall 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Muted desert-palette visual contract in light + dark themes | REQ-6 | Visual judgment; pixel-diff snapshots would be flaky against the streaming animation | Open `pnpm nx storybook ui`, navigate to `ReasoningBlock`, toggle theme, confirm left-border + `text-stone-*` muted shade matches existing muted secondaries in the desert palette |
| Real DeepSeek-R1 reasoning stream end-to-end | REQ-1, REQ-2, REQ-3, REQ-7 | Requires live network + OpenRouter API key; not deterministic | Boot `pnpm nx serve frontend` + `pnpm nx serve backend`, select `deepseek/deepseek-r1:free`, send a non-trivial prompt, confirm reasoning block expands while streaming and collapses on first answer token |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s (affected); < 360s (full)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
