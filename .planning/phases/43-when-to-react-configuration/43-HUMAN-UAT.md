---
status: pending
phase: 43-when-to-react-configuration
source: [43-01-SUMMARY.md, 43-02-SUMMARY.md]
started:
updated:
---

# Phase 43 — When-to-React Configuration — HUMAN UAT

Per-dino reaction frequency control in group chat. Each participant dino can be
set to `never` / `rarely` / `normal` / `chatty` by the user. The level is stored
in `dino_reactivity` (Cloud SQL) and applied to the Group Engine v3 decision loop
at runtime — `never` is a hard clamp (dino stays silent unless @mentioned), while
`rarely`/`chatty` bias the LLM decision prompt.

## Prerequisites

### Code
- Phase 43 Plan 01 (backend persistence + engine hook) deployed.
- Phase 43 Plan 02 (frontend ReactivitySettings + ReactivityService) deployed.

### Cloud SQL
The `dino_reactivity` table must exist on Cloud SQL. It is NOT auto-migrated.
Apply manually if not already done:

```sql
CREATE TABLE IF NOT EXISTS dino_reactivity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  dino_id text NOT NULL,
  level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dino_reactivity_user_dino_idx
  ON dino_reactivity (user_id, dino_id);
```

Without this table the app degrades gracefully (all dinos default to `normal`) —
but SC#1/SC#2/SC#3 require the table to verify persistence.

### Phase 42 dependency note
SC#3 verifies that `never` clamps a **custom** dino. The custom dino must be
visible in the group picker. This requires Phase 42 (Custom Dino Creator) to be
deployed and at least one custom dino to have been created. If Phase 42 is not
yet deployed, test SC#3 with a built-in dino whose persona is described as
"always chiming in" instead, and note the limitation.

### Setup
- Serve with a live key: `npx nx serve @org/backend` + `npx nx serve frontend`
  with `OPENROUTER_API_KEY` and `DATABASE_URL` in `.env`.
- Open Group chat and select **3 dinos**.
- Run the same checks against **localhost** AND the live site
  **https://dinoagents.duckdns.org**. Record both.

---

## Tests

### SC#1 — Group-chat settings surface exposes a per-dino reaction control

steps:
1. Navigate to Group chat and select 2–3 dinos.
2. Click the "Reaction settings" button that appears below the dino selector.
3. Confirm the panel renders a row for each selected dino.
4. In each row, click through the four level buttons (never / rarely / normal / chatty).
5. Check the database row: `SELECT * FROM dino_reactivity WHERE user_id = '<your-user-id>';`

expected:
- The panel opens/closes with each click of the toggle button.
- Each dino row shows their avatar, name, and a segmented control with exactly 4 options.
- The active option is highlighted; clicking a different option highlights the new one.
- After clicking, the DB row for that `(user_id, dino_id)` is created/updated with
  the selected level (upsert).
- Selecting dinos that have never been configured defaults to "Normal" visually.
result: pending

---

### SC#2 — Changing the control observably changes reaction frequency

steps:
1. Select 2–3 dinos. Open Reaction settings; set one dino to `chatty`.
2. Send 5 varied prompts (mix of questions/statements).
3. Observe how often the `chatty` dino answers vs. responds with an emoji chip vs.
   stays silent.
4. Open Reaction settings; change that same dino to `rarely`.
5. Send 5 more prompts and observe the same dino.

expected:
- At `chatty`: the dino answers (not just reacts or stays silent) more frequently
  than at default. It may not answer every time, but noticeably more than `rarely`.
- At `rarely`: the dino is more likely to produce only an emoji reaction or stay
  silent, significantly less often than the `chatty` run.
- The CONTENT of answers when they do occur is not materially different — the level
  governs FREQUENCY, not tone.
result: pending

---

### SC#3 — Level clamp overrides persona; custom dino covered identically

steps:
1. Create a custom dino (Phase 42) whose personality description explicitly says it
   "loves chiming in" or "always wants to contribute". Add it to the group.
2. Open Reaction settings; set the custom dino to `never`.
3. Send 5 messages WITHOUT mentioning the dino.
4. Send one message that `@mentions` the dino by name.
5. Open Reaction settings; set the custom dino to `chatty`.
6. Send 5 more messages WITHOUT mentioning it.

expected:
- At `never` (steps 3): the dino produces NO output (no answer bubble, no emoji
  chip, no reaction row) even though its persona says it loves talking. The
  `never` clamp wins over the persona (D-06). The `never` clamp is deterministic —
  it happens BEFORE the LLM decision call.
- At `never` + @mention (step 4): the dino DOES answer because @mention forces an
  answer (D-06 exception — explicit per-message mention beats standing config).
- At `chatty` (steps 6): the dino answers more frequently than the `rarely` baseline
  run from SC#2.
- Throughout, the dino's avatar and name render identically to built-in dinos
  (DinoSummary rows are uniform regardless of `custom:` prefix).
result: pending

---

### SC#4 — Untouched dinos behave exactly as before

steps:
1. Select a dino you have NEVER configured in Reaction settings.
2. Check the database: confirm no row for `(user_id, that_dino_id)`.
3. Open Reaction settings; confirm the control shows "Normal" for that dino.
4. Send several prompts with that dino in the group WITHOUT changing its level.

expected:
- The dino behaves identically to pre-Phase-43 — it follows normal Group Engine v3
  decision probabilities with no frequency nudge.
- The Reaction settings panel shows "Normal" as the active level (fallback from
  empty map), not an error or empty state.
- No DB row is created for this dino until the user explicitly clicks a level.
result: pending

---

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

Run on:
- [ ] localhost
- [ ] https://dinoagents.duckdns.org
