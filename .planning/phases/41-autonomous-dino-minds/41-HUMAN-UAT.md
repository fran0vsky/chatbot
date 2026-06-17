---
status: pending
phase: 41-autonomous-dino-minds
source: [41-01-SUMMARY.md, 41-02-SUMMARY.md, 41-03-PLAN.md]
started:
updated:
---

# Phase 41 — Autonomous Dino Minds (Group Engine v3) — HUMAN UAT

Group Engine v3: every participant dino is an independent mind. On each user
message EVERY participant dino makes its OWN decision call on its OWN model and
chooses `answer` / `react` (emoji) / `silent`. There is no central director, no
"everyone always answers" pattern; later dinos see earlier dinos' turns and can
respond to them. One user turn yields any mix of answers, reactions, and
silences, rendered top-to-bottom with attribution.

## Setup

- Serve the app with a live key: `npx nx serve @org/backend` + `npx nx serve frontend`
  with `OPENROUTER_API_KEY` (and `DATABASE_URL` if testing persistence) in `.env`.
- Open Group chat and select **3–4 dinos** (mix text dinos; optionally include the
  image-gen dino Vinci to exercise the image-gen react path).
- Keep the backend console visible — the decision calls are logged per dino.
- Run the same checks against **localhost** AND the live site
  **https://dinoagents.duckdns.org** (v2.2 production-parity goal). Record both.

## Tests

### 1. GRP3-01 — Independent per-dino decisions on own model
steps:
1. Send ONE general message (e.g. "What's the best way to learn to code?").
2. Observe the turn render.
expected:
- Different dinos do different things in the SAME turn — some answer, some show
  only an emoji reaction chip, some stay silent. It is NOT a fixed
  "everyone answers" fan-out.
- The backend log shows ONE decision call per participant dino, each on that
  dino's own registered model (not a single shared director model).
- Repeating the prompt produces a different mix (decisions are genuinely
  per-dino, not a static plan).
result: pending

### 2. GRP3-02 — Threaded attribution (dinos respond to each other)
steps:
1. In a turn that yields ≥2 answers, read the later answer bubbles.
2. Send a follow-up that invites disagreement (e.g. "Are you sure? Convince me.").
expected:
- A later dino's reply visibly references what an earlier dino just said in the
  SAME turn — it agrees with / disagrees with / builds on / corrects / asks the
  earlier dino, and shows the reply stub / intent chip pointing at that dino.
- Across rounds, at least one dino responds to another dino (not just to the user).
result: pending

### 3. GRP3-03 — Mixed turn renders top-to-bottom with attribution
steps:
1. Look at a single completed turn end-to-end.
expected:
- The turn shows a MIX in one interleaved transcript: answer bubbles, emoji
  reaction chips pinned on their target message, and silent dinos (no row).
- Everything renders top-to-bottom in arrival order with correct attribution
  (each bubble shows the right dino name + mascot) and the Phase 37 intent chips
  still display from each answer's stance.
- An emoji reaction adds a CHIP on its target message, not a new transcript line.
result: pending

### 4. Cost ceiling + @mention forcing
steps:
1. Watch one turn's decision/answer calls in the backend log.
2. Send a message that `@mentions` exactly one dino via the autocomplete.
expected:
- No runaway loop: a turn never exceeds the documented ceiling
  (≤ MAX_GROUP_DINOS × MAX_ROUNDS = 4 × 3 = 12 decision calls, ≤ MAX_TOTAL_ANSWERS
  = 8 answer calls), and the loop stops early when a round produces zero answers.
- The `@mentioned` dino ALWAYS answers in round 1 (forced), regardless of what it
  would otherwise have decided.
result: pending

### 5. Regression — single-dino chat + Arena unchanged
steps:
1. Switch to a normal single-dino chat and send a message.
2. Open Arena and run one matchup.
expected:
- Single-dino streaming, stop, regenerate, history save/reopen all behave exactly
  as before. Arena is unaffected. v3 changes are isolated to group chat.
result: pending

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

Run on:
- [ ] localhost
- [ ] https://dinoagents.duckdns.org
