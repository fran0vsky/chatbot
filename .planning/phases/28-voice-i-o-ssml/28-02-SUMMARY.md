---
phase: 28-voice-i-o-ssml
plan: 02
subsystem: ui
tags: [voice, stt, web-speech-api, angular, signals, ngrx, dictation]

# Dependency graph
requires:
  - phase: 28-01
    provides: VoiceSynthesisService + voice/ directory + chat.ts voice wiring patterns
provides:
  - VoiceRecognitionService (providedIn:root) with listening/transcript/supported signals + start()/stop()
  - Functional mic button on InputComposer with sttSupported/listening inputs and micToggle output
  - ChatComponent wiring: transcript -> draft live via effect(), trim + max-length cap, never auto-submit
  - Phase 29 reuse seam: VoiceRecognitionService is root-scoped and ready for voice assistant
affects: [29-voice-dino-assistant]

# Tech tracking
tech-stack:
  added:
    - "@types/dom-speech-recognition@0.0.11 (devDependency via npm --legacy-peer-deps)"
  patterns:
    - "NgZone.run() wrapping of SpeechRecognition callbacks — required for OnPush re-render in zone-based Angular"
    - "Feature-detect SpeechRecognition || webkitSpeechRecognition; hide mic entirely when absent (Firefox D-09)"
    - "Presentational InputComposer: no service injection; parent drives start/stop via @Input() + @Output()"
    - "effect() in ngOnInit mirrors voiceRec.transcript() -> inputComposerRef.draft; never calls submit()"
    - "MAX_DRAFT_LENGTH constant (10,000 chars) + trim: transcript treated as untrusted input (T-28-03 / V5)"

key-files:
  created:
    - apps/frontend/src/app/voice/voice-recognition.service.ts
    - apps/frontend/src/app/voice/voice-recognition.service.spec.ts
  modified:
    - apps/frontend/tsconfig.app.json
    - package.json
    - package-lock.json
    - libs/ui/src/lib/input-composer/input-composer.ts
    - libs/ui/src/lib/input-composer/input-composer.html
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html

key-decisions:
  - "VoiceRecognitionService uses inject(NgZone) pattern (not constructor injection) to satisfy @angular-eslint/prefer-inject"
  - "window cast to Record<string,unknown> instead of any to satisfy @typescript-eslint/no-explicit-any throughout service and spec"
  - "MAX_DRAFT_LENGTH = 10,000 chars introduced — typed input has no cap, so this is the first explicit bound (T-28-03 security)"
  - "Both main-chat InputComposer instances (welcome-state and message-state) receive mic bindings; @ViewChild matches first"
  - "tsconfig.app.json explicit types[] updated with 'dom-speech-recognition' (array was non-empty, auto-include does not apply)"

requirements-completed: [VOX-03]

# Metrics
duration: 60min
completed: 2026-06-01
---

# Phase 28 Plan 02: Voice Dictation (VOX-03) Summary

**VoiceRecognitionService (NgZone-wrapped, signal-based) + functional mic button on InputComposer: speak -> draft -> manual send; mic hidden in Firefox**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-06-01T00:00:00Z
- **Completed:** 2026-06-01T00:55:00Z
- **Tasks:** 4 of 5 automated (Task 5 is human manual verification — pending)
- **Files modified:** 8

## Accomplishments

- `@types/dom-speech-recognition@0.0.11` installed; `tsconfig.app.json` types array updated so SpeechRecognition types resolve in frontend
- `VoiceRecognitionService` (VOX-03): `providedIn:'root'`, signals `listening`/`transcript`/`supported`, `start()`/`stop()`, all recognition callbacks wrapped in `NgZone.run()` for OnPush re-render, `continuous=false` for single-utterance dictation, double-start guard via `listening` signal
- `voice-recognition.service.spec.ts`: covers unsupported browser (supported=false, start no-op), supported browser (start sets listening+calls recognition.start(), interim transcript, final isFinal drops listening, double-start guard, onend, onerror)
- `InputComposer` mic button: `@Input() sttSupported` gates `@if` visibility; `@Input() listening` drives accent color + `animate-ping` pulse ring + aria-label switching (Start/Stop dictation) + `aria-pressed`; `@Output() micToggle` emits void; privacy title tooltip; stays presentational (no service injection)
- `ChatComponent` wiring: `VoiceRecognitionService` injected; `@ViewChild(InputComposer)` for draft access; `effect()` mirrors `voiceRec.transcript()` to `inputComposerRef.draft` live (sanitized: `trim().slice(0, MAX_DRAFT_LENGTH)`); `onMicToggle()` handler; `[sttSupported]`/`[listening]`/`(micToggle)` bound on both chat-view `InputComposer` instances; never calls `submit()`

## Task Commits

1. **Task 1: Install @types/dom-speech-recognition** - `c30d252` (chore)
2. **Task 2: VoiceRecognitionService (VOX-03)** - `d27da48` (feat)
3. **Task 3: Functional mic button on InputComposer** - `8374410` (feat)
4. **Task 4: Wire dictation into ChatComponent draft** - `be18c7b` (feat)

## Files Created/Modified

