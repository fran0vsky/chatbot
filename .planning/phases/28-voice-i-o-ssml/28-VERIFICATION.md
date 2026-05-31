---
phase: 28-voice-i-o-ssml
verified: 2026-06-01T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Audio smoke test — read-aloud per dino"
    expected: "Clicking the speaker button on an assistant bubble produces audible speech; different dinos sound distinctly different in rate/pitch; Stop halts speech immediately and the header indicator disappears."
    why_human: "Web Speech API audio output cannot be observed by static analysis or jsdom. The frontend test runner crashes with a pre-existing TypeScript toolchain bug so automated spec execution is not available."
  - test: "SSML honesty — no markup spoken literally"
    expected: "A message containing literal angle-bracket text (e.g. '<speak>hello</speak>') is read as plain words, not as literal XML markup spoken aloud."
    why_human: "Requires listening to the audio output in a real browser."
  - test: "Voice dictation — Chrome live transcription"
    expected: "Clicking the mic button, granting mic permission, and speaking a sentence causes words to appear live in the composer draft (interim updates visible). The final transcript stays in the draft without auto-submitting. Mic button shows accent pulse ring while active, returns to idle on completion. Very long dictation is capped at 10 000 characters."
    why_human: "SpeechRecognition requires a real browser audio context and microphone permission. jsdom cannot simulate this."
  - test: "Voice dictation — Firefox graceful absence"
    expected: "The mic button does not appear at all in Firefox (SpeechRecognition unsupported). The composer works normally for typed input."
    why_human: "Requires testing in a Firefox browser where SpeechRecognition is absent."
---

# Phase 28: Voice I/O (VOX-01/02/03) Verification Report

**Phase Goal:** A dino can read its responses aloud (TTS with SSML) and the user can dictate input (STT), with a free/browser fallback.
**Verified:** 2026-06-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A dino reads its response aloud on demand | VERIFIED | `VoiceSynthesisService.speak()` is wired from `ChatComponent.onReadAloud()` → speaker button on `MessageBubble` emits `readAloud` → `onReadAloud(text)` builds `SsmlHint` and calls `voiceSynth.speak(text, hint)`. End-to-end path confirmed in source. |
| 2 | Spoken output uses SSML for natural prosody/pauses (or documents the fallback) | VERIFIED | `browser-tts-adapter.ts` lines 1-16: top-of-file comment explicitly documents the browser SSML limitation, cites `browser-compat-data/issues/15663` and Chromium bug 795371, and explains the SsmlHint struct workaround. `buildUtterance` maps `rate`/`pitch`/`volume` onto `SpeechSynthesisUtterance` properties — no SSML XML ever touches `utterance.text`. Per-dino `voiceProfile` (`rate`/`pitch`) flows: `dinos.ts` → `toDinoSummary` → `DinoSummary` → `buildSsmlHint()` → `voiceSynth.speak(hint)`. VOX-02 honest implementation confirmed. |
| 3 | The user can dictate a message by voice (speech-to-text) | VERIFIED | `VoiceRecognitionService` exists as `providedIn:'root'`, exposes `listening`/`transcript`/`supported` signals, wraps all recognition callbacks in `NgZone.run()`. `InputComposer` has functional `@Input() sttSupported` / `@Input() listening` / `@Output() micToggle`. `ChatComponent` wires `[sttSupported]="voiceRec.supported()"`, `[listening]="voiceRec.listening()"`, `(micToggle)="onMicToggle()"`. Transcript-to-draft mirroring runs via an `effect()` in the constructor. Never calls `submit()`. |
| 4 | A free/browser fallback exists so voice works without a paid provider | VERIFIED | Both TTS and STT use browser-native Web Speech APIs exclusively. No paid API keys, no backend round-trip, no external packages at runtime. `TtsProvider` interface exists as the seam for a future paid provider. `VoiceRecognitionService` feature-detects `SpeechRecognition \|\| webkitSpeechRecognition` and sets `supported` false on unsupported browsers; mic button is `@if (sttSupported)` gated. `VoiceSynthesisService.supported` signal gates TTS; speaker button is `@if (ttsSupported)` gated. |

**Score:** 4/4 truths verified

---

### NG0203 Fix Verified (from 28-REVIEW.md CR-01/CR-02/CR-03)

The code review identified three NG0203 blockers in the original commit. The context note states they were fixed in commit `6787316`. Verification of the fix in the current codebase:

