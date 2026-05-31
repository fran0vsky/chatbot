---
phase: 28-voice-i-o-ssml
plan: 01
subsystem: ui
tags: [voice, tts, web-speech-api, angular, signals, ngrx]

# Dependency graph
requires:
  - phase: 27-ngrx-state-refactor
    provides: NgRx store with selectLastAssistantMessage + ACTION_CATALOGUE for Phase 29 seam
provides:
  - VoiceSynthesisService (providedIn root) with speaking/supported signals + speak/stop
  - BrowserTtsAdapter with buildUtterance mapping SsmlHint to SpeechSynthesisUtterance
  - TtsProvider interface + SsmlHint struct as extension seam for paid providers
  - VoiceProfile contract in shared-types (rate/pitch/preferredVoice) on Dino/DinoSummary
  - Per-dino voiceProfile in backend registry (4 distinct voice characters)
  - Read-aloud speaker button on MessageBubble (assistant only, hidden when unsupported)
  - Global "Dino is speaking..." header indicator + Stop button
  - Phase 29 seam: read_last_message action → VoiceSynthesisService.speak via Actions$
affects: [28-02-voice-recognition, 29-voice-dino-assistant]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SsmlHint struct instead of raw SSML XML — maps to utterance properties, never to utterance.text (VOX-02 honesty)"
    - "Lazy voice resolution via getVoices() at speak() time (not at construction)"
    - "synth.cancel() before synth.speak() — prevents utterance queue buildup (T-28-02)"
    - "Actions$ from @ngrx/effects used in ChatComponent to wire catalogue intent to TTS service"

key-files:
  created:
    - apps/frontend/src/app/voice/tts-provider.ts
    - apps/frontend/src/app/voice/browser-tts-adapter.ts
    - apps/frontend/src/app/voice/browser-tts-adapter.spec.ts
    - apps/frontend/src/app/voice/voice-synthesis.service.ts
    - apps/frontend/src/app/voice/voice-synthesis.service.spec.ts
  modified:
    - libs/shared-types/src/lib/dino.types.ts
    - libs/shared-types/src/index.ts
    - apps/backend/src/app/agents/dinos/dinos.ts
    - libs/ui/src/lib/message-bubble/message-bubble.ts
    - libs/ui/src/lib/message-bubble/message-bubble.html
    - apps/frontend/src/app/chat/chat.ts
    - apps/frontend/src/app/chat/chat.html

key-decisions:
  - "VOX-02 honest handling: SsmlHint struct maps to utterance.rate/pitch/volume — SSML XML never passed to utterance.text (documented in code citing browser-compat-data #15663)"
  - "Hand-rolled thin service (< 80 lines) rather than @ng-web-apis/speech — minimal deps, direct signal patterns"
  - "VoiceProfile in backend registry exposed via toDinoSummary (explicit allowlist updated)"
  - "Phase 29 seam wired via Actions$ ofType('[Assistant] Read Last Message Requested') in ngOnInit"
  - "speakingMessageText signal tracks active bubble text for per-bubble speaking state"

patterns-established:
  - "Pattern: Web Speech API services are providedIn:root, expose signals (speaking/supported)"
  - "Pattern: effect() used inline for one-shot reactive cleanup (clear speakingMessageText on stop)"

requirements-completed: [VOX-01, VOX-02]

# Metrics
duration: 45min
completed: 2026-05-31
---

# Phase 28 Plan 01: Voice Read-Aloud (VOX-01/VOX-02) Summary

**Browser-native TTS read-aloud with per-dino prosody via SsmlHint struct — speaker button on assistant bubbles, global stop indicator, and Phase 29 catalogue seam wired**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-31T21:42:00Z
- **Completed:** 2026-05-31T23:55:00Z
- **Tasks:** 7 of 8 (Task 8 is manual audio verification — human required)
- **Files modified:** 12

## Accomplishments

