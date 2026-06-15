# Phase 42: Custom Dino Creator - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Source:** Inline discuss + codebase audit (gsd-plan-phase 42)
**Mode:** mvp

<domain>
## Phase Boundary

Let a user **create their own dinos** — name, avatar image, description, a personality/reaction
prompt, and a tool subset — persisted per (anonymous) user, selectable in the dino picker, and able
to join group chats through the **live** group engine. A custom dino is the same shape as a built-in:
a model + system prompt + allowed tool subset, resolved **server-side** so the client can never widen
the toolset or read another user's authored prompt.

In scope:
- New `custom_dinos` DB table + CRUD API, scoped by the anonymous per-device `userId` (same identity
  model as `userMemories` / `dinoSkills`).
- A creation/edit/delete UI ("add a dino" flow): name, avatar upload, description, persona/reaction
  prompt, **model picked from a curated list**, tools picked from the existing catalogue.
- Avatar storage in a **GCS bucket** — the backend uploads the image and stores only the public URL.
- Server-side **registry-merge resolution**: built-in `DINOS` + the requesting user's custom dinos,
  resolved by the chat and group-chat paths; toolset narrowed to the catalogue server-side.
- `/api/dinos` returns built-in dinos **plus** the requesting user's custom dinos, so they appear in
  the picker and can be selected into group chat.

Out of scope:
- Sharing dinos between users, a marketplace, or public discovery.
- Authoring **new tools** — custom dinos pick only from the existing `get_current_time`, `web_search`,
  `fetch_page` catalogue.
- Per-dino mascots/pixel art (Phase 20). Custom dinos use their uploaded avatar URL, not the mascot
  pipeline.
- The Phase 41 autonomous engine itself — custom dinos plug into whatever group engine is live (today
  the Phase 37 intent engine). No Phase 41 work is done here.
</domain>

<decisions>
## Implementation Decisions

### Avatar storage — GCS bucket + URL (LOCKED, user-chosen)
- Backend exposes a **multipart upload** endpoint; it streams the file to a Cloud Storage bucket and
  returns the public object URL. The `custom_dinos` row stores only `avatarUrl: text` — never base64.
- **Multipart (not base64-in-JSON)** is chosen deliberately so avatar upload does NOT depend on Phase
  38-01's raised JSON body limit and never bloats chat payloads.
- ⚠ **Known infra cost (surfaced):** this is the heavier of the two options offered. It requires a
  one-time provisioning step that is **partly a human/infra task** (like Phase 20 art):
  - a dedicated avatars bucket (public-read, uniform bucket-level access) — reuse the
    `infrastructure/provision-gcp.sh` bucket pattern;
  - granting the VM service account (`chatbot-vm` / deployed `spinochat-*` SA) `roles/storage.objectAdmin`
    (today it has only `artifactregistry.reader` + `secretmanager.secretAccessor`).
  - The VM already runs with `--scopes=cloud-platform`, so Application Default Credentials work with no
    key file. Plan 42-02 documents the exact provisioning commands and degrades gracefully (clear error,
    creation blocked) when `AVATAR_BUCKET` is unset so local/dev/e2e without GCS still build and run.

### Model assignment — user picks from a curated list (LOCKED, user-chosen)
- A `GET /api/models` endpoint (or a static catalogue served alongside `/api/dinos`) exposes a small,
  curated set of OpenRouter model ids — the free/cheap ones the built-in dinos already use. The creation
  form is a dropdown over this list. The backend **validates** the chosen model is in the catalogue on
  create/update (a client cannot inject an arbitrary or expensive model id).

### Registry-merge resolution (LOCKED)
- `getDino(id)` stays synchronous for built-ins. Introduce an **async** resolver that returns a built-in
  from `DINOS` OR a custom dino (mapped to the `Dino` shape) loaded from the DB for the requesting user.
- Thread the async resolver through the **chat-turn entry points** only — `agents.service.streamAgent`
  (single chat), `group-agents.service` roster build + `isImageGenDino`, and
  `memory-creator.service.resolveDino`. The voice assistant and arena keep built-in resolution (custom
  dinos are not arena/voice targets in this phase).
- **Tool gating is server-side and non-negotiable:** a custom dino's `toolNames` are intersected with
  the catalogue at resolution time; the existing `resolveActiveTools` intersection still applies. The
  client cannot widen beyond what the catalogue allows.

### Identity & scoping (LOCKED)
- Custom dinos key on the anonymous per-device `userId` (the same `body.userId` already sent on chat
  requests). A user only ever sees/edits/deletes their own custom dinos.
- Memories and skills already key on `dinoId: text` with `(userId, dinoId)` scoping — a custom dino id
  slots in for free, so teach/memory flows work for custom dinos with no extra work.

### Custom dino id namespace (LOCKED)
- Custom dino ids are DB uuids prefixed `custom:` (e.g. `custom:8f3a…`) so a custom id can never collide
  with or shadow a built-in registry id, and the resolver can branch on the prefix cheaply.

