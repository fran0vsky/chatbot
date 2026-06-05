# Phase 35: Conversational Group Chat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 35-conversational-group-chat
**Areas discussed:** Participation & turn engine, @mention & addressing, Emoji reactions, Persistence & continuation

---

## Participation & turn engine

### Decision mechanism (D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Central orchestrator call | One cheap LLM (gpt-4o-mini) decides who answers/reacts/stays silent + order; only answerers make full calls | ✓ (Claude, delegated) |
| Per-dino router pre-call | Each dino classifies in its own voice, then answerers make full calls | |
| Inline single call per dino | Each dino makes one structured call returning answer/emoji/silent | |

**User's choice:** "i lack expertise here decide whats the best for the project and follows mentors instructions" → delegated to Claude.
**Notes:** No mentor note found in repo; chose central orchestrator for cost control + fewer free-model 429s + central enforcement of bounds.

### Inter-dino dialogue bounds (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| One follow-up round | Answer user, then one bounded inter-dino round, then end | ✓ |
| Up to N bounded rounds | Keep running rounds until done or hard cap (~3) | |
| No inter-dino turns | Dinos only respond to user | |

**User's choice:** One follow-up round.

### Ordering & streaming (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Round 1 concurrent (rendered in order); round 2 sequential | ✓ |
| Fully sequential | Every dino one at a time, sees all prior replies | |
| Fully concurrent | All answerers parallel, no genuine cross-reference | |

**User's choice:** Hybrid.

---

## @mention & addressing

### Mention UX (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Typed @ with autocomplete | `@` opens participant dropdown, inserts styled token, forces reply | ✓ |
| Typed @Name, plain parse | Backend parses `@<name>`; no UI; typo-fragile | |
| Clickable @ chips / mention bar | Row of participant chips above composer | |

**User's choice:** Typed @ with autocomplete.

### Dino-to-dino mentions (D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, forces | Dino mention guarantees the named dino a turn | |
| Allowed but not forced | Mentions are flavor; orchestrator decides freely | |
| User mentions only | No special handling of dino-to-dino | |

**User's choice (free text):** "somewhere between first and second… if a dino has a different view or his own thoughts he should mention that and give his response unasked" → captured as a **soft signal**: orchestrator actively favors a dino volunteering a dissent/addition (naming who it answers), else stays silent. User confirmed: "capture is perfect."
**Notes:** Reflects a mentor note the user recalled; original note not found in repo.

---

## Emoji reactions

### Render target (D-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Reaction chip on a message | Emoji chip pinned to the reacted message (mascot + emoji) | ✓ |
| Its own attributed line | Reaction as a one-emoji transcript row | |
| Both / configurable | Line for prompt reactions, chip for reply reactions | |

**User's choice:** Reaction chip on a message.

### Action exclusivity (D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| One action per dino/round | Exactly one of answer/react/silent; single emoji | ✓ |
| A dino can reply AND react | One dino may both reply and drop an emoji | |

**User's choice:** One action per dino/round (single emoji).
**Notes:** User initially mis-clicked "reply AND react", asked to redo, re-selected "one action per round."

---

## Persistence & continuation

### Storage model (D-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Single interleaved session | One localStorage ConversationSession, attributed messages + roster | ✓ |
| Per-dino sub-threads | Keep `group-{id}-{dinoId}` threads, stitch at render | |
| New DB-backed group tables | Persist to Postgres/Drizzle | |

**User's choice:** Single interleaved session.

### Multi-turn context per dino (D-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Full attributed transcript | Each dino sees whole interleaved history with speaker labels | ✓ |
| Own messages + user only | Each dino sees only user + its own replies | |
| Orchestrator-summarized context | Running summary fed to each dino | |

**User's choice:** Full attributed transcript.

---

## Claude's Discretion

- Orchestrator prompt + structured-output schema (per-dino action, emoji, target, order, dino-mentions).
- Exact hard caps: round-2 volunteer count + per-turn inter-dino call ceiling (build on `MAX_DINOS = 4`).
- Emoji set/allow-list, chip affordances, mention-token styling, autocomplete details.
- Composer enter/exit group mode + history-panel visual distinction for group threads.
- Transcript attribution format sent to models (D-09); reaction rendering in that text.
- Mechanics of removing the old parallel fan-out without regressing single-dino chat.

## Deferred Ideas

- Multi-round emergent banter (N bounded rounds) — capped at one round for MVP.
- A dino both replying AND reacting in one turn — rejected for MVP.
- DB-backed cross-device group persistence — localStorage MVP substrate.
- Orchestrator-summarized long-thread context — raw transcript bounded by HISTORY_CAP for now.
- In-character per-dino router speak/silent decision — rejected as engine for cost.
- Todo `2026-05-29-replace-placeholder-dino-mascots` — reviewed, not folded (belongs to Phase 20).
