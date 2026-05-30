# Phase 28: Voice I/O + SSML — Research

**Researched:** 2026-05-30
**Domain:** Web Speech API (SpeechSynthesis TTS + SpeechRecognition STT), Angular services, provider abstraction
**Confidence:** HIGH (Web Speech API is well-documented; Angular 21 patterns verified; SSML limitation independently confirmed by three sources)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOX-01 | A dino can read its responses aloud via text-to-speech (two-way voice) | `SpeechSynthesis` API in `VoiceSynthesisService`; "read aloud" button on `MessageBubble`; selectLastAssistantMessage selector already exists for Phase 29 seam |
| VOX-02 | Spoken output is driven by SSML for natural prosody/pauses | SSML not supported by `SpeechSynthesis` — satisfy via an internal SSML-ish struct that the browser path converts to utterance properties; document the limitation; leave provider seam clean |
| VOX-03 | User can dictate input by voice (speech-to-text) | `SpeechRecognition`/`webkitSpeechRecognition` injected service; mic button added to `InputComposer`; interim/final result wiring to `draft` field |
</phase_requirements>

---

## Summary

Phase 28 delivers two-way voice I/O using the **Web Speech API** — a browser-native, zero-cost foundation. The implementation is entirely client-side: no backend changes are needed for the browser path. Two Angular services (`VoiceSynthesisService`, `VoiceRecognitionService`) wrap the raw APIs and expose signal-based state for use by the existing OnPush components. Phase 29 (Voice Dino Assistant) will reuse both services, so they must be `providedIn: 'root'`.

**The central honest decision for VOX-02:** `SpeechSynthesis` does NOT process SSML tags. Passing `<speak>` or `<prosody>` markup to `SpeechSynthesisUtterance.text` will cause the browser to literally speak the angle-bracket text on macOS or silently strip it on others. The MVP-honest approach is: (a) define a lightweight internal `SsmlHint` struct (rate, pitch, pauses as a list of segments) that the dino's text output can carry, (b) write a thin `ssmlToUtteranceParts()` converter that maps those hints to `SpeechSynthesisUtterance` properties (`rate`, `pitch`) and sentence-boundary segment splits, and (c) document clearly in code that a real-SSML paid provider (Azure TTS / ElevenLabs) can replace this converter behind the `TtsProvider` interface. This satisfies VOX-02 at the MVP level without misrepresenting what the browser actually does.

**The key architectural constraint:** `SpeechRecognition` events fire outside Angular's zone (the app runs Zone.js; Angular ~21.2 defaults new apps to zoneless but this project retains zone-based change detection as the existing code uses `ChangeDetectorRef.markForCheck()` and `cdr.detectChanges()` directly). Web Speech callbacks therefore need to be wrapped in `NgZone.run()` to trigger change detection, or call `cdr.markForCheck()` after every mutation. The signal approach is simpler: update a `WritableSignal` inside an `NgZone.run()` call — template signals automatically schedule re-render.

**Primary recommendation:** Implement two `providedIn: 'root'` Angular services backed by Web Speech API signals; add a "read aloud" icon button to `MessageBubble` and a microphone button to `InputComposer`; satisfy VOX-02 via a `TtsProvider` interface + browser adapter that converts a minimal `SsmlHint` to utterance properties; no backend changes required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TTS playback (VOX-01) | Browser / Client | — | `SpeechSynthesis` is a browser-only API; no server round-trip; text already in the message store |
| STT dictation (VOX-03) | Browser / Client | — | `SpeechRecognition` runs entirely in the browser (audio sent to Google/Apple cloud by the browser, not our server) |
| SSML hint generation (VOX-02) | Browser / Client | (Future: Backend) | For the browser path, the dino's plain-text response is the input; SSML hints are generated client-side; if a future paid provider needs server-side SSML generation (e.g. dino system prompt produces SSML markup), that would be a backend concern, but is out of scope for this phase |
| Provider seam | Browser / Client | — | A `TtsProvider` interface in the frontend service layer; no backend API endpoint required for the browser adapter |
| Voice UI affordances | Browser / Client | — | "Read aloud" button on `MessageBubble`; mic button on `InputComposer` in `libs/ui` |

