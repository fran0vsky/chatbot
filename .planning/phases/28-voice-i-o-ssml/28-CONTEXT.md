# Phase 28: Voice I/O + SSML - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

> Upstream artifacts (28-RESEARCH.md, 28-UI-SPEC.md, 28-VALIDATION.md) already
> exist and are authoritative for implementation detail. This file captures only
> the product/vision decisions the user made on top of them.

<domain>
## Phase Boundary

Two-way **browser voice I/O** for SpinoChat. A dino can read its responses aloud (TTS), and the user can dictate input by voice (STT), using the free, browser-native **Web Speech API** as the baseline path. Requirements **VOX-01** (read aloud), **VOX-02** (SSML-driven prosody), **VOX-03** (dictation).

This phase clarifies HOW to implement what RESEARCH.md and UI-SPEC.md scoped — it adds no new capability. Voice *commands that control the app* are Phase 29 (out of scope here).

</domain>

<decisions>
## Implementation Decisions

### Voice personality
- **D-01:** Each dino sounds distinct via an **optional `voiceProfile`** — `rate`, `pitch`, and an optional `preferredVoice` (system-voice name/URI). The `SsmlHint` → `SpeechSynthesisUtterance` converter (`browser-tts-adapter.ts`) reads the active dino's profile and maps it onto `utterance.rate`/`utterance.pitch`, selecting `preferredVoice` when present on the OS.
- **D-02:** The `voiceProfile` lives in the **backend dino registry** and is exposed via the existing `@org/shared-types` dino contract — consistent with model/system-prompt/tools being the server-side single source of truth. *(Default chosen; user may move to a frontend map if preferred.)*
- **D-03:** **Graceful degradation** — missing `voiceProfile` → default rate/pitch; `preferredVoice` not installed → fall back to system default voice. Never error.

### Read-aloud trigger
- **D-04:** **Manual read-aloud only** — the user clicks the per-bubble speaker button to hear a message. **No auto-read this phase.** (Auto-read / hands-free playback is deferred to a future phase; it can hang off the same `VoiceSynthesisService` later, e.g. for the Phase 29 assistant.)

### TTS provider / SSML
- **D-05:** Ship the **free Web Speech (`SpeechSynthesis`) path only**. VOX-02 is satisfied via the `SsmlHint` struct → utterance properties; **no SSML XML is ever passed to `SpeechSynthesisUtterance.text`** (it is spoken literally on macOS — RESEARCH.md Pitfall 1). The SSML limitation is documented in `browser-tts-adapter.ts`.
- **D-06:** The `TtsProvider` interface is the extension seam; a real-SSML paid adapter (Azure TTS / ElevenLabs) can drop in later without touching callers. **Not built this phase.** Honors the hard constraint that a free/browser fallback is mandatory (paid TTS may never be a hard dependency).

### Voice picker
- **D-07:** **No user-facing voice picker this phase.** System default voice is used except where a dino's `preferredVoice` (D-01) overrides it. A standalone picker UI is deferred. *(Default chosen — user selected this as an area but voice character is already delivered by D-01; confirm if a user picker is wanted now.)*

### Confirmed from UI-SPEC (not re-litigated)
- **D-08:** STT fills `InputComposer.draft` and **never auto-submits** — user reviews and sends, avoiding accidental sends from mishearing.
- **D-09:** Mic button hidden when `VoiceRecognitionService.supported()` is false (e.g. Firefox); read-aloud button hidden when `VoiceSynthesisService.supported()` is false. No broken UI states.
- **D-10:** Global "Dino is speaking…" indicator + Stop in the header (per UI-SPEC) drives the speaking state; per-bubble speaker shows the active state.

### Claude's Discretion
- Hand-rolled services vs `@ng-web-apis/speech`: hand-roll the two thin services (RESEARCH.md recommendation; minimal-deps convention).
- `NgZone.run()` wrapping of recognition callbacks (zone-based CD retained) — technical, per research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 28 artifacts
- `.planning/phases/28-voice-i-o-ssml/28-RESEARCH.md` — authoritative implementation guide: service architecture, `SsmlHint`/`TtsProvider` patterns, `NgZone.run()` requirement, SSML limitation (3 cited sources), pitfalls, Web Speech API Vitest mocking strategy.
- `.planning/phases/28-voice-i-o-ssml/28-UI-SPEC.md` — locked UI/interaction contract: mic button states in `InputComposer`, read-aloud button on `MessageBubble`, global header speaking indicator + Stop, copywriting/aria, animation, color tokens.
- `.planning/phases/28-voice-i-o-ssml/28-VALIDATION.md` — test infra, per-task verification map, Wave 0 mock-harness requirements, manual-only verifications.

