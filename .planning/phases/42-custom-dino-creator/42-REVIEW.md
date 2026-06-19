---
phase: 42-custom-dino-creator
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - apps/backend/src/app/agents/agents.module.ts
  - apps/backend/src/app/agents/agents.service.ts
  - apps/backend/src/app/agents/avatar.controller.ts
  - apps/backend/src/app/agents/avatar.service.spec.ts
  - apps/backend/src/app/agents/avatar.service.ts
  - apps/backend/src/app/agents/custom-dinos.controller.ts
  - apps/backend/src/app/agents/custom-dinos.service.spec.ts
  - apps/backend/src/app/agents/custom-dinos.service.ts
  - apps/backend/src/app/agents/dino-resolver.spec.ts
  - apps/backend/src/app/agents/dino-resolver.ts
  - apps/backend/src/app/agents/dinos.controller.ts
  - apps/backend/src/app/agents/dinos/dinos.ts
  - apps/backend/src/app/agents/group-agents.service.ts
  - apps/backend/src/app/agents/model-catalogue.ts
  - apps/backend/src/app/database/schema.ts
  - apps/frontend/src/app/chat/chat.html
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/chat/custom-dino-creator.html
  - apps/frontend/src/app/chat/custom-dino-creator.ts
  - apps/frontend/src/app/chat/dino.service.spec.ts
  - apps/frontend/src/app/chat/dino.service.ts
  - infrastructure/provision-gcp.sh
  - libs/shared-types/src/lib/dino.types.ts
  - libs/ui/src/lib/dino-card/dino-card.html
  - libs/ui/src/lib/dino-card/dino-card.ts
  - libs/ui/src/lib/dino-picker/dino-picker.html
  - libs/ui/src/lib/dino-picker/dino-picker.ts
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Full-phase review covering all four plans executed in Phase 42: the custom dino CRUD
backend (42-01), avatar upload (42-02), dino resolver and backend merge (42-03), and the
frontend Custom Dino Creator UI (42-04).

The core architecture is sound — the `custom:` id prefix, server-side resolution through
`resolveDino`, the `systemPrompt`-exclusion projection (`toCustomDinoSummary`), and
catalogue-based model/tool validation are all correctly implemented. The previous 42-01
blockers (CR-01 agent loop never resolves custom dinos, CR-02 silent empty-patch UPDATE,
WR-01/WR-03 HttpException swallowing and avatarUrl XSS) are resolved: `resolveDino` now
branches on `custom:`, the empty-patch guard and `validateAvatarUrl` are in place, and
the spec file covers all four regressions.

Three new blockers remain, plus six warnings.

---

## Structural Findings (fallow)

No structural pre-pass was provided for this review.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: No server-side authentication — userId is fully client-controlled on all custom-dino endpoints

**File:** `apps/backend/src/app/agents/custom-dinos.controller.ts:36-65`
**Issue:** Every route that scopes access to a user's custom dinos accepts `userId` as a
plain query parameter (`@Query('userId')`) or in the JSON request body. There is no
middleware, guard, or session token that verifies the caller owns the supplied `userId`.
Any caller can pass an arbitrary value and read, update, or delete another user's custom
dinos — including their (server-stored) system prompts — by guessing or enumerating ids.

```
GET  /api/custom-dinos?userId=victim-id
PUT  /api/custom-dinos/custom:uuid?userId=victim-id
DEL  /api/custom-dinos/custom:uuid?userId=victim-id
```

The avatar endpoint (`POST /api/custom-dinos/avatar`) carries no userId at all, allowing
any unauthenticated caller to upload files to the public GCS bucket and incur storage and
egress costs with no rate-limit or ownership check.

**Fix:** The project uses an anonymous per-device id (no auth yet). At minimum:
1. Bind the device id server-side in a signed HTTP-only cookie or a short-lived JWT so
   the backend can verify `req.userId === cookie.deviceId` rather than trusting the body.
2. Until a cookie/token exists, document the risk explicitly in the endpoint JSDoc.
3. For the avatar endpoint, require a `userId` parameter and verify it matches a known
   device id before accepting the upload.

---

### CR-02: GCS upload never makes the object public — returns a URL that may be inaccessible

**File:** `apps/backend/src/app/agents/avatar.service.ts:72-87`
**Issue:** `AvatarService.upload()` calls `file.save(buffer, saveOptions)` where
`saveOptions` sets only `contentType`. The returned URL
`https://storage.googleapis.com/${bucket}/${objectName}` is hardcoded as if the object
is always public-read. Accessibility depends entirely on a bucket-level IAM binding
(`allUsers → roles/storage.objectViewer`) that must have been applied by the provisioning
script. If that binding is absent — on a fresh staging environment, after a bucket
recreate, or if uniform-bucket-level-access is toggled — the upload succeeds but the URL
returns HTTP 403. The caller has no way to detect this.