- `apps/frontend/src/app/voice/voice-recognition.service.ts` — VoiceRecognitionService (VOX-03); NgZone-wrapped callbacks; providedIn:root
- `apps/frontend/src/app/voice/voice-recognition.service.spec.ts` — 9 unit tests covering support-detection, start/guard, interim/final, onend/onerror
- `apps/frontend/tsconfig.app.json` — types[] includes "dom-speech-recognition"
- `package.json` — @types/dom-speech-recognition@^0.0.11 devDependency
- `libs/ui/src/lib/input-composer/input-composer.ts` — @Input() sttSupported/listening; @Output() micToggle
- `libs/ui/src/lib/input-composer/input-composer.html` — @if(sttSupported) mic button with pulse ring, state-driven aria-label/aria-pressed
- `apps/frontend/src/app/chat/chat.ts` — VoiceRecognitionService injected; effect() transcript->draft mirror; onMicToggle(); MAX_DRAFT_LENGTH
- `apps/frontend/src/app/chat/chat.html` — [sttSupported]/[listening]/(micToggle) on both InputComposer instances

## Decisions Made

- `inject(NgZone)` over constructor injection to satisfy `@angular-eslint/prefer-inject` lint rule.
- `window as Record<string, unknown>` over `(window as any)` to satisfy `@typescript-eslint/no-explicit-any` in both service and spec.
- `MAX_DRAFT_LENGTH = 10_000` introduced as the first explicit bound on draft length — typed input has no cap, so this is the security boundary for untrusted voice transcript (T-28-03 / ASVS V5).
- `tsconfig.app.json` `types` array was explicitly empty (`[]`) — auto-include does not apply; `"dom-speech-recognition"` added explicitly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] inject() function over constructor injection**
- **Found during:** Task 2 (lint)
- **Issue:** `@angular-eslint/prefer-inject` requires `inject()` function over constructor parameter injection in Angular 21.
- **Fix:** Changed `constructor(private readonly zone: NgZone)` to `private readonly zone = inject(NgZone)` with an empty `constructor()`.
- **Files modified:** apps/frontend/src/app/voice/voice-recognition.service.ts
- **Committed in:** d27da48 (Task 2 commit)

**2. [Rule 1 - Bug] no-explicit-any violations in service and spec**
- **Found during:** Task 2 (lint)
- **Issue:** `(window as any).SpeechRecognition` pattern raises `@typescript-eslint/no-explicit-any`.
- **Fix:** Cast `window` to `Record<string, unknown>` and access properties by string key; spec uses the same pattern for mock installation/cleanup.
- **Files modified:** voice-recognition.service.ts, voice-recognition.service.spec.ts
- **Committed in:** d27da48 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (lint rule compliance)
**Impact on plan:** No behavior change — lint compliance only.

## Known Stubs

None — the dictation flow is wired end-to-end: mic click → start() → transcript signal → effect() → draft fill → user reviews and sends manually.

## Issues Encountered

- `npm exec nx test frontend` crashes with pre-existing TypeScript `referencedFiles` bug (documented in STATE.md — "reproduces on pre-NgRx baseline too"). This is not introduced by this plan. The spec is correctly structured and covers all required scenarios; it cannot be verified via the automated runner in this environment.
- Task 5 (manual Chrome/Firefox smoke test) is `type="manual"` `autonomous="false"` — requires human verification. Pending user action.

## User Setup Required for Task 5 (Manual Verification)

In **Chrome** (localhost: `npx nx serve frontend`):
1. Open the app, select a dino, open a chat.
2. Click the mic button — browser should prompt for microphone permission.
3. Grant permission; speak a sentence (e.g. "Hello, how are you today?").
4. Confirm interim words appear live in the composer draft while speaking.
5. Confirm the final transcript remains in the draft WITHOUT auto-sending.
6. Confirm the mic button shows the accent pulse ring while active and returns to idle.
7. Click the mic while listening — confirm it stops.
8. Type a very long string via dictation (or paste into draft) — confirm it is capped at 10,000 chars.

In **Firefox**:
1. Open the same app.
2. Confirm the mic button is absent (no broken/greyed-out mic — the button should not appear at all).
3. Confirm the composer otherwise works normally for typed input.

## Threat Flags

No new threat surface beyond the plan's T-28-03, T-28-04, T-28-05 (all within plan scope).

- T-28-03 (Tampering via voice transcript) — **mitigated**: trim + MAX_DRAFT_LENGTH cap applied at `effect()` before draft assignment.
- T-28-04 (Audio to browser cloud ASR) — **accepted**: privacy tooltip on mic button.
- T-28-05 (Mic permission) — **accepted**: browser handles native permission prompt; HTTPS documented in code comment.

---

## Self-Check

Verifying claims before finalizing...

## Self-Check: PASSED

All task commits verified:
- `c30d252` in git log (Task 1 — chore)
- `d27da48` in git log (Task 2 — feat)
- `8374410` in git log (Task 3 — feat)
- `be18c7b` in git log (Task 4 — feat)

All listed files exist on disk.

---
*Phase: 28-voice-i-o-ssml*
*Completed: 2026-06-01*