### Graceful degradation (LOCKED)
- Every DB path no-ops/returns empty when `db` is null (local/e2e), mirroring `MemoryService`. With no DB
  the picker simply shows only built-in dinos and creation is rejected with a clear message.

### Claude's Discretion
- Exact curated model list contents (start from the registry's free models); exact form layout/styling
  (Tailwind only, desert/jungle theme, standalone OnPush components, presentational vs smart split per
  the project's component-architecture rule); whether `/api/models` is its own endpoint or a field on a
  combined catalogue response; multer config details for the upload endpoint.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Dino registry & resolution
- `apps/backend/src/app/agents/dinos/dinos.ts` — `DINOS` array, `getDino`, `toDinoSummary`,
  `DEFAULT_DINO_ID`. The shape every custom dino must map onto.
- `apps/backend/src/app/agents/dinos.controller.ts` — `GET /dinos` (must merge built-in + custom).
- `apps/backend/src/app/agents/agents.service.ts` — `streamAgent` (~L140 `getDino`), `resolveActiveTools`
  intersection (tool gating).
- `apps/backend/src/app/agents/group-agents.service.ts` — roster build (~L144 `getDino`), `isImageGenDino`
  (~L152).
- `apps/backend/src/app/memory/memory-creator.service.ts` — `resolveDino` (~L133).

### Shared types
- `libs/shared-types/src/lib/dino.types.ts` — `Dino`, `DinoSummary` (`Omit<Dino,'systemPrompt'>`),
  `DinoId`. Add `CustomDino*` request/response types + curated-model type here.

### DB & persistence patterns
- `apps/backend/src/app/database/schema.ts` — drizzle table patterns (`userMemories`, `dinoSkills`);
  add `customDinos` here following the same column/index conventions + `$inferSelect/$inferInsert` exports.
- `apps/backend/src/app/database/database.module.ts` — `DATABASE_CONNECTION` token, `Database` type,
  null-db handling.
- `apps/backend/src/app/memory/memory.service.ts` — the canonical graceful-degradation CRUD service to
  mirror (null-db guards, try/catch that never throws, `(userId, dinoId)` scoping).
- `apps/backend/CLAUDE.md` — backend rules (`process.env['VAR']`, no `any`, NestJS `Logger`, controllers
  thin, one module per feature, document env vars in `.env.example`).

### Infra (avatar bucket)
- `infrastructure/provision-gcp.sh` — bucket creation + public-read IAM + VM service-account role pattern
  (L47-103). Avatars bucket and the `roles/storage.objectAdmin` grant are added alongside these.
- `.planning/INFRASTRUCTURE.md` — record the new bucket + IAM + `AVATAR_BUCKET` env contract.

### Frontend dino surfaces
- `apps/frontend/src/app/chat/dino.service.ts` — dino fetch/service; add CRUD + model-list + avatar
  upload calls.
- `apps/frontend/src/app/store/dino/` — `dino.actions.ts` / `dino.reducer.ts` / `dino.effects.ts` /
  `dino.selectors.ts` — NgRx dino state to extend with custom dinos.
- `libs/ui/src/lib/dino-picker/dino-picker.ts`, `libs/ui/src/lib/dino-card/dino-card.ts` — picker + card
  surfaces that must render custom dinos (with avatar) and an "add dino" entry.
</canonical_refs>

<specifics>
## Specific Ideas

- `custom_dinos` columns: `id uuid pk`, `userId text notNull`, `name text notNull`, `species text`,
  `avatarUrl text`, `blurb text` (description), `persona text`, `systemPrompt text notNull`,
  `model text notNull`, `toolNames jsonb notNull default '[]'`, `accent text`, `createdAt`, `updatedAt`.
  Index on `userId`.
- The `custom:` id prefix lets the resolver short-circuit: `id.startsWith('custom:')` → DB lookup, else
  `getDino`.
- Avatar endpoint: `POST /api/custom-dinos/avatar` (multipart, single `file` field) → `{ url }`. Validate
  content-type (image/*) and a max size (e.g. 2 MB) before upload.
- `GET /api/dinos` must accept the `userId` (query param) and append `toDinoSummary`-shaped projections of
  that user's custom dinos so the picker shows them. `systemPrompt` must NEVER appear in the projection
  (reuse/extend the explicit-allowlist `toDinoSummary` so a future field cannot leak).
- Custom dinos join group chat by being resolvable in `group-agents.service` roster build — no engine
  rewrite. SC#4 is satisfied against the live Phase 37 engine.
</specifics>

<deferred>
## Deferred Ideas

- Sharing/marketplace/public custom dinos (needs accounts).
- Custom tool authoring or MCP — tools come only from the existing catalogue.
- Per-dino pixel-art mascots for custom dinos (Phase 20 pipeline).
- Letting custom dinos use arbitrary/paid model ids (curated list only this phase).
- When-to-react configuration for custom dinos (Phase 43 — composes on top of the authored prompt).
</deferred>

---

*Phase: 42-custom-dino-creator*
*Context gathered: 2026-06-12 via inline discuss (gsd-plan-phase 42)*