### Requirements & scope
- `.planning/ROADMAP.md` §"Phase 28: Voice I/O + SSML" — goal + success criteria.
- `.planning/REQUIREMENTS.md` — VOX-01/02/03; Out-of-Scope free-fallback constraint ("Paid/premium TTS as a hard dependency").

### Carried-forward foundations
- `.planning/phases/27-ngrx-state-refactor/27-01-SUMMARY.md` — NgRx `ACTION_CATALOGUE` (includes *read/listen last message*) + `selectLastAssistantMessage` selector; theme-persistence pattern. Route TTS through the action-catalogue surface to seed Phase 29.

No external third-party spec docs beyond the above. New dev dependency: `@types/dom-speech-recognition` (install with `--legacy-peer-deps`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `libs/ui/src/lib/input-composer/` — existing position-3 voice **placeholder** button (`aria-label="Voice input"`) to make functional; `draft` is a **public** field (verified) for STT fill.
- `libs/ui/src/lib/message-bubble/` — hover action row (copy / regenerate / share); add speaker "read aloud" button (assistant role only).
- Header bar / chat shell — existing theme toggle area + (per UI-SPEC) global speaking indicator + Stop.
- NgRx store (Phase 27) — `selectLastAssistantMessage` selector + `ACTION_CATALOGUE` already exist for the read-aloud action surface.
- `@org/shared-types` dino contract — extend with optional `voiceProfile` (D-02).
- Backend dino registry — populate `voiceProfile` per dino.
- `tailwind.config.js` — jungle palette tokens + fonts (no new tokens needed).

### Established Patterns
- Angular standalone components + OnPush; Tailwind-only styling; inline SVG icons (`w-3.5 h-3.5` action-row, `w-8 h-8` composer).
- Signals for service state; `NgZone.run()` for Web Speech callbacks (zone-based CD).
- Windows env: `npm install --legacy-peer-deps`; Vitest via the repo's uppercase-cwd launcher; Nx patch in place.

### Integration Points
- New `apps/frontend/src/app/voice/`: `voice-synthesis.service.ts`, `voice-recognition.service.ts`, `tts-provider.ts`, `browser-tts-adapter.ts` (all `providedIn:'root'`).
- `InputComposer` new `@Output() dictate`; `MessageBubble` new `@Output() readAloud`; parent (ChatComponent) wires both to the services.

</code_context>

<specifics>
## Specific Ideas

- `voiceProfile` shape: `rate` (0.1–10, default 1.0), `pitch` (0–2, default 1.0), `preferredVoice?` (string voice name/URI).
- STT: `lang = 'en-US'`, `interimResults = true`, `continuous = false`; guard `start()` with the `listening` signal (avoid `InvalidStateError`).
- TTS: always `synth.cancel()` before `synth.speak()`; load voices lazily (don't call `getVoices()` at construction — returns `[]` on first Chrome call).
- Treat the STT transcript as untrusted input: trim + enforce the same max-length as typed input before `onSend()`.
- Privacy: small `title` tooltip on the mic button noting audio is processed by the browser's cloud ASR (Chrome→Google, Edge→Azure).
- HTTPS required for STT in prod (Firebase Hosting is HTTPS; localhost works in dev).

</specifics>

<deferred>
## Deferred Ideas

- **Auto-read / hands-free playback** — dino replies speak automatically (toggleable) — deferred; foundation (`VoiceSynthesisService`) supports adding it later.
- **Paid real-SSML TTS provider** (Azure TTS / ElevenLabs) behind the `TtsProvider` seam — real prosody/pauses; deferred (keys/cost; free fallback must remain).
- **User-facing voice picker** UI (choose among OS voices) — deferred; per-dino `preferredVoice` covers character for now.
- **LLM-generated prosody hints** — dino system prompt emitting `[pause]`/`[fast]` markers parsed into `SsmlHint` — future.
- **Multi-voice in groupchat/arena** — each dino speaking in its own voice in multi-dino views — future.

### Reviewed Todos (not folded)
- **`2026-05-29-replace-placeholder-dino-mascots`** — matched on `dino`/`ui` keywords only; this is **Phase 20** mascot work, not voice. Left for Phase 20.

</deferred>

---

*Phase: 28-voice-i-o-ssml*
*Context gathered: 2026-05-31*