Separately, the GCS Node.js client does not apply `predefinedAcl: 'publicRead'` by
default even when uniform-bucket-level-access is disabled, so on buckets with legacy
per-object ACLs the object is private.

**Fix:** Set `predefinedAcl: 'publicRead'` in `saveOptions` to make the object public
unconditionally:

```typescript
const saveOptions: SaveOptions = {
  contentType: file.mimetype,
  predefinedAcl: 'publicRead',
};
```

Or call `file.makePublic()` after a successful `save()` and propagate the error as a
`BadRequestException` if it fails.

---

### CR-03: `canSave` requires non-empty `systemPrompt` in edit mode, blocking saves when the prompt is intentionally left blank

**File:** `apps/frontend/src/app/chat/custom-dino-creator.ts:79-86`
**Issue:** The template (`custom-dino-creator.html:114-131`) displays the hint "Leave
blank to keep the existing prompt" in edit mode, and the field placeholder reads "Leave
blank to keep existing prompt…". The backend `update()` correctly treats an absent
`systemPrompt` as "no change". However, `canSave` applies the same guard in both modes:

```typescript
this.systemPrompt().trim().length > 0
```

In edit mode this means the Save button stays disabled unless the user types a new system
prompt. A user who opens the edit form to change only the name or model will find Save
permanently disabled until they re-enter the server-side prompt they cannot see. The UI
promise ("leave blank to keep") is broken by the validation logic.

**Fix:**

```typescript
readonly canSave = computed(() => {
  const base =
    this.name().trim().length > 0 &&
    this.selectedModel().length > 0 &&
    !this.uploading() &&
    !this.saving();
  if (this.editing) return base;                            // systemPrompt optional in edit
  return base && this.systemPrompt().trim().length > 0;    // required in create
});
```

---

## Warnings

### WR-01: `hasPriorDinoThisRound` checks the entire transcript instead of only the current round

**File:** `apps/backend/src/app/agents/group-agents.service.ts:266`
**Issue:**

```typescript
const hasPriorDinoThisRound = state.transcript.some((m) => m.role === 'dino');
```

This scans the whole accumulated transcript across all rounds. From round 1 onwards the
flag is always `true` (some dino has spoken before), even for the very first dino
processed in the current round who has no peer turns in-round yet. The decision prompt
and `buildDirective` use this flag to encourage dinos to "build on what the prior dino
said this round" — but in rounds 2+ the "prior dino" is from a previous round, producing
confused or misdirected responses.

**Fix:** Capture the transcript length before the inner loop and check only messages
added since then:

```typescript
for (let roundIndex = 0; roundIndex < MAX_ROUNDS; roundIndex++) {
  const roundStartIdx = state.transcript.length; // capture here, before the dino loop
  // ...
  for (const dino of order) {
    const hasPriorDinoThisRound = state.transcript
      .slice(roundStartIdx)
      .some((m) => m.role === 'dino');
    // ...
  }
}
```

---

### WR-02: `FileInterceptor` has no file-size limit — entire body is buffered before validation

**File:** `apps/backend/src/app/agents/avatar.controller.ts:21`
**Issue:** `@UseInterceptors(FileInterceptor('file'))` uses the default Multer
configuration which applies no `fileSize` limit. NestJS buffers the entire multipart
body into memory before invoking `AvatarService.upload()`. The 2 MB check in
`avatar.service.ts:61` fires only after the full body is already in memory. A client
sending a 500 MB upload will exhaust server memory before any validation runs.

**Fix:** Pass Multer limits at the interceptor level:

```typescript
@UseInterceptors(
  FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 + 1 } }),
)
```

---

### WR-03: `save()` in edit mode always sends `name` even when unchanged; an empty-name input would hit a backend 400

**File:** `apps/frontend/src/app/chat/custom-dino-creator.ts:169-176`
**Issue:** The edit branch of `save()` always includes `name: this.name().trim()` in the
`UpdateCustomDinoRequest`, regardless of whether the user changed it. The `canSave` guard
blocks a save when `name` is empty, so a 400 from the backend on this path is unlikely
in practice. However, if a user clears the name field (which makes `canSave` false and
disables Save), then navigates away and back, the stale empty-name signal could get into
an inconsistent state.

More importantly, the comment "PATCH only what the form provides (D-04)" is misleading:
every visible field is always included in the PUT body regardless of what changed. If the
D-04 intent was true fine-grained patching, the implementation does not match.

**Fix:** Either remove the D-04 comment and document "always send all visible fields",
or genuinely diff against `editing` and omit fields that did not change. At minimum,
include `name` only when it has been modified.

---

### WR-04: `getDino()` silently falls back to `DEFAULT_DINO` for unknown built-in ids

**File:** `apps/backend/src/app/agents/dinos/dinos.ts:121-123`
**Issue:**

