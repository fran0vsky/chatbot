# Phase 43: When-to-React Configuration - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning
**Source:** Inline discuss-phase (gsd-discuss-phase 43) + Phase 41/42 code read
**Mode:** mvp

<domain>
## Phase Boundary

Give the user a **per-dino "when to react" control** for group chat that applies to built-in
**and** custom dinos alike. The control is a 4-step preset level (`never / rarely / normal / chatty`)
that influences each dino's autonomous answer/react/silent decision in the live Phase 41 (Group
Engine v3) decision call. The setting is persisted per `(userId, dinoId)`, surfaced in a group-chat
settings panel, and defaults to behavior identical to today's for any dino the user never configures.

**In scope:**
- A group-chat settings surface listing the participant/roster dinos, each with a
  `never / rarely / normal / chatty` control.
- An engine hook: the resolved level injects a propensity nudge into the per-dino decision prompt
  (`buildDecisionPrompt`) and a deterministic `never` → `silent` clamp in the engine round loop.
- Persistence: a new per-user, per-dino settings table keyed `(userId, dinoId)` covering built-in ids
  and `custom:` ids identically, mirroring `userMemories` / `dinoSkills`.
- Documented precedence: for custom dinos, the authored persona prompt governs **content/style**; the
  when-to-react level governs **frequency**; `never` is an absolute override.

**Out of scope** (roadmap scope note):
- Per-message reaction overrides.
- Reaction analytics.
- Any change to the Phase 41 decision *architecture* itself (only the prompt-injection + clamp hook).
- Authoring custom-dino reactivity via free text (presets only this phase — see Deferred).
</domain>

<decisions>
## Implementation Decisions

### Control type (SC#1 — was explicitly deferred to discuss-phase)
- **D-01:** The control is **preset levels only**: `never / rarely / normal / chatty`. No free-text
  reaction rule this phase. Presets map to a deterministic, testable propensity and a single injected
  nudge line, keeping SC#2 ("observably changes frequency") provable. (Free-text deferred.)

### Engine hook & enforcement (SC#2)
- **D-02:** **Hard clamp + nudge.** `never` is enforced **deterministically** in the engine: after the
  dino's decision (and before acting), a `never` level forces the decision to `silent`, so it is a hard
  guarantee even if the LLM ignores prompt text. `rarely / normal / chatty` inject a **propensity nudge**
  line into the decision prompt (`buildDecisionPrompt`) steering the model toward more/less
  answer-vs-react-vs-silent.
- **D-03:** The hook point is the per-dino decision call only — `buildDecisionPrompt` (system-prompt
  nudge) plus a post-decision clamp in `group-agents.service.ts` `streamGroup` (the `decideAction`
  result site, near the existing answer-cap downgrade at L280-284). The heuristic fallback
  (`heuristicDecision`) should honor the same `never` clamp so degraded paths stay consistent. No change
  to the round/cost-cap machinery or the SSE contract.
- **D-04:** Resolved level applies to **every round** of a user turn (it shapes the per-round decision),
  not just Round 1.

### Defaults (SC#4 — preserve current behavior)
- **D-05:** Default level is **`normal`**, defined as **no nudge injected and no clamp applied** — i.e.
  byte-for-byte identical decision-prompt + engine behavior to current Phase 41. A dino with no stored
  row is treated as `normal`. Users who never touch the setting see zero behavior change.

### Precedence with custom-dino persona (SC#3)
- **D-06:** **Setting governs frequency; persona governs content.** For a custom dino, the authored
  `persona` prompt shapes *how/what* it says and is layered first; the when-to-react level's nudge/clamp
  layers **on top** to shape *how often* it speaks. `never` is an **absolute override** regardless of
  persona text. This precedence MUST be documented in code (comment at the prompt-composition site) and
  in HUMAN-UAT so SC#3 is demonstrable.

### Settings UI surface (SC#1)
- **D-07:** A **group-chat settings panel** (a new presentational config surface) lists the participant/
  roster dinos, each row showing the dino (name/avatar) and the `never / rarely / normal / chatty`
  control. One surface covers built-in + custom uniformly. Model the per-dino-config UX on the existing
  `skill-manager` component (closest analog: per-dino, per-user config manager). Tailwind only,
  standalone OnPush, desert/jungle theme, presentational/smart split per project rules.

