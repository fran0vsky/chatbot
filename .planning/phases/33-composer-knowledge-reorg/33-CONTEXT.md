# Phase 33: Composer & Knowledge Reorg - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the composer's action buttons around a **brain** entry point and make
taught skills **first-class** (view + edit, not just delete).

**In scope:** composer icon/button reorg (brain replaces wrench + dedicated tools
button), `/teach` slash-command, teach-modal resize, skill **edit** UI + API, and a
skill list in the Knowledge view.

**Out of scope:** the AI suggestion engine (Phase 34). The brain's click target is
wired here, but the AI Memory Creator modal *contents* are built in Phase 34.
</domain>

<decisions>
## Implementation Decisions

### Brain + Tools button layout (SC#1)
- **D-01:** The **brain icon replaces the wrench** in the composer. Clicking the
  brain **opens the existing teach panel** (the current overlay in
  `apps/frontend/src/app/chat/chat.html` with the teach form + `<app-skill-manager>`).
  This avoids any dead UI this phase; Phase 34 later swaps that modal's *body* for the
  AI Memory Creator. The brain and `/teach` open the **same** teach surface.
- **D-02:** The **tools toggle is a separate, dedicated button** (the tool-toggle
  popover that lives in `input-composer.html` today). It stays an **icon-only**
  button, BUT its `title`/tooltip and `aria-label` MUST explicitly read **"Tools"**
  so SC#1's "clearly-labeled" is satisfied without an inline text label.

### /teach slash-command (SC#2)
- **D-03:** Triggered via a **live autocomplete menu**: typing `/` at the start of an
  empty/leading composer opens a small command menu showing `/teach`; selecting it
  opens the teach flow. (Not a submit-time detection.)
- **D-04:** Any text typed after `/teach ` **pre-fills the skill instruction field**;
  the skill name is left blank for the user to fill. (Claude's discretion call — see
  below.)
- **D-05:** The teach modal is **noticeably larger** (wider + taller) than the current
  overlay — clear-cut, no further discussion needed.

### Skill data model — "when-to-activate" / trigger field (SC#3)
- **D-06:** Add a third field **now**: `DinoSkill` gains `whenToActivate?: string`
  (in `libs/shared-types/src/lib/dino.types.ts`). This is a **nullable** DB column —
  **no backfill** required.
- **D-07:** Skills with **no `whenToActivate` value keep today's behavior — they always
  apply.** This protects SC#5 (no regression to existing teach/apply). How the agent
  loop *uses* the field (condition hint vs. always-append into the system prompt) is an
  implementation detail for research/planning — keep current always-apply behavior as the
  default path.
- **D-08:** The field is **optional in the teach (create) form**, and **present in the
  edit form**. Rationale for adding it in Phase 33 rather than deferring: SC#3 literally
  names "trigger" as editable, and introducing the column here means Phase 34 just
  *consumes* it instead of migrating mid-feature.

### Skill edit UX (SC#3)
- **D-09:** Editing is **inline-expand within the skill row**: clicking "Edit" on a row
  expands it into editable name / when-to-activate / instruction fields with Save/Cancel.
  Chosen over "reuse the teach form" so editing works **identically wherever the list is
  rendered** (teach modal AND Knowledge view) and doesn't couple to the teach form's
  location.
- **D-10:** New backend endpoint **`PUT /api/skills/:id`** (update name / whenToActivate /
  instruction). The presentational `<app-skill-manager>` gains a `skillEdited` output;
  `SkillService` gains an `updateSkill(...)` method.

### Knowledge view skill list (SC#4)
- **D-11:** **Shared component**: both the teach modal and the Knowledge view render the
  **same `<app-skill-manager>`** (now edit-capable), both fed by the same `SkillService`
  data — one source of truth, no divergence. The Knowledge view (currently file-upload
  only) adds a skills section that lists the active dino's skills, each with edit + delete.

### Claude's Discretion
- **D-04** (trailing-text → instruction pre-fill): user said "you decide"; chose pre-fill
  because it's minimal extra work and on the path to Phase 34 (natural text → filled form).
- **D-09 / D-11** (inline-edit + shared component): user said "you decide" for both; chose
  the pair because they're mutually reinforcing — inline edit lives inside the shared
  presentational list, so it works in both surfaces without depending on the teach form.