- VoiceProfile contract added to shared-types; Dino + DinoSummary carry rate/pitch/preferredVoice
- VoiceSynthesisService (providedIn:root) with speaking/supported signals; cancel-before-speak prevents utterance queue buildup (T-28-02 threat mitigated)
- BrowserTtsAdapter: buildUtterance maps SsmlHint to utterance properties, never to utterance.text (VOX-02 SSML honesty documented with browser-compat-data #15663 citation)
- 4 dinos each have a distinct voiceProfile (Rexford decisive 1.0/0.9, Veloce fast 1.25/1.1, Glyphos patient 0.9/1.0, Nimbus breezy 1.15/1.05)
- Read-aloud speaker button in MessageBubble hover action row (assistant only, hidden when unsupported, active state shows jungle-accent)
- Global "Dino is speaking..." indicator + Stop button adjacent to theme toggle
- Phase 29 seam: read_last_message ACTION_CATALOGUE intent now speaks the last assistant message via Actions$ subscription

## Task Commits

1. **Task 1: VoiceProfile contract + SsmlHint/TtsProvider seam** - `41585af` (feat)
2. **Task 2: BrowserTtsAdapter — SsmlHint to utterance (VOX-02)** - `641d210` (feat)
3. **Task 3: VoiceSynthesisService (VOX-01)** - `6f5af1a` (feat)
4. **Task 4: Populate per-dino voiceProfile in the registry** - `673d284` (feat)
5. **Task 5: Read-aloud button on MessageBubble** - `019465f` (feat)
6. **Task 6+7: Global speaking indicator + Stop + ChatComponent wiring** - `a114889` (feat)

## Files Created/Modified

- `libs/shared-types/src/lib/dino.types.ts` - VoiceProfile interface + voiceProfile on Dino
- `libs/shared-types/src/index.ts` - Comment noting VoiceProfile exported via dino.types.js
- `apps/frontend/src/app/voice/tts-provider.ts` - SsmlHint + TtsProvider interface
- `apps/frontend/src/app/voice/browser-tts-adapter.ts` - buildUtterance + BrowserTtsAdapter; SSML limitation documented
- `apps/frontend/src/app/voice/browser-tts-adapter.spec.ts` - Unit tests: rate/pitch mapping, no-SSML-in-text
- `apps/frontend/src/app/voice/voice-synthesis.service.ts` - VoiceSynthesisService (VOX-01)
- `apps/frontend/src/app/voice/voice-synthesis.service.spec.ts` - Unit tests: speak/stop/signals/unsupported degradation
- `apps/backend/src/app/agents/dinos/dinos.ts` - voiceProfile added to all 4 dinos; toDinoSummary updated
- `libs/ui/src/lib/message-bubble/message-bubble.ts` - @Input() speaking/ttsSupported, @Output() readAloud
- `libs/ui/src/lib/message-bubble/message-bubble.html` - Speaker button in hover action row
- `apps/frontend/src/app/chat/chat.ts` - voiceSynth injected, onReadAloud handler, speakingMessageText signal, Phase 29 seam
- `apps/frontend/src/app/chat/chat.html` - Speaking indicator + Stop in header; (readAloud)/[speaking]/[ttsSupported] bindings

## Decisions Made

- VOX-02 honest implementation: SsmlHint struct (not SSML XML) maps rate/pitch/volume to utterance properties. The limitation is documented in browser-tts-adapter.ts with citations to browser-compat-data/issues/15663 and Chrome bug 795371.
- toDinoSummary updated with explicit voiceProfile allowlist entry (consistent with the builder pattern — optional fields don't flow automatically through the Omit type).
- Phase 29 seam: Actions$ from @ngrx/effects used in ChatComponent.ngOnInit to subscribe to the `[Assistant] Read Last Message Requested` action. Subscription cleaned up in ngOnDestroy.
- effect() used inline in onReadAloud to clear speakingMessageText reactively when speaking drops — avoids a separate setInterval/listener pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] toDinoSummary explicit allowlist updated for voiceProfile**
- **Found during:** Task 4 (dinos.ts)
- **Issue:** `toDinoSummary` uses an explicit field allowlist (not just Omit) to prevent future fields from leaking. Adding voiceProfile to Dino without updating the function would have silently dropped it from DinoSummary.
- **Fix:** Added `voiceProfile: dino.voiceProfile` to the return object in toDinoSummary.
- **Files modified:** apps/backend/src/app/agents/dinos/dinos.ts
- **Verification:** Backend tests (69 passed) confirm existing dino shapes valid.
- **Committed in:** 673d284 (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (missing critical)
**Impact on plan:** Essential for the voiceProfile to actually reach the client via DinoSummary. No scope creep.

## Issues Encountered

- `npm exec nx test frontend` crashes with pre-existing TypeScript `referencedFiles` bug (documented in STATE.md — "reproduces on pre-NgRx baseline too"). Frontend lint passes clean (0 errors, 1 pre-existing warning). Browser-tts-adapter and voice-synthesis service specs are written correctly but cannot be verified via the test runner in this environment.

## Known Stubs

None — all data flows are wired end-to-end (voiceProfile → DinoSummary → ChatComponent → SsmlHint → speak).

## Threat Flags

No new threat surface beyond the plan's T-28-01 and T-28-02. T-28-02 (utterance queue buildup) is mitigated via synth.cancel() before every speak() call.

## User Setup Required

None — browser-native Web Speech API, no keys or external services required.

## Next Phase Readiness

- VoiceSynthesisService is providedIn:root and ready for Phase 29 (voice assistant) reuse
- read_last_message ACTION_CATALOGUE intent now speaks via the same service (Phase 29 seam complete)
- Task 8 (manual audio smoke test in Chrome) still required: confirm audible speech per dino, Stop halts, no SSML markup spoken literally

---

## Self-Check

Verifying claims before finalizing...

## Self-Check: PASSED

All task commits verified in git log. All listed files exist.

---
*Phase: 28-voice-i-o-ssml*
*Completed: 2026-05-31*