```typescript
export function getDino(id?: string): Dino {
  return DINOS.find((d) => d.id === id) ?? DEFAULT_DINO;
}
```

`resolveDino` calls `getDino(id)` for any non-`custom:` id. If the frontend sends a
stale or invalid built-in id (e.g. a dino removed from the registry), the agent silently
adopts Rexford's system prompt and toolset. The caller receives a valid-looking `Dino`
with no indication the id was not found.

**Fix:** Return `undefined` for unrecognised ids and let callers decide the fallback
explicitly:

```typescript
export function getDino(id?: string): Dino | undefined {
  return DINOS.find((d) => d.id === id);
}
```

Update `resolveDino` and any other callers that relied on the implicit fallback to
reference `DEFAULT_DINO` explicitly when they want the fallback behaviour.

---

### WR-05: `activeDinoAvatarSrc` produces a broken image path for custom dinos

**File:** `apps/frontend/src/app/chat/chat.ts:142-145`
**Issue:**

```typescript
readonly activeDinoAvatarSrc = computed(() => {
  const id = this.activeDinoId();
  return id ? `/spino/dinos/avatars/${id}.png` : '/spino/spino-avatar.png';
});
```

For a custom dino with `id = 'custom:abc123'` this produces
`/spino/dinos/avatars/custom:abc123.png`, which does not exist as a static asset. The
active-dino header (`chat.html:511`) uses this signal, so custom dinos always show a
broken image. The `avatarUrl` field is available on `activeDino()` (a `DinoSummary`
containing `avatarUrl?: string`) but is never consulted.

**Fix:**

```typescript
readonly activeDinoAvatarSrc = computed(() => {
  const dino = this.activeDino();
  if (!dino) return '/spino/spino-avatar.png';
  return dino.avatarUrl ?? `/spino/dinos/avatars/${dino.id}.png`;
});
```

---

### WR-06: `loadDinos()` in `DinoService` is an unmanaged fire-and-forget subscription that can race

**File:** `apps/frontend/src/app/chat/dino.service.ts:39-52`
**Issue:** `loadDinos()` calls `this.http.get(...).subscribe(...)` inline without
returning or storing the subscription. If called multiple times quickly (e.g. after
create, then after delete), multiple in-flight requests race; the last HTTP response to
arrive wins and may overwrite a fresher result with a staler one. The ngrx effect uses
`fetchDinos()` (returns an `Observable`) with proper `switchMap` cancellation — the
`loadDinos()` imperative path bypasses this protection.

**Fix:** Remove `loadDinos()` and have all callers dispatch `DinoActions.loadDinos`
through the store so the ngrx effect and its `switchMap` handle cancellation. If
`loadDinos()` must remain for non-store callers, return the subscription or switch to
`switchMap` internally.

---

## Info

### IN-01: `FormsModule` imported in `CustomDinoCreator` but never used

**File:** `apps/frontend/src/app/chat/custom-dino-creator.ts:11,41`
**Issue:** `FormsModule` appears in the `imports` array of the standalone `CustomDinoCreator`
component. The template uses only signal-driven one-way binding (`[value]=` / `(input)=`)
and never uses `ngModel` or `ngForm`. The import is dead weight.

**Fix:** Remove `FormsModule` from the `imports` array.

---

### IN-02: `infrastructure/provision-gcp.sh` embeds the database password in a Secret Manager secret but offers no rotation path

**File:** `infrastructure/provision-gcp.sh:145-146`
**Issue:** `DATABASE_URL` is assembled from `DB_PASSWORD` and stored as a plaintext Secret
Manager entry. The password is also present in the shell environment and history during
the run. No rotation mechanism is scripted; rotating the password requires updating both
the Cloud SQL user and the Secret Manager secret manually.

**Fix:** (Operational guidance.) After running the script, unset `DB_PASSWORD` from the
shell environment (`unset DB_PASSWORD`) and clear shell history. Consider storing the DB
password as a separate secret distinct from the full connection string to allow
independent rotation.

---

### IN-03: `customDinos.updatedAt` declares `$onUpdate` in the schema but the service also sets it manually

**File:** `apps/backend/src/app/database/schema.ts:119` and
`apps/backend/src/app/agents/custom-dinos.service.ts:169`
**Issue:** The `updatedAt` column is declared with `.$onUpdate(() => new Date())`, which
should automatically populate the field on any Drizzle `UPDATE`. The `update()` method in
`CustomDinoService` also explicitly spreads `updatedAt: new Date()` into the `.set()`
call. The double-set is harmless but redundant; the schema declaration gives a false
impression that `updatedAt` is auto-managed, making the explicit set confusing to future
maintainers.

**Fix:** Remove `updatedAt: new Date()` from the `.set()` call in
`custom-dinos.service.ts:169` and rely on the Drizzle `$onUpdate` hook alone.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
