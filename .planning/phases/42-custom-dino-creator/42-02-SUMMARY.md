---
phase: 42-custom-dino-creator
plan: "02"
subsystem: backend/avatar-upload
tags: [gcs, multipart, avatar, custom-dino, infra]
dependency_graph:
  requires: [42-01]
  provides: [avatar-upload-endpoint]
  affects: [custom-dino-creator-ui]
tech_stack:
  added: ["@google-cloud/storage ^7.16.0", "@types/multer ^1.4.12"]
  patterns: [ADC-via-VM-scopes, lazy-GCS-client, graceful-degradation, thin-controller]
key_files:
  created:
    - apps/backend/src/app/agents/avatar.service.ts
    - apps/backend/src/app/agents/avatar.controller.ts
    - apps/backend/src/app/agents/avatar.service.spec.ts
  modified:
    - apps/backend/src/app/agents/agents.module.ts
    - infrastructure/provision-gcp.sh
    - .planning/INFRASTRUCTURE.md
    - package.json
decisions:
  - "Lazy Storage client construction (never at module load) so an unset AVATAR_BUCKET never crashes boot"
  - "Object path avatars/<uuid>.<ext>; public URL via storage.googleapis.com (bucket is public-read via uniform access — no per-object ACL)"
  - "roles/storage.objectAdmin added to VM SA (not CI SA) for runtime writes via ADC"
  - "No static-website config on the avatars bucket (not an SPA)"
metrics:
  duration: ~25min
  completed: "2026-06-19"
  tasks_completed: 5
  files_changed: 7
---

# Phase 42 Plan 02: Avatar Upload Endpoint Summary

**One-liner:** Multipart `POST /api/custom-dinos/avatar` endpoint streaming validated images to a public-read GCS bucket via ADC, returning the public URL for storage in `custom_dinos.avatarUrl`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GCS + multer dependencies | dbd5356 | package.json, package-lock.json |
| 2 | AvatarService — validate + upload to GCS | 8891e21 | avatar.service.ts |
| 3 | AvatarController + module wiring | 2983bf5 | avatar.controller.ts, agents.module.ts |
| 4 | Unit tests — avatar validation + degradation | 5717a2a | avatar.service.spec.ts |
| 5 | Provision avatars bucket + objectAdmin grant + docs | 204bb26 | provision-gcp.sh, INFRASTRUCTURE.md |

## Deliverables

- **`POST /api/custom-dinos/avatar`** (multipart, single `file` field) — validates `image/*` mimetype and `<= 2 MB`, uploads to GCS, returns `{ url }` as the public `https://storage.googleapis.com/<AVATAR_BUCKET>/avatars/<uuid>.<ext>` URL.
- **Graceful degradation** — when `AVATAR_BUCKET` is unset, returns HTTP 400 "avatar upload is not configured"; the backend still builds and boots without GCS.
- **Application Default Credentials** — `Storage` client constructed lazily inside `upload()`; no key file; the VM's `--scopes=cloud-platform` covers authentication.
- **`provision-gcp.sh`** updated to create a public-read uniform-access avatars bucket and grant `roles/storage.objectAdmin` to the VM service account.
- **`INFRASTRUCTURE.md`** documents the bucket, IAM, public URL pattern, and `AVATAR_BUCKET` env contract.

## Verification

- `npx nx lint @org/backend` — PASSED
- `npx nx build @org/backend` — PASSED (webpack compiled successfully)
- `npx nx test @org/backend` — PASSED (16 files, 182 tests; up from 175 in Plan 01)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Minor Observations

- The test for "exactly 2 MB passes size guard" necessarily triggers a GCS call (which logs an ADC error in the test run) — this is expected behavior; the test confirms the size validation branch is clear, not that the GCS call succeeds. This matches the plan's intent ("do not invoke real GCS" for branch validation tests; the boundary test is a separate assertion).

## Known Stubs

None — the endpoint is fully implemented. The upload path requires a live GCS bucket to return a real URL; that provisioning step is documented in INFRASTRUCTURE.md and provision-gcp.sh.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's `<threat_model>`:
- T-42-02-01 mitigated: `image/*` mimetype + 2 MB cap enforced before any GCS write.
- T-42-02-02 accepted: same anonymous-device model; 2 MB cap bounds per-object cost.
- T-42-02-03 mitigated: ADC via VM scopes — no key file committed.
- T-42-02-04 mitigated: lazy Storage client; unset AVATAR_BUCKET → clear 400, never a crash.

## Self-Check: PASSED

- [x] `apps/backend/src/app/agents/avatar.service.ts` — exists
- [x] `apps/backend/src/app/agents/avatar.controller.ts` — exists
- [x] `apps/backend/src/app/agents/avatar.service.spec.ts` — exists
- [x] `apps/backend/src/app/agents/agents.module.ts` — modified (AvatarService + AvatarController registered)
- [x] `infrastructure/provision-gcp.sh` — modified (AVATAR_BUCKET variable, bucket block, objectAdmin grant)
- [x] `.planning/INFRASTRUCTURE.md` — modified (Avatar Storage section + inventory row)
- [x] All commits exist: dbd5356, 8891e21, 2983bf5, 5717a2a, 204bb26
