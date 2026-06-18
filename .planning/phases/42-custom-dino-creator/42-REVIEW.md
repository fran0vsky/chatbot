---
phase: 42-custom-dino-creator
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - libs/shared-types/src/lib/dino.types.ts
  - apps/backend/src/app/database/schema.ts
  - apps/backend/src/app/agents/custom-dinos.service.ts
  - apps/backend/src/app/agents/custom-dinos.controller.ts
  - apps/backend/src/app/agents/model-catalogue.ts
  - apps/backend/src/app/agents/agents.module.ts
  - apps/backend/src/app/agents/custom-dinos.service.spec.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase delivers the persistence layer and REST API for user-authored custom dinos: a Drizzle table (`customDinos`), a CRUD service (`CustomDinoService`) with graceful DB-null degradation and server-side model/tool validation, a thin NestJS controller, and a curated model catalogue. The overall shape is sound — the graceful-degradation pattern is consistent, the `systemPrompt` allowlist projection prevents leaks, and the `custom:` prefix strategy is clean.

Two blockers were found:

1. **The chat path never resolves custom dinos.** `AgentsService.streamAgent` always calls the built-in `getDino()`. A `dinoId` beginning with `custom:` falls through to the built-in fallback and produces a wrong dino — the entire feature is silent dead code at the user-facing level.
2. **`update()` silently succeeds when no editable field is supplied**, touching only `updatedAt`. The `.set({updatedAt: new Date()})` path issues a real UPDATE that matches by `(id, userId)` but changes nothing meaningful. Callers receive a non-null `CustomDino` and have no way to know the update was a no-op triggered by an empty body.

Four warnings and two info items follow.

---

## Critical Issues

### CR-01: Custom dinos are never resolved in the chat agent loop

**File:** `apps/backend/src/app/agents/agents.service.ts:140`
**Issue:** `streamAgent` always calls `getDino(dinoId)` from the built-in registry. `getDino` falls back to `DEFAULT_DINO_ID` for any unknown id (including `custom:*` ids), so a user who selects their custom dino actually chats with the default built-in dino. `CustomDinoService.getById` is never called from the agent path. The service doc-comment at line 31–32 of `custom-dinos.service.ts` describes the branching intent (`id.startsWith('custom:') → DB lookup`) but it was never wired. The feature's CRUD and persistence work, but it cannot be exercised end-to-end.

**Fix:** Inject `CustomDinoService` into `AgentsService` and branch on the prefix before calling `getDino`:

```typescript
// agents.service.ts — in streamAgent, replace:
const dino = dinoId ? getDino(dinoId) : undefined;

// with:
let dino: Dino | undefined;
if (dinoId) {
  if (dinoId.startsWith('custom:')) {
    const custom = await this.customDinoService.getById(dinoId, userId);
    if (custom) {
      // Map CustomDino → Dino shape expected by the agent loop
      dino = {
        id: custom.id,
        name: custom.name,
        species: custom.species ?? '',
        persona: custom.persona ?? '',
        blurb: custom.blurb ?? '',
        specialty: 'Custom dino',
        model: custom.model,
        systemPrompt: custom.systemPrompt,
        toolNames: custom.toolNames,
        accent: custom.accent,
      };
    }
  } else {
    dino = getDino(dinoId);
  }
}
```

`CustomDinoService` must also be exported from `AgentsModule` (or moved to a shared module) and injected into `AgentsService`.

---

### CR-02: `update()` issues a silent no-op UPDATE when the request body is empty

**File:** `apps/backend/src/app/agents/custom-dinos.service.ts:141–158`
**Issue:** When `UpdateCustomDinoRequest` arrives with all fields absent (an empty JSON object `{}`), every conditional spread is skipped and Drizzle executes `UPDATE custom_dinos SET updated_at = $1 WHERE id = $2 AND user_id = $3`. The query succeeds, `returning()` returns the unchanged row, and the caller gets a non-null `CustomDino` with a bumped `updatedAt`. The client has no signal that nothing was changed. More importantly, this can be triggered by a misbehaving client sending `PUT /custom-dinos/:id?userId=...` with `{}` — it silently "touches" arbitrary dinos owned by the userId without any validation error.

**Fix:** Guard at the top of the `update` method and reject empty-patch requests before touching the DB:

```typescript
async update(publicId: string, userId: string | undefined, req: UpdateCustomDinoRequest): Promise<CustomDino | null> {
  // ... existing null/prefix guards ...

  const hasAnyField = Object.keys(req).some((k) => (req as Record<string, unknown>)[k] !== undefined);
  if (!hasAnyField) {
    throw new BadRequestException('update request must include at least one field');
  }

  // ... rest of validation + DB update ...
}
```

---

## Warnings

### WR-01: `create()` silently swallows validation errors thrown inside the `try` block

**File:** `apps/backend/src/app/agents/custom-dinos.service.ts:48–75`
**Issue:** `this.validate()` is called before the `try` block, so its `BadRequestException` propagates correctly. However, if `validate()` is ever moved or a future developer adds input-dependent logic inside the try block that throws `BadRequestException`, the outer `catch (err)` will swallow it and return `null`. The catch clause logs a generic message and returns null without distinguishing between infra errors (transient, silent) and validation errors (client errors, should 400). The same pattern exists in `update()` at line 160–162.