- Brain icon glyph/visual, exact composer button ordering, and command-menu styling are
  open to standard approaches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & success criteria
- `.planning/ROADMAP.md` §"Phase 33: Composer & Knowledge Reorg" (lines ~606-619) —
  goal, 5 success criteria, scope note (brain-click wired here / Phase 34 owns modal body).

### Code to modify / reuse
- `libs/ui/src/lib/input-composer/input-composer.html` — current wrench→tools popover;
  brain replaces wrench, tools becomes the dedicated button, `/teach` menu lives here.
- `libs/ui/src/lib/input-composer/input-composer.ts` (+ `.stories.ts`) — composer
  component logic + Storybook.
- `libs/ui/src/lib/skill-manager/skill-manager.ts` + `.html` (+ `.stories.ts`) —
  presentational skill list; add inline edit + `skillEdited` output.
- `apps/frontend/src/app/chat/chat.html` — teach overlay (~line 659) and Knowledge view
  (~line 337, file-upload only today).
- `apps/frontend/src/app/chat/chat.ts` — composer wiring, `skillPanelOpen`, teach handlers.
- `apps/frontend/src/app/chat/skill.service.ts` — add `updateSkill(...)`.
- `apps/backend/src/app/memory/skills.controller.ts` — add `PUT skills/:id`.
- `apps/backend/src/app/memory/memory.service.ts` — `updateSkill` business logic + the
  Drizzle schema/migration adding the `whenToActivate` column.
- `libs/shared-types/src/lib/dino.types.ts` — `DinoSkill` interface gains `whenToActivate?`.

No external ADR/spec docs for this phase — requirements fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<app-skill-manager>`: already a pure presentational component (inputs `skills`,
  `memories`; outputs `skillDeleted`, `memoryDeleted`) — extend with edit, reuse in both
  the teach modal and Knowledge view.
- Tools popover in `input-composer.html` (lines ~34-80): existing checkbox toggle UI;
  becomes the "dedicated tools button" — keep the popover, relabel/re-icon.
- `SkillService` (`getLearned`/`addSkill`/`deleteSkill`): mirror its pattern for
  `updateSkill`; scoped by anonymous `userId` × `dinoId`.

### Established Patterns
- Frontend conventions (`apps/frontend/CLAUDE.md`): standalone + OnPush components; logic
  in services not templates; HTTP only via services; types from `@org/shared-types`;
  Tailwind only, no inline styles. Presentational components live in `libs/ui` (no
  services, OnPush, Storybook story).
- Backend conventions (`apps/backend/CLAUDE.md`): controllers HTTP-only, logic in
  services, constructor DI, NestJS built-in exceptions, types from `@org/shared-types`.
- Skills persisted via Drizzle/Postgres; gracefully degrade when DB unavailable
  (`ServiceUnavailableException` pattern already in `skills.controller.ts`).

### Integration Points
- New `PUT /api/skills/:id` joins existing `/api/skills` GET/POST/DELETE surface.
- `whenToActivate` column flows: DB → `DinoSkill` type → API responses → teach/edit forms,
  and is later consumed by Phase 34's AI Memory Creator (3-field form: name / when /
  instruction).
- The agent loop that applies taught skills must continue to apply skills with empty
  `whenToActivate` exactly as today (no regression).

</code_context>

<specifics>
## Specific Ideas

- Phase 34's editable form is **name / when-to-activate / instruction** — Phase 33's new
  `whenToActivate` field and edit form should be shaped so Phase 34 reuses them directly.
- "Brain replaces wrench" is literal: the wrench glyph currently used for tools is
  repurposed — brain takes the primary slot, tools gets its own clearly-tooltipped button.

</specifics>

<deferred>
## Deferred Ideas

- AI Memory Creator (conversation-derived "things worth remembering" suggestions,
  thinking-state, auto-filled form, overlap reconciliation) — **Phase 34** (the brain's
  modal contents).

### Reviewed Todos (not folded)
- **"Replace placeholder dino mascots with real pixel-art"** (`ui`, score 0.9) — matched
  only on the keyword "dinos"; it's mascot/visual work belonging to **Phase 20**, not the
  composer/skill reorg. Left out of scope.

</deferred>

---

*Phase: 33-composer-knowledge-reorg*
*Context gathered: 2026-06-05*