### Persistence (SC: "config must cover custom dinos")
- **D-08:** A **single new `(userId, dinoId)` settings table** (e.g. `dino_reactivity` / `dinoReactivity`)
  storing the level enum. Keyed exactly like `userMemories` / `dinoSkills`, so built-in ids and
  `custom:`-prefixed ids slot in with no branching and **no `custom_dinos` schema change**. Full graceful
  degradation: null-db no-ops and the resolver returns `normal` for everyone (mirrors `MemoryService`).
- **D-09:** New CRUD endpoints follow the memory/skills controller+service pattern (thin controller,
  `(userId, dinoId)` scoping). A read endpoint returns the user's levels for the roster so the settings
  panel can hydrate; a write endpoint upserts one dino's level. Document the level enum in
  `@org/shared-types`.

### Claude's Discretion
- Exact table/column/endpoint names; whether the level is read per-roster in one call or per-dino;
  the precise nudge wording per level (planner/executor to author, must make `never`/`rarely` vs
  `chatty` produce a visibly different answer rate); exact panel layout/placement (entry point from the
  group-chat surface) and control widget (segmented control vs slider vs select) within the project's
  component-architecture + Tailwind rules; whether `normal` is stored explicitly or represented as
  "no row".
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Group engine decision call (the hook point)
- `apps/backend/src/app/agents/group/decision.ts` — `buildDecisionPrompt` (system/human prompt for one
  dino's answer/react/silent decision — inject the level nudge here), `parseDecision`,
  `heuristicDecision` (apply the `never` clamp here too), cost-cap constants. **Primary edit site.**
- `apps/backend/src/app/agents/group-agents.service.ts` — `streamGroup` round loop: `decideAction`
  (~L148, L261-268 decision site), the existing post-decision answer-cap downgrade (~L280-284, the
  pattern to mirror for the `never` clamp), `buildDirective`, roster build (~L144), `isImageGenDino`.
- `libs/shared-types/src/lib/group.types.ts` — `DinoDecision`, `GroupStreamEvent` (no contract change
  expected; add the reactivity-level enum type, or place it in `dino.types.ts`).
- `libs/shared-types/src/lib/group-social.ts` — `AgentProfile`, `SpeechIntent` (decision prompt inputs).

### Persistence pattern to mirror (CRUD + graceful degrade + (userId, dinoId) scoping)
- `apps/backend/src/app/memory/memory.service.ts` — canonical null-db-safe CRUD service to mirror
  (null guards, try/catch that never throws, `(userId, dinoId)` scoping).
- `apps/backend/src/app/database/schema.ts` — drizzle table patterns (`userMemories`, `dinoSkills`,
  `customDinos`); add the new reactivity table following the same column/index conventions +
  `$inferSelect/$inferInsert` exports. `customDinos` already has a `persona` column (the authored
  reaction prompt referenced by SC#3) — **do not** add a reactivity column there (D-08).
- `apps/backend/src/app/database/database.module.ts` — `DATABASE_CONNECTION` token, `Database` type,
  null-db handling.
- `apps/backend/src/app/agents/dinos/dinos.ts` — `DINOS`, `getDino`, built-in ids (the dinoIds the
  setting keys on for built-ins).
- `apps/backend/CLAUDE.md` — backend rules (`process.env['VAR']`, no `any`, NestJS `Logger`, thin
  controllers, one module per feature, never let a side-channel break the chat → degrade).

### Custom-dino resolution (precedence with persona)
- `apps/backend/src/app/agents/dinos/dinos.ts` + the Phase 42 async resolver path — where a custom dino
  maps to the `Dino` shape (persona → systemPrompt/profile). SC#3 precedence is documented at the
  prompt-composition site that combines persona text with the reactivity nudge.

### Frontend surfaces
- `apps/frontend/src/app/chat/chat.ts` — group participant selection (`toggle` dino in/out, `MAX_DINOS`
  cap ~L426-442); the group-chat surface the settings panel hangs off.
- `apps/frontend/src/app/chat/groupchat.service.ts` — group session state; reactivity-level fetch/upsert
  service calls live alongside.
- `apps/frontend/src/app/chat/dino.service.ts` — dino fetch service (roster source for the panel).
- `libs/ui/src/lib/skill-manager/` — closest UI analog: per-dino, per-user config manager. Model the
  reactivity settings panel on this.
- `libs/ui/src/lib/dino-card/dino-card.ts`, `libs/ui/src/lib/dino-picker/dino-picker.ts` — dino
  name/avatar rendering reused in the settings rows.
- `apps/frontend/CLAUDE.md` — standalone OnPush components, Tailwind only, types from `@org/shared-types`,
  presentational vs smart split.

### Phase dependencies
- `.planning/phases/41-autonomous-dino-minds/41-CONTEXT.md` — the v3 autonomous decision architecture
  this phase hooks into.
- `.planning/phases/42-custom-dino-creator/42-CONTEXT.md` — custom-dino model (`persona` column,
  `custom:` id namespace, `(userId, dinoId)` scoping reuse).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MemoryService` (`memory.service.ts`): exact null-db-safe, `(userId, dinoId)`-scoped CRUD pattern to
  copy for the new reactivity service.
- `skill-manager` UI component: existing per-dino, per-user config manager — strongest analog for the
  settings panel's interaction model.
- `dino-card` / `dino-picker`: dino name+avatar rendering reused in settings rows.
- `buildDecisionPrompt`: pure, unit-tested prompt builder — the level nudge is a single new line, keeping
  it testable.

### Established Patterns
- Per-user state keys on the anonymous per-device `userId` already on chat requests; `(userId, dinoId)`
  scoping works for built-in and `custom:` ids alike → uniform coverage with no branching.
- Every DB path degrades gracefully when `db` is null (local/e2e) — the resolver must return `normal`.
- The engine already has a precedent for **post-decision downgrade** (answer-cap → react/silent at
  ~L280-284) — the `never` clamp slots in at the same site.

### Integration Points
- Decision-prompt nudge: `buildDecisionPrompt` in `group/decision.ts`.
- Deterministic clamp: post-`decideAction` in `group-agents.service.ts` `streamGroup`, plus
  `heuristicDecision` for the degraded path.
- Level lookup: resolved once per roster per user turn and threaded into the decision call.
- UI: new settings panel reachable from the group-chat surface in `chat.ts`.
</code_context>

<specifics>
## Specific Ideas

- Four levels, fixed: `never / rarely / normal / chatty`. `normal` = no-op (no nudge, no clamp).
- `never` MUST be a hard guarantee (deterministic silent), not just prompt text — this is the headline
  observable proof for SC#2.
- SC#3 proof: a custom dino whose persona says "I love chiming in" set to `never` must stay silent
  (clamp wins), and the same dino set to `chatty` must answer more — demonstrating frequency (setting)
  vs content (persona) layering.
- SC#2 proof: the same built-in dino at `chatty` answers visibly more often than at `rarely` across
  several turns.
</specifics>

<deferred>
## Deferred Ideas

- **Free-text per-dino reaction rule** fed into the decision prompt (the alternative to presets) — a
  future enhancement once presets prove out.
- **Per-message reaction overrides** and **reaction analytics** — explicitly out of scope (roadmap).
- **Per-dino persona-derived default levels** (e.g. shy dino defaults `rarely`) — rejected for this
  phase because it would change current behavior on day one (violates SC#4's literal reading).

### Dependency watch (not a deferred idea — a planning risk)
- Phase 42 is only **partially shipped** (data+API layer done; avatar upload, chat-loop resolution, and
  creation UI still gapped per ROADMAP). Custom dinos appear in `/api/dinos` (merged) and have rows, so
  the reactivity table and settings panel can cover them **now** via `(userId, dinoId)`. But end-to-end
  proof of SC#3 against a custom dino in *group chat* depends on Phase 42's chat-loop resolution being
  live. Planner: treat the reactivity persistence/UI as independent of Phase 42 completion, but flag the
  custom-dino group-chat E2E proof as gated on Phase 42's resolver gap.

</deferred>

---

*Phase: 43-when-to-react-configuration*
*Context gathered: 2026-06-19 via inline discuss-phase*