- **CR-01 (effect inside event handler):** `chat.ts` `onReadAloud()` (lines 245-254) contains NO `effect()` call. The clearing logic is handled by the constructor-level `effect()` at line 158-162, which reads only `voiceSynth.speaking()`. Fix is present.
- **CR-02 (effect inside ngOnInit):** `chat.ts` `ngOnInit()` (lines 541-568) contains NO `effect()` call. The comment at line 556 explicitly notes transcript mirroring runs "via the field-level transcriptMirrorEffect". The `effect()` is in the constructor at lines 166-172. Fix is present.
- **CR-03 (selectSignal inside subscription):** `lastAssistantMessage` is declared as a class field `private readonly lastAssistantMessage = this.store.selectSignal(selectLastAssistantMessage)` (line 150) — created once in the injection context. The subscription at line 564 reads `this.lastAssistantMessage()` (no new `selectSignal` call). Fix is present.

All three critical NG0203 blockers confirmed FIXED in the current codebase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/frontend/src/app/voice/tts-provider.ts` | `SsmlHint` struct + `TtsProvider` interface | VERIFIED | Exports both; `TtsProvider.speaking` typed as `Signal<boolean>`; SSML limitation documented. |
| `apps/frontend/src/app/voice/voice-synthesis.service.ts` | `providedIn:'root'` TTS service with `speaking`/`supported` signals, `speak()`/`stop()` | VERIFIED | `@Injectable({ providedIn: 'root' })`. Signals declared. `speak()` calls `synth.cancel()` before `synth.speak()`. Lazy voice resolution. `stop()` calls `synth.cancel()` and sets `speaking` false. Implements `TtsProvider`. |
| `apps/frontend/src/app/voice/browser-tts-adapter.ts` | `buildUtterance` mapping `SsmlHint` to utterance properties; SSML limitation documented | VERIFIED | SSML limitation comment at top of file with issue citations. `buildUtterance` sets `rate`/`pitch`/`volume` from hints. Text passed as-is — no SSML injection. |
| `libs/shared-types/src/lib/dino.types.ts` | `VoiceProfile` interface + `Dino.voiceProfile?` | VERIFIED | `VoiceProfile` interface with `rate?`/`pitch?`/`preferredVoice?`. `Dino.voiceProfile?: VoiceProfile`. `DinoSummary = Omit<Dino, 'systemPrompt'>` — carries `voiceProfile` automatically. |
| `apps/backend/src/app/agents/dinos/dinos.ts` | All 4 dinos have distinct `voiceProfile` | VERIFIED | Rexford `{rate:1.0, pitch:0.9}`, Veloce `{rate:1.25, pitch:1.1}`, Glyphos `{rate:0.9, pitch:1.0}`, Nimbus `{rate:1.15, pitch:1.05}`. All values within `VoiceProfile` ranges. `toDinoSummary` explicitly passes `voiceProfile: dino.voiceProfile`. |
| `apps/frontend/src/app/voice/voice-recognition.service.ts` | `providedIn:'root'` STT service with `listening`/`transcript`/`supported` signals, `start()`/`stop()`, NgZone-wrapped callbacks | VERIFIED | `@Injectable({ providedIn: 'root' })`. All three signals declared. `start()` guarded by `listening` signal. All callbacks (`onresult`/`onend`/`onerror`) wrapped in `this.zone.run()`. Feature detection for `SpeechRecognition \|\| webkitSpeechRecognition`. |
| `libs/ui/src/lib/message-bubble/message-bubble.ts` | `@Output() readAloud`, `@Input() speaking`, `@Input() ttsSupported` | VERIFIED | All three declared. `onReadAloud()` emits `message.text`. |
| `libs/ui/src/lib/message-bubble/message-bubble.html` | Speaker button inside assistant branch only, gated by `ttsSupported` | VERIFIED | The entire action row (including the `@if (ttsSupported)` speaker button) is inside the `@else` block that handles non-user/non-error messages (i.e., assistant messages). The `@if (ttsSupported)` guard is at line 136 of `message-bubble.html`. |
| `libs/ui/src/lib/input-composer/input-composer.ts` | `@Input() sttSupported`/`@Input() listening`/`@Output() micToggle`; stays presentational | VERIFIED | All three declared. No service injection — presentational design maintained. |
| `libs/ui/src/lib/input-composer/input-composer.html` | Mic button hidden when `!sttSupported`; listening state shows pulse ring; privacy title | VERIFIED | `@if (sttSupported)` wraps the entire mic button block. `animate-ping` pulse ring inside `@if (listening)`. Privacy title: "Voice input — audio is processed by your browser". |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `message-bubble.ts` | `ChatComponent` | `@Output() readAloud` emits `message.text` | VERIFIED | `readAloud = new EventEmitter<string>()`. `onReadAloud()` calls `this.readAloud.emit(this.message.text)`. `chat.html:494` binds `(readAloud)="onReadAloud($event)"`. |
| `chat.ts` | `VoiceSynthesisService` | `speak(text, ssmlHintFromActiveDinoVoiceProfile)` | VERIFIED | `voiceSynth = inject(VoiceSynthesisService)`. `onReadAloud()` calls `buildSsmlHint(dino?.voiceProfile)` then `voiceSynth.speak(text, hint)`. |
| `browser-tts-adapter.ts` | `SpeechSynthesisUtterance` | `buildUtterance` maps `SsmlHint` rate/pitch/volume | VERIFIED | `const u = new SpeechSynthesisUtterance(text)`. Applies `hints.rate`/`hints.pitch`/`hints.volume` conditionally. No SSML XML in `u.text`. |
| `input-composer.ts` | `ChatComponent` | `@Output() micToggle` toggle; `start()`/`stop()` in parent | VERIFIED | `chat.html:467,550` binds `(micToggle)="onMicToggle()"`. `onMicToggle()` calls `voiceRec.stop()` or `voiceRec.start()` based on `listening()`. |
| `chat.ts` | `VoiceRecognitionService` | `transcript` signal mirrors to `InputComposer.draft` via `effect()` | VERIFIED | Constructor `effect()` at lines 166-172: reads `voiceRec.transcript()`, writes trimmed/capped value to `inputComposerRef.draft`. |
| `voice-recognition.service.ts` | `SpeechRecognition` | `onresult`/`onend`/`onerror` wrapped in `NgZone.run()` | VERIFIED | All three handlers use `this.zone.run(() => ...)`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `chat.html` (speaking indicator) | `voiceSynth.speaking()` | `VoiceSynthesisService.speaking` signal set by `utterance.onstart`/`onend`/`onerror` | Yes — set from real browser speech events | FLOWING |
| `chat.html` (message bubble `[speaking]`) | `speakingMessageText()` | Set in `onReadAloud(text)`, cleared by constructor `effect()` when `!voiceSynth.speaking()` | Yes — tracks actual spoken message text | FLOWING |
| `chat.html` (mic `[listening]`) | `voiceRec.listening()` | `VoiceRecognitionService.listening` signal, set by `start()` / cleared by `onend`/`onerror`/`handleResult` | Yes — set from real recognition events | FLOWING |
| `InputComposer.draft` | `voiceRec.transcript()` | `VoiceRecognitionService.transcript` signal, set from `SpeechRecognitionEvent` in `handleResult()` | Yes — real speech recognition results | FLOWING |
| `VoiceSynthesisService.speak()` | `hints.rate`/`hints.pitch` | `buildSsmlHint(activeDino().voiceProfile)` ← `toDinoSummary(dino).voiceProfile` ← `dinos.ts` registry | Yes — distinct values per dino from registry | FLOWING |

---

### Behavioral Spot-Checks

The frontend test runner is broken by a pre-existing toolchain bug (`Cannot destructure property 'pos' of file.referencedFiles[index]`). Automated spec execution is not available. The production build passes (`nx build frontend` exits 0 with only pre-existing CommonJS warnings).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend production build | `npm exec nx build frontend` | Exit 0, "Successfully ran target build" | PASS |
| Backend registry shape | Reading `dinos.ts` | All 4 dinos have `voiceProfile` with values in spec range | PASS |
| CR-01/02/03 fixes | Inspecting `chat.ts` constructor vs event handlers | Both `effect()` calls are in the constructor; `lastAssistantMessage` signal is a class field | PASS |
| SSML XML never in utterance.text | Inspecting `browser-tts-adapter.ts` | `new SpeechSynthesisUtterance(text)` — text is passed as-is; only rate/pitch/volume set from hints | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VOX-01 | 28-01 | A dino can read its responses aloud via text-to-speech | SATISFIED | Speaker button on `MessageBubble` → `onReadAloud()` → `VoiceSynthesisService.speak()` wired end-to-end. |
| VOX-02 | 28-01 | Spoken output driven by SSML for natural prosody/pauses | SATISFIED | `SsmlHint` struct maps `rate`/`pitch` to `SpeechSynthesisUtterance` properties. SSML limitation documented in code. Per-dino `voiceProfile` provides distinct prosody. VOX-02 honest implementation confirmed. |
| VOX-03 | 28-02 | User can dictate input by voice (speech-to-text) | SATISFIED | `VoiceRecognitionService` wired through `InputComposer` mic button into `ChatComponent.draft` via `effect()`. Trim + 10 000-char cap applied. Never auto-submits. |

All three requirement IDs from PLAN frontmatter are accounted for and satisfied.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `message-bubble.html` | Speaker button `aria-pressed` + "Stop reading" label implies toggle-stop, but `onReadAloud()` always speaks (reviewed WR-05 from 28-REVIEW.md) | Warning | Accessibility contract mismatch for screen-reader users. Does not block the goal. No `TBD`/`FIXME`/`XXX` markers. |
| `chat.html` | `[speaking]="voiceSynth.speaking() && speakingMessageText() === m.text"` — text equality tracking (WR-04 from 28-REVIEW.md) | Warning | Two identical short replies both highlight. Workaround: track by index. Does not block core goal. |
| `voice-recognition.service.ts` | `start()` sets `listening` true before `recognition.start()` — desync if engine throws (WR-02) | Warning | Mic button can appear stuck in listening state. Not a blocker for initial use. |
| `chat.ts` | `onReadAloud` passes raw markdown to synthesizer (WR-03) | Warning | Code-heavy responses will include markdown syntax tokens in speech. Degrades UX but does not prevent the feature from working. |

No `TBD`, `FIXME`, or `XXX` debt markers found in phase-modified files.

---

### Human Verification Required

#### 1. Audio Smoke Test — Read-Aloud per Dino (Task 8 of 28-01)

**Test:** Serve the frontend in Chrome (`npx nx serve frontend`, localhost is a secure origin). For each dino: open a chat, get an assistant reply, hover the bubble, click the speaker button.
**Expected:** Audible speech. Different dinos sound distinct (Rexford slower/lower, Veloce faster/higher, Glyphos slower, Nimbus breezy). The global "Dino is speaking..." indicator appears in the header while speech is active. Clicking "Stop" halts speech immediately and the indicator disappears.
**Why human:** Web Speech API audio output requires a real browser audio context. jsdom cannot test this.

#### 2. SSML Honesty Verification (VOX-02 — Task 8 of 28-01)

**Test:** In Chrome, type a message containing `<speak>hello</speak>` literally and ask a dino to read it back. Click the speaker button on the assistant bubble that contains the `<speak>` text.
**Expected:** The synthesizer reads "less-than speak greater-than hello less-than slash speak greater-than" OR speaks only the text content — confirming no SSML markup is silently processed or spoken as XML element names. Either outcome is acceptable; the key is the SSML is not passed as real SSML instructions.
**Why human:** Requires listening to the audio output.

#### 3. Voice Dictation — Chrome Live Transcription (Task 5 of 28-02)

**Test:** In Chrome (localhost), click the mic button → grant microphone permission → speak a sentence (e.g. "Hello, how are you today?").
**Expected:** Interim words appear live in the composer draft while speaking. Final transcript remains in the draft WITHOUT auto-sending. Mic button shows accent pulse ring while active and returns to idle on completion. Clicking the mic while listening stops dictation. Dictating or pasting ~10 001 characters confirms the draft is capped at 10 000.
**Why human:** SpeechRecognition requires real browser audio and microphone permission.

#### 4. Voice Dictation — Firefox Graceful Absence (Task 5 of 28-02)

**Test:** Open the app in Firefox.
**Expected:** The mic button is absent entirely (not greyed-out, not broken — simply not rendered). The composer works normally for typed input.
**Why human:** Requires testing in a Firefox browser where `SpeechRecognition` is absent.

---

### Gaps Summary

No automated gaps were found. All four observable truths are verified in source code. All required artifacts exist and are substantive. All key links are wired. The NG0203 blockers identified in the post-merge code review (28-REVIEW.md) are confirmed fixed in the current `chat.ts`. The production build passes.

The warnings from 28-REVIEW.md (WR-01 through WR-05) are logged above as non-blocking quality concerns for follow-up, not phase goal blockers.

The phase goal cannot be marked `passed` because four items require in-browser audio testing that cannot be automated.

---

_Verified: 2026-06-01T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
