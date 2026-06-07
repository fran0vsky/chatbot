# Phase 35 — Deferred / Out-of-Scope Items

## Frontend unit-test runner crash (pre-existing, environment-wide)

`npx nx test frontend` (`@angular/build:unit-test`, Vitest) fails at **bundle
generation**, before any test executes:

```
X [ERROR] Cannot destructure property 'pos' of 'file.referencedFiles[index]'
as it is undefined. [plugin angular-compiler]
```

- Reproduced with the new `groupchat.service.spec.ts` **removed** — the crash is
  not caused by Plan 35-02 changes. It is an Angular/esbuild compiler bug in this
  Windows environment (matches the recorded "Windows lowercase-drive env breaks
  Nx & Vitest" finding).
- Additionally, the pre-existing specs (`chat.service.spec.ts`,
  `voice-recognition.service.spec.ts`) still use the `jest.*` namespace and rely
  on missing DOM lib types, which the Vitest (`vitest/globals`) config does not
  provide — so the suite could not have been green here regardless.

**Disposition:** out of scope for Plan 35-02 (tooling/environment, not this
plan's code). The new `groupchat.service.spec.ts` was authored against the
correct Vitest (`vi`) API and is type-sound against the production sources; it
will run once the frontend test toolchain is repaired (or run on the CI/Linux
box). Recommend a dedicated GSD task to fix the frontend Vitest pipeline and
migrate the legacy `jest.*` specs to `vi.*`.

## Pre-existing `@chatbot/ui` lint module-boundary errors

`npx nx lint ui` reports `@nx/enforce-module-boundaries` errors
("Buildable libraries cannot import or export from non-buildable libraries") for
every ui component importing `@org/shared-types` (history-panel, skill-manager,
tool-call-bubble, group-response, etc.). `group-response.ts` already imported
`@org/shared-types` before this plan, so no new violation was introduced. The
authoritative compile gate `npx nx build frontend` (which builds `ui`) is green.

**Disposition:** out of scope — pre-existing workspace lint configuration issue.