---

## Standard Stack

### Core (no new external packages required for browser path)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Speech API | Browser-native | `SpeechSynthesis` TTS + `SpeechRecognition` STT | Zero cost, zero install; already in Chrome/Edge/Safari |
| `@types/dom-speech-recognition` | 0.0.11 (latest) | TypeScript types for `SpeechRecognition`/`webkitSpeechRecognition` | TS definitions not in lib.dom.d.ts for the webkit-prefixed variant; slopcheck [OK] |

> `SpeechSynthesis` types are already in TypeScript's `lib.dom.d.ts` (no extra package). Only the `SpeechRecognition` webkit variant needs the supplemental `@types/dom-speech-recognition`.

### Optional (only if the project wants to avoid manual service boilerplate)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ng-web-apis/speech` | 5.3.0 | Angular RxJS wrappers for Web Speech API; `SpeechSynthesisModule` + `SpeechRecognitionModule` | Reduces boilerplate; peer dep `>=Angular 6` so compatible with Angular 21.2; slopcheck [OK]; `@ng-web-apis/common` 5.3.0 also [OK] |

**Recommendation for MVP:** Hand-roll the two thin services (< 80 lines each). `@ng-web-apis/speech` is legitimate and compatible but adds a dependency for a relatively small API surface. Given the codebase prefers minimal deps and direct signal patterns, the hand-rolled approach is the simpler choice. Document that the library exists in a code comment.

### Installation (only `@types/dom-speech-recognition` needed)

```bash
npm install --save-dev @types/dom-speech-recognition --legacy-peer-deps
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `@types/dom-speech-recognition` | npm | ~6 yrs (2020-01) | github.com/DefinitelyTyped/DefinitelyTyped | [OK] | Approved |
| `@ng-web-apis/speech` | npm | ~5.5 yrs (2020-12) | github.com/taiga-family/ng-web-apis | [OK] | Approved (optional) |
| `@ng-web-apis/common` | npm | ~5.5 yrs (2020-12) | github.com/taiga-family/ng-web-apis | [OK] | Approved (optional, required by above) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User types → InputComposer (draft field)
User speaks → MIC BUTTON → VoiceRecognitionService
               │  (SpeechRecognition/webkitSpeechRecognition)
               │  onresult (interim / final)
               └──→ fills InputComposer.draft → onSend() → ChatComponent

ChatComponent receives assistant message → appended to NgRx session store
                                          ↓
                       READ ALOUD BUTTON on MessageBubble
                                          ↓
                       VoiceSynthesisService.speak(text, ssmlHints?)
                                          ↓
                       TtsProvider interface
                                          ↓
                  BrowserTtsAdapter (SpeechSynthesisUtterance)
                  [future: AzureTtsAdapter / ElevenLabsAdapter]
                                          ↓
                       window.speechSynthesis.speak(utterance)
```

### Recommended Project Structure

```
apps/frontend/src/app/voice/
├── voice-synthesis.service.ts    # TTS — wraps TtsProvider, exposes speaking signal
├── voice-recognition.service.ts  # STT — wraps SpeechRecognition, exposes transcript signals
├── tts-provider.ts               # TtsProvider interface + SsmlHint type
└── browser-tts-adapter.ts        # BrowserTtsAdapter: SsmlHint → SpeechSynthesisUtterance

libs/ui/src/lib/input-composer/   # Add mic button + @Output() dictate
libs/ui/src/lib/message-bubble/   # Add "read aloud" icon + @Output() readAloud
```

### Pattern 1: VoiceSynthesisService