**Fix:** Re-throw `BadRequestException` (or any `HttpException`) inside the catch so validation errors always surface:

```typescript
} catch (err) {
  if (err instanceof BadRequestException) throw err;
  this.logger.error(`create failed: ${err instanceof Error ? err.message : String(err)}`);
  return null;
}
```

Apply the same guard in `update()`.

---

### WR-02: `PUT /custom-dinos/:id` takes `userId` as a query parameter

**File:** `apps/backend/src/app/agents/custom-dinos.controller.ts:45–52`
**Issue:** The `DELETE` and `PUT` routes accept `userId` via `@Query('userId')`. For `DELETE` a query param is acceptable. For `PUT` (which has a request body), passing `userId` as a query parameter is inconsistent and fragile — HTTP clients and proxies may strip or log query strings differently, and the body is the appropriate place for authenticated or semi-authenticated identity. This also creates a footgun: a caller might send `userId` in the body and wonder why the ownership check fails.

**Fix:** Accept `userId` from the request body instead. Update `UpdateCustomDinoRequest` to include an optional `userId` field for the controller to extract, or add a dedicated `userId` body field and keep `UpdateCustomDinoRequest` unchanged by reading it separately:

```typescript
@Put('custom-dinos/:id')
update(
  @Param('id') id: string,
  @Body() body: UpdateCustomDinoRequest & { userId?: string },
): Promise<CustomDino | null> {
  return this.customDinoService.update(id, body.userId, body);
}
```

---

### WR-03: `avatarUrl` is stored and returned without any URL validation

**File:** `apps/backend/src/app/agents/custom-dinos.service.ts:61` and `apps/backend/src/app/agents/custom-dinos.service.ts:147`
**Issue:** `avatarUrl` is accepted, trimmed, and persisted without checking that it is a valid URL. A caller can store arbitrary strings (including `javascript:` URIs or `data:` URIs). When the frontend renders this value as an `<img src>` without further sanitisation, a `data:` URI is harmless, but a `javascript:` URI in an `<a href>` context (or a malformed URL passed to `new URL()` elsewhere) could cause issues. This is a stored-XSS vector if the frontend ever sets `href` or `innerHTML` from `avatarUrl` without sanitising.

**Fix:** Add a URL format check to the `validate()` method and inline in `update()`:

```typescript
private validateAvatarUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('avatarUrl must use http or https');
    }
  } catch {
    throw new BadRequestException('avatarUrl must be a valid absolute URL');
  }
}
```

---

### WR-04: Drizzle `updatedAt` is not updated automatically — relies on application-layer `new Date()`

**File:** `apps/backend/src/app/database/schema.ts:119` and `apps/backend/src/app/agents/custom-dinos.service.ts:154`
**Issue:** The `updatedAt` column uses `.defaultNow()` (initial insert default), but there is no `$onUpdate` hook. The service manually passes `updatedAt: new Date()` in the `.set()` call. If a future developer adds a new update path or bulk-import and omits this line, `updatedAt` will silently retain its old value. The `sessions` table (line 16) has the same pattern — it is an existing project-wide gap — but the new `customDinos` table repeats it.

**Fix:** Use Drizzle's `$onUpdate` to make the timestamp automatic:

```typescript
updatedAt: timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date()),
```

Then the manual `updatedAt: new Date()` in the service `.set()` call can be removed safely.

---

## Info

### IN-01: `toCustomDinoSummary` is public but only used within the service or tests — consider narrowing visibility

**File:** `apps/backend/src/app/agents/custom-dinos.service.ts:189`
**Issue:** `toCustomDinoSummary` is declared `public` (no modifier = public in TypeScript classes) and is used directly in tests. However, the method is a projection helper that belongs to the service's internal responsibilities. Making it part of the public API surface means callers outside the module can invoke it with raw `CustomDinoRow` objects they obtained from elsewhere, bypassing the service's scoping checks. In the current codebase it is only called in tests, but as the codebase grows other controllers may call it directly.

**Fix:** If the projection is only needed for the dino-picker list, consider returning already-projected objects from `list()` (or a new `listSummaries()` method) and making `toCustomDinoSummary` private. If it must remain public for use by other services, document the expectation explicitly.

---

### IN-02: `CustomDinoService` is not exported from `AgentsModule`

**File:** `apps/backend/src/app/agents/agents.module.ts:15`
**Issue:** `exports: [AgentsService]` — `CustomDinoService` is not exported. This is not currently a problem (nothing outside `AgentsModule` needs it yet), but once CR-01 is fixed by injecting it into `AgentsService`, the injection will work because both are in the same module. If any other module (e.g. a future `DinosModule` or gateway) needs to resolve custom dinos, it will require an export. Low risk now but worth noting.

**Fix:** Add `CustomDinoService` to the `exports` array if/when it is needed by sibling modules:

```typescript
exports: [AgentsService, CustomDinoService],
```

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