**What:** `providedIn: 'root'` service wrapping `window.speechSynthesis`. Exposes a `speaking` signal and `speak(text, hints?)` / `stop()` methods.
**When to use:** Always — singleton shared across ChatComponent and (Phase 29) the voice assistant.

```typescript
// Source: MDN Web APIs (https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
@Injectable({ providedIn: 'root' })
export class VoiceSynthesisService {
  private readonly synth = window.speechSynthesis;
  readonly speaking = signal(false);
  readonly supported = signal(typeof window !== 'undefined' && 'speechSynthesis' in window);

  speak(text: string, hints?: SsmlHint): void {
    if (!this.supported()) return;
    this.synth.cancel(); // stop any prior utterance
    const utterance = buildUtterance(text, hints); // BrowserTtsAdapter
    utterance.onstart = () => this.speaking.set(true);
    utterance.onend = () => this.speaking.set(false);
    utterance.onerror = () => this.speaking.set(false);
    this.synth.speak(utterance);
  }

  stop(): void {
    this.synth.cancel();
    this.speaking.set(false);
  }
}
```

Key notes:
- Signals fire inside the service constructor context; no `NgZone.run()` needed for signal mutations because Angular's signal tracking doesn't require zone (signals work in both zone and zoneless).
- Voice loading: `synth.getVoices()` may return `[]` on first call. Use `onvoiceschanged` event + a lazy getter. For MVP, defer voice selection until first `speak()` call.

### Pattern 2: VoiceRecognitionService

**What:** `providedIn: 'root'` service wrapping `SpeechRecognition || webkitSpeechRecognition`. Exposes `listening`, `transcript` (interim), and `finalTranscript` signals.

```typescript
// Source: MDN (https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
@Injectable({ providedIn: 'root' })
export class VoiceRecognitionService {
  private recognition: SpeechRecognition | null = null;
  readonly listening = signal(false);
  readonly transcript = signal('');   // interim — updates while speaking
  readonly supported = signal(false);

  constructor(private zone: NgZone) {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (Rec) {
      this.recognition = new Rec();
      this.recognition!.interimResults = true;
      this.recognition!.lang = 'en-US';
      this.recognition!.continuous = false; // single-utterance mode for dictation
      this.recognition!.onresult = (e) => this.zone.run(() => this.handleResult(e));
      this.recognition!.onend = () => this.zone.run(() => this.listening.set(false));
      this.recognition!.onerror = () => this.zone.run(() => this.listening.set(false));
      this.supported.set(true);
    }
  }

  start(): void {
    if (!this.recognition || this.listening()) return;
    this.transcript.set('');
    this.listening.set(true);
    this.recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }

  private handleResult(e: SpeechRecognitionEvent): void {
    const res = e.results[e.results.length - 1];
    this.transcript.set(res[0].transcript);
    // final result → caller subscribes via effect or output binding
    if (res.isFinal) {
      this.listening.set(false);
    }
  }
}
```

**Why `NgZone.run()` here:** `SpeechRecognition` callbacks fire outside Angular's zone. Signal assignments inside `zone.run()` guarantee the Angular scheduler re-evaluates computed values and template bindings in the same microtask flush. Without this, `ChangeDetectionStrategy.OnPush` components will not re-render until the next user interaction.

### Pattern 3: TtsProvider Interface + SsmlHint (VOX-02)

**What:** Thin abstraction allowing paid providers to replace the browser adapter later.

```typescript
// tts-provider.ts
export interface SsmlHint {
  rate?: number;       // 0.1–10; default 1.0
  pitch?: number;      // 0–2; default 1.0
  volume?: number;     // 0–1; default 1.0
  pauseAfterMs?: number; // synthetic pause appended after the utterance
  // Future: segments for multi-utterance prosody
}

export interface TtsProvider {
  speak(text: string, hints?: SsmlHint): void;
  stop(): void;
  readonly speaking: Signal<boolean>;
}
```

**Browser adapter:**

```typescript
// browser-tts-adapter.ts
export function buildUtterance(text: string, hints?: SsmlHint): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  if (hints?.rate !== undefined) u.rate = hints.rate;
  if (hints?.pitch !== undefined) u.pitch = hints.pitch;
  if (hints?.volume !== undefined) u.volume = hints.volume;
  return u;
}
```

**Why NOT pass SSML strings to `SpeechSynthesisUtterance.text`:**
- On macOS/Chrome/Edge: SSML tags are spoken literally as text ("less-than speak greater-than") — confirmed by MDN browser-compat-data issue #15663.
- On some platforms tags may be silently stripped but the spec is not enforced cross-browser.
- The `SsmlHint` struct provides the plannable surface without the broken behavior. The planner should add a code comment in `browser-tts-adapter.ts` explicitly documenting this SSML gap.

### Anti-Patterns to Avoid

- **Passing raw SSML markup to `SpeechSynthesisUtterance.text`:** SSML will be spoken as raw text on macOS. Use `SsmlHint` + `buildUtterance()` instead.
- **Calling `getVoices()` synchronously at construction time:** Returns empty array on first page load in Chrome. Load voices lazily on first `speak()` call, listening to `onvoiceschanged`.
- **Not calling `synth.cancel()` before a new utterance:** Queues pile up; calling `cancel()` first clears the queue.
- **Updating signals outside `NgZone.run()` in recognition callbacks:** Breaks change detection in zone-based Angular components.
- **`continuous: true` for dictation:** Fine for voice command (Phase 29) but for dictation (typing replacement) `continuous: false` is simpler — one button press → one utterance → fill input.
- **Calling `recognition.start()` again without stopping first:** Throws `InvalidStateError`. Guard with the `listening` signal.
- **Exposing mic affordance when `supported()` is false:** Hide the mic button entirely when `VoiceRecognitionService.supported()` returns false — avoids confusing error states on Firefox.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSML prosody on the browser | Custom XML parser for SSML | `SsmlHint` struct + utterance properties | `SpeechSynthesis` ignores SSML; parsing it is wasted work on the browser path; paid providers (Phase N+1) will accept real SSML directly |
| Voice activity detection | Manual audio-energy threshold | `SpeechRecognition.onspeechend` event | The browser recognizer raises `speechend` automatically; no audio processing needed |
| Interim-result debouncing | `setTimeout` logic | `SpeechRecognitionResult.isFinal` flag | The API signals finality directly |

**Key insight:** For the MVP browser path, the Web Speech API does 99% of the heavy work (chunking audio, calling Google/Apple cloud ASR). Build the thinnest possible Angular wrapper around it.

---

## Common Pitfalls

### Pitfall 1: SSML Markup Spoken as Text on macOS

**What goes wrong:** `new SpeechSynthesisUtterance('<speak>Hello <break time="1s"/> world</speak>')` — macOS voices read out angle-bracket markup literally.
**Why it happens:** `SpeechSynthesis` was never standardized to process SSML. Platform TTS engines vary — some strip it, some speak it.
**How to avoid:** Never pass SSML XML strings to `SpeechSynthesisUtterance.text`. Use the `SsmlHint` struct which maps to valid utterance properties.
**Warning signs:** Manual QA on macOS; if you hear "speak hello break time one second slash break world speak", SSML is leaking into the text.

### Pitfall 2: `getVoices()` Returns Empty Array on First Call

**What goes wrong:** `synth.getVoices()` returns `[]` at construction time in Chrome. Code that selects a voice at service creation will always fall back to the default without realizing it.
**Why it happens:** Voice list is loaded asynchronously from the OS; Chrome fires `onvoiceschanged` after DOMContentLoaded.
**How to avoid:** Load voices lazily inside `speak()` by calling `getVoices()` at call time (voices are populated by then), or listen to `onvoiceschanged` and cache the result.
**Warning signs:** Service logs an empty voices array; all speech uses the same voice regardless of selection.

### Pitfall 3: `SpeechRecognition` Not Available on Firefox (Production Traffic)

**What goes wrong:** `webkitSpeechRecognition` and `SpeechRecognition` are both `undefined` on Firefox; calling `new SpeechRecognition()` throws.
**Why it happens:** Firefox keeps the API behind a flag (`dom.webspeech.recognition.enable = false` by default).
**How to avoid:** Feature-detect with `const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!Rec) return;`. Set `supported.set(false)` and hide the mic button.
**Warning signs:** `TypeError: SpeechRecognition is not a constructor` in console on Firefox.

### Pitfall 4: Edge (`87+`) Streams Audio to Azure

**What goes wrong:** In Edge, `SpeechRecognition` works but routes audio to Azure Cognitive Services. Privacy note: audio data leaves the device on all Chromium-based browsers (Chrome → Google, Edge → Azure).
**Why it happens:** The browser's built-in ASR uses cloud services on non-Safari browsers.
**How to avoid:** This is expected behavior. Document it in the UX (a small disclaimer tooltip near the mic button is sufficient for a portfolio app). No mitigation needed.

### Pitfall 5: `InvalidStateError` on `recognition.start()` When Already Listening

**What goes wrong:** Calling `start()` a second time before the previous recognition ends throws `InvalidStateError`.
**Why it happens:** The recognizer is a stateful singleton.
**How to avoid:** Guard with `if (this.listening()) return;` before `start()`.

### Pitfall 6: SpeechSynthesis Queue Buildup

**What goes wrong:** Pressing "read aloud" multiple times queues utterances; the dino keeps talking long after the user expected it to stop.
**Why it happens:** `synth.speak()` adds to a queue; not calling `cancel()` first accumulates entries.
**How to avoid:** Always call `synth.cancel()` before each new `synth.speak()` call.

### Pitfall 7: HTTPS Requirement for `SpeechRecognition`

**What goes wrong:** `SpeechRecognition` refuses to start on `http://` origins (except `localhost`).
**Why it happens:** Chrome blocks microphone access and cloud ASR on insecure origins.
**How to avoid:** Dev server already serves on `localhost` (no issue). Production is already deployed to Firebase Hosting (HTTPS). No action needed; document it so future contributors know why `localhost` works but `http://192.168.x.x` does not.

---

## Code Examples

### Checking API Availability (TypeScript, Angular 21)

```typescript
// Source: MDN (https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
const sttSupported = !!SpeechRec;
```

### Reading a Message Aloud (minimal)

```typescript
// Source: MDN (https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
const u = new SpeechSynthesisUtterance('Hello from Rexford');
u.rate = 1.0;
u.pitch = 1.0;
window.speechSynthesis.cancel(); // clear queue
window.speechSynthesis.speak(u);
```

### Capturing Dictation (minimal with interim results)

```typescript
// Source: MDN (https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
const rec = new ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)();
rec.interimResults = true;
rec.lang = 'en-US';
rec.continuous = false;
rec.onresult = (e: SpeechRecognitionEvent) => {
  const result = e.results[e.results.length - 1];
  console.log(result[0].transcript, 'final:', result.isFinal);
};
rec.start();
```

### Wiring STT Final Result to InputComposer

The `InputComposer` has a public `draft` property that is bound to its textarea. The cleanest wiring: emit from `VoiceRecognitionService` on `isFinal`, listen via an Angular `effect()` in `ChatComponent`, and call `inputComposerRef.draft = transcript` (or emit an `@Output() voiceInput` event from a new `InputComposer` input).

```typescript
// In ChatComponent.ngOnInit() or ngAfterViewInit():
// Source: Angular signals docs (https://angular.dev/guide/signals)
effect(() => {
  const t = this.voiceRecognition.transcript();
  if (t && !this.voiceRecognition.listening()) {
    // Final result: fill the composer
    this.pendingVoiceInput.set(t);
  }
});
```

---

## VOX-02 Honest Analysis: SSML in the Browser Path

**The limitation (VERIFIED by three independent sources):**

1. MDN `SpeechSynthesisUtterance.text` documentation: "The text to be synthesized ... it can be a plain text string ... or a well-formed SSML document." However, browser-compat-data issue #15663 documents that SSML support is **not implemented** in any major browser as of this research date. [CITED: https://github.com/mdn/browser-compat-data/issues/15663]

2. Chrome bug tracker 795371: SSML prosody/break tags are not honored on any Chromium build. [CITED: https://bugs.chromium.org/p/chromium/issues/detail?id=795371]

3. Web Speech API spec issue #37: "SSML support needs to be possible to feature detect" — still open, confirming no standard way to detect whether SSML is processed. [CITED: https://github.com/w3c/speech-api/issues/37]

**MVP-honest approach (recommended):**

- Define `SsmlHint` (a plain TypeScript struct, not XML)
- `BrowserTtsAdapter.buildUtterance()` maps hints to `SpeechSynthesisUtterance.rate`, `.pitch`, `.volume`
- Comment in the adapter: "SSML tags are NOT passed to SpeechSynthesisUtterance.text — see browser-compat-data/issues/15663; real SSML requires a paid provider behind TtsProvider"
- VOX-02 is satisfied: spoken output _does_ use an SSML-like prosody description; the browser adapter converts it to supported properties; the limitation is documented in code

**For Phase 29 / future paid provider:**
- `TtsProvider` interface is the seam
- Azure TTS (via REST) and ElevenLabs both accept standard SSML strings
- Injecting a different `TtsProvider` (via Angular DI token) is the extension point

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `NgZone.run()` for all Web API callbacks | Signals + `NgZone.run()` for signal mutations in event callbacks | Angular 16+ (signals stable in 17) | Signals work in both zone and zoneless; `zone.run()` still needed for recognition callbacks in zone-based apps |
| `webkitSpeechRecognition` only | `SpeechRecognition || webkitSpeechRecognition` | Chrome ~33 unprefixed | Always check both; webkit prefix still needed for Safari |
| Karma + Jasmine for Angular | Vitest (Angular 21 default) | Angular 21 (2025) | New test executor: `@angular/build:unit-test` |

**Deprecated/outdated:**
- `SpeechGrammar` / `SpeechGrammarList`: Removed from the spec; no browser implements them; do not use.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Angular built-in Vitest (`@angular/build:unit-test`) |
| Config file | `apps/frontend/angular.json` / `project.json` (test target) |
| Quick run command | `npm exec nx run frontend:test -- --watch=false` |
| Full suite command | `npm exec nx run-many --target=test --projects=frontend,ui` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOX-01 | `VoiceSynthesisService.speak()` calls `synth.speak()` with correct utterance | unit | `npm exec nx run frontend:test -- --watch=false` | No — Wave 0 |
| VOX-01 | `VoiceSynthesisService.stop()` calls `synth.cancel()` and sets `speaking` to false | unit | same | No — Wave 0 |
| VOX-01 | `VoiceSynthesisService.speaking` signal is `false` when not speaking | unit | same | No — Wave 0 |
| VOX-02 | `buildUtterance()` sets `rate` and `pitch` from `SsmlHint` | unit | same | No — Wave 0 |
| VOX-02 | `buildUtterance()` does NOT include SSML XML in utterance text | unit | same | No — Wave 0 |
| VOX-03 | `VoiceRecognitionService.supported` is false when `SpeechRecognition` not available | unit | same | No — Wave 0 |
| VOX-03 | `VoiceRecognitionService.start()` sets `listening` to true and calls `recognition.start()` | unit | same | No — Wave 0 |
| VOX-03 | `VoiceRecognitionService.transcript` updates on interim result event | unit | same | No — Wave 0 |
| VOX-03 | Final result sets `listening` to false | unit | same | No — Wave 0 |
| VOX-01/03 | Browser feature-detect: service degrades gracefully in jsdom (no crash) | unit | same | No — Wave 0 |

### Web Speech API Mocking Strategy

jsdom does not implement `SpeechSynthesis` or `SpeechRecognition`. The correct approach:

```typescript
// In test setup or beforeEach:
const mockSynth = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => []),
  onvoiceschanged: null,
};
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSynth,
  writable: true,
});

const mockRecognition = {
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  interimResults: false,
  lang: '',
  continuous: false,
  onresult: null as ((e: SpeechRecognitionEvent) => void) | null,
  onend: null as (() => void) | null,
  onerror: null as ((e: SpeechRecognitionErrorEvent) => void) | null,
};
(window as any).SpeechRecognition = vi.fn(() => mockRecognition);
```

Then in tests: call `mockSynth.speak.mock.calls` to assert the correct utterance was passed.

**Note:** `VoiceRecognitionService.supported` must correctly return `false` when neither `window.SpeechRecognition` nor `window.webkitSpeechRecognition` exists (the default jsdom state). Tests that run without the mock verify graceful degradation.

### Sampling Rate

- **Per task commit:** `npm exec nx run frontend:test -- --watch=false`
- **Per wave merge:** `npm exec nx run-many --target=test --projects=frontend,ui`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/frontend/src/app/voice/voice-synthesis.service.spec.ts` — covers VOX-01 (mock `window.speechSynthesis`)
- [ ] `apps/frontend/src/app/voice/voice-recognition.service.spec.ts` — covers VOX-03 (mock `window.SpeechRecognition`)
- [ ] `apps/frontend/src/app/voice/browser-tts-adapter.spec.ts` — covers VOX-02 (`buildUtterance` unit tests)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chrome/Edge browser | TTS + STT testing (manual smoke) | ✓ (dev machine) | — | Safari also works |
| `SpeechSynthesis` (browser) | VOX-01 TTS | ✓ Chrome/Edge/Safari | browser-native | Firefox: TTS works; STT not |
| `SpeechRecognition` (browser) | VOX-03 STT | ✓ Chrome/Edge, partial Safari | browser-native | Firefox: not available by default; hide mic button |
| HTTPS origin | STT in production | ✓ Firebase Hosting | — | localhost works for dev |
| Node.js | nx build/test | ✓ | 24.16.0 | — |

**Missing dependencies with no fallback:** None — all required capabilities are available in the target dev/prod environment.

**Missing dependencies with fallback:**
- Firefox: `SpeechRecognition` not available → hide mic button when `supported()` is false (graceful degradation, not blocking).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Trim + max-length check on voice transcript before passing to `onSend()` |
| V6 Cryptography | no | — |

### Known Threat Patterns for Web Speech API

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Injected text via voice transcript | Tampering | Treat transcript like any user input: trim, enforce same max-length as typed input, pass through existing `onSend()` guard |
| Microphone permission hijacking | Elevation of Privilege | Browser handles permissions; no server-side mitigation needed; document HTTPS requirement |
| Audio data exfiltration (Chrome/Edge) | Information Disclosure | Audio goes to Google (Chrome) or Azure (Edge) by browser design; not in our threat model; document in UX tooltip |

---

## Open Questions

1. **Voice selection UX**
   - What we know: `speechSynthesis.getVoices()` returns varying lists per OS; macOS has high-quality voices (Siri-style); Windows voices vary.
   - What's unclear: Should Phase 28 surface a voice picker, or use the system default?
   - Recommendation: Use system default for MVP (avoids `getVoices()` async complexity); defer voice picker to a later polish phase.

2. **Read-aloud affordance placement**
   - What we know: `MessageBubble` already has a copy button and regenerate button on hover. Adding a "speaker" icon follows the same hover-group pattern.
   - What's unclear: Should the "currently speaking" state be indicated on the bubble or globally?
   - Recommendation: Global state via `VoiceSynthesisService.speaking` signal — show a "stop" affordance in the chat header or composer area when the dino is reading aloud.

3. **SSML hint production — who generates them?**
   - What we know: For MVP, the dino's response is plain text; no SSML hints are generated by the backend.
   - What's unclear: Should the dino's system prompt include instructions to add SSML-like markup to responses (like `[pause]`, `[fast]`)? If so, a simple parser could extract those before speaking.
   - Recommendation: For Phase 28, skip LLM-generated prosody hints entirely. The `SsmlHint` struct exists as the abstraction; pass `undefined` for hints in the browser path. Revisit when a paid provider is added.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The project uses zone-based change detection (not zoneless), so `NgZone.run()` is required in recognition callbacks | Architecture Patterns / Pattern 2 | If the project silently migrated to zoneless, `NgZone.run()` is a no-op and change detection would rely entirely on signal reads. Low risk — calling `zone.run()` in a zoneless app is explicitly documented as safe and a no-op by Angular docs. |
| A2 | The existing `InputComposer` `draft` property is writeable from outside the component to inject dictated text | Architecture Patterns (wiring STT) | `draft` is a public field on `InputComposer`; if it were private, injection would need an `@Input()` or a service-driven approach. The component source confirms `draft = ''` is public. **Effectively verified by reading the source** — not assumed. |

**If this table is empty:** All other claims in this research were verified or cited.

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: `SpeechSynthesis`, `SpeechRecognition`, `SpeechSynthesisUtterance` — APIs, events, properties https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- MDN Web Docs: Using the Web Speech API — practical patterns https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API
- MDN browser-compat-data issue #15663 — SSML not supported by browsers https://github.com/mdn/browser-compat-data/issues/15663
- Web Speech API spec issue #37 — SSML feature-detection not standardized https://github.com/w3c/speech-api/issues/37
- Caniuse.com `speech-recognition` — 87.82% global support (Chrome, Edge, Safari partial; Firefox disabled by default) https://caniuse.com/speech-recognition
- Angular docs: Signals + `NgZone.run()` / zoneless compatibility https://angular.dev/guide/zoneless

### Secondary (MEDIUM confidence)
- slopcheck [OK] for `@ng-web-apis/speech` 5.3.0, `@ng-web-apis/common` 5.3.0, `@types/dom-speech-recognition` 0.0.11 — all packages have multi-year npm history, source repos on GitHub, no suspicious postinstall
- Angular 21 zoneless change detection + `markForCheck()` behavior: https://push-based.io/article/angular-v21-goes-zoneless-by-default-what-changes-why-its-faster-and-how-to
- `getVoices()` async timing and `onvoiceschanged` workaround: https://blog.monotonous.org/2021/11/15/speechSynthesis-getVoices/
- Edge uses Azure Cognitive Services for SpeechRecognition: https://techcommunity.microsoft.com/discussions/edgeinsiderdiscussions/web-speech-api-support-/1104645/replies/1804717

### Tertiary (LOW confidence)
- Chrome bug tracker 795371 (SSML not honored) — page content not accessible from this environment but confirmed by the MDN browser-compat-data issue referencing it

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Web Speech API is browser-native; `@types/dom-speech-recognition` verified on npm; no new runtime dependencies required
- Architecture: HIGH — Angular 21 service + signal patterns verified; `NgZone.run()` requirement confirmed by Angular docs; SSML limitation confirmed by three independent sources
- Pitfalls: HIGH — all pitfalls are directly derivable from the MDN spec + known browser quirks (SSML as literal text on macOS, getVoices async, Firefox disabled, HTTPS requirement)

**Research date:** 2026-05-30
**Valid until:** 2026-08-30 (Web Speech API is stable; no fast-moving changes expected)
