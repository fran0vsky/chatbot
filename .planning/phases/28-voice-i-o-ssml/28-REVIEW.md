---
phase: 28-voice-i-o-ssml
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - apps/backend/src/app/agents/dinos/dinos.ts
  - apps/frontend/src/app/chat/chat.html
  - apps/frontend/src/app/chat/chat.ts
  - apps/frontend/src/app/voice/browser-tts-adapter.ts
  - apps/frontend/src/app/voice/tts-provider.ts
  - apps/frontend/src/app/voice/voice-recognition.service.ts
  - apps/frontend/src/app/voice/voice-synthesis.service.ts
  - libs/shared-types/src/index.ts
  - libs/shared-types/src/lib/dino.types.ts
  - libs/ui/src/lib/input-composer/input-composer.html
  - libs/ui/src/lib/input-composer/input-composer.ts
  - libs/ui/src/lib/message-bubble/message-bubble.html
  - libs/ui/src/lib/message-bubble/message-bubble.ts
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 28 adds browser TTS read-aloud (VOX-01/02) and SpeechRecognition dictation (VOX-03). The service layer (`VoiceSynthesisService`, `VoiceRecognitionService`, `browser-tts-adapter`, `tts-provider`) is clean: good feature detection, `synth.cancel()` before `speak()`, lazy voice resolution, NgZone wrapping in the STT callbacks, and no `any` usage. The `Dino`/`VoiceProfile` type wiring and registry are correct.

The integration in `chat.ts`, however, has serious lifecycle defects. Two `effect()` calls are created **outside an Angular injection context** — one in `ngOnInit`, one inside the `onReadAloud()` method — which throws `NG0203` at runtime in standard (non-experimental) Angular. The read-aloud effect additionally has a race: it reads `speaking()` synchronously immediately after `speak()`, but `speaking` only flips true on the async `utterance.onstart`, so the effect can fire while still `false`, clear the tracked text, and self-destruct before speech ever starts. These undermine the two headline features of the phase.

There is no narrative `<structural_findings>` block in the prompt, so this report is narrative-only.

## Critical Issues

### CR-01: `effect()` created inside `onReadAloud()` method — outside injection context (NG0203) + start race

**File:** `apps/frontend/src/app/chat/chat.ts:227-232`
**Issue:**
Two compounding bugs in the same block:

1. **Injection-context violation.** `effect()` may only be created in an injection context (constructor, field initializer, or with an explicit `injector` option). `onReadAloud()` is a normal event-handler method, so this `effect()` call throws `NG0203: effect() can only be used within an injection context` every time a user clicks "Read aloud". The feature is dead on arrival in a standard Angular build.

2. **Start race / immediate self-destruct.** Even if the context issue were fixed, the effect runs eagerly on creation. At that moment `this.voiceSynth.speaking()` is still `false` because `speaking` is only set `true` asynchronously by `utterance.onstart` (line 66 of `voice-synthesis.service.ts`). So the effect immediately sees `!speaking`, clears `speakingMessageText` to `null`, and calls `stopEffect.destroy()` before audio begins — the per-bubble `[speaking]` highlight (chat.html:491) never lights up.

3. **Leak on rapid re-clicks.** Because each call creates a fresh effect and only destroys it on the first `!speaking`, overlapping read-aloud invocations can register multiple live effects.

**Fix:** Create one effect in the field initializer / constructor (injection context) that reconciles `speakingMessageText` against the service signal, instead of one-per-click:
```ts
// field initializer — runs in injection context
private readonly speakingSync = effect(() => {
  if (!this.voiceSynth.speaking()) {
    this.speakingMessageText.set(null);
  }
});

onReadAloud(text: string): void {
  const hint = this.buildSsmlHint(this.activeDino()?.voiceProfile);
  this.speakingMessageText.set(text);
  this.voiceSynth.speak(text, hint);
}
```
Note this also removes the synchronous-clear race because the field-initializer effect's first run is harmless (text is already null) and subsequent runs only clear when speech actually ends.

### CR-02: `effect()` created in `ngOnInit` — outside injection context (NG0203)

**File:** `apps/frontend/src/app/chat/chat.ts:539-546`
**Issue:** The transcript-mirroring `effect()` is created inside `ngOnInit()`. Lifecycle hooks are **not** an injection context. This throws `NG0203` on component init, which can crash the entire chat view bootstrap — meaning VOX-03 dictation never reaches the composer (and potentially the whole component fails to initialize). The adjacent comment ("effect() in a constructor/init context") is incorrect: `ngOnInit` is not a valid context.

Additionally, even once relocated, this effect writes to `this.inputComposerRef.draft` — but `@ViewChild(InputComposer)` is only resolved after the first `ngAfterViewInit`, and there are two `app-input-composer` instances in the template (empty-state and docked, chat.html:456 and 539) only one of which exists at a time; `@ViewChild` returns the first match and may be `undefined` during the empty state transition.

**Fix:** Move to a field-initializer effect (injection context). Reading a signal that may run before the view is ready is fine because of the `this.inputComposerRef` guard:
```ts
private readonly transcriptSync = effect(() => {
  const raw = this.voiceRec.transcript();
  if (raw && this.inputComposerRef) {
    this.inputComposerRef.draft = raw.trim().slice(0, MAX_DRAFT_LENGTH);
    this.cdr.markForCheck();
  }
});
```
Move the `readLastMessageSub` subscription separately — it is fine in `ngOnInit`.

### CR-03: `selectSignal` created inside an RxJS subscription callback — repeated injection-context / memory growth

**File:** `apps/frontend/src/app/chat/chat.ts:550-557`
**Issue:** Inside the `read_last_message` action subscription, `this.store.selectSignal(selectLastAssistantMessage)()` is called on every emission. `selectSignal` creates and registers a new signal bound to the injector each time it is invoked; calling it inside an async subscription callback is both outside the injection context (risking `NG0203`) and leaks a new signal subscription per action dispatch. Phase 29 will dispatch this action repeatedly, accumulating signals for the lifetime of the component.

**Fix:** Create the selector signal once as a field, read it in the callback:
```ts
private readonly lastAssistant = this.store.selectSignal(selectLastAssistantMessage);
// ...in ngOnInit subscription:
.subscribe(() => {
  const msg = this.lastAssistant();
  if (msg) this.onReadAloud(msg.text);
});
```

## Warnings

### WR-01: STT recognition instance never resets `interimResults`/error handling per session; transcript not cleared on Phase-29 reuse

**File:** `apps/frontend/src/app/voice/voice-recognition.service.ts:83-85`
**Issue:** `stop()` calls `recognition.stop()` but never clears `transcript`. The `chat.ts` mirroring effect keys on `transcript()` being truthy, so after one dictation the stale final transcript persists in the signal. If the composer is later cleared by the user and dictation is re-entered, the effect only re-fires when the value *changes*; an identical re-utterance ("yes") would not re-trigger a write. Also `onerror` swallows the error entirely (no logging, no user feedback) — a permission denial (`not-allowed`) is indistinguishable from a normal end, so the user gets no indication the mic was blocked.

**Fix:** Surface a minimal error signal (e.g. `lastError = signal<string | null>(null)`) set in `onerror` from `e.error`, and reset it in `start()`. Consider clearing `transcript` in `start()` (already done) and documenting that consumers should treat each `start()` as a fresh session.

### WR-02: `start()` sets `listening` true before `recognition.start()` can throw — desync on InvalidStateError

**File:** `apps/frontend/src/app/voice/voice-recognition.service.ts:72-77`
**Issue:** `this.listening.set(true)` runs before `this.recognition.start()`. If `start()` throws (e.g. `InvalidStateError` because the underlying engine is still tearing down a prior session, which the `listening` guard does not always catch — `onend` can lag), `listening` is left stuck at `true` with no recognition running. The mic button then shows the listening/pulse state permanently and `stop()` becomes a no-op on an already-stopped engine.

**Fix:** Wrap the start in try/catch and roll back the signal:
```ts
this.listening.set(true);
try {
  this.recognition.start();
} catch {
  this.listening.set(false);
}
```

### WR-03: TTS read-aloud passes raw markdown to the synthesizer

**File:** `apps/frontend/src/app/chat/chat.ts:219-223`, `message-bubble.ts:124-126`
**Issue:** `onReadAloud` speaks `this.message.text`, which is the raw markdown source (assistant messages are rendered via `<markdown>`). The synthesizer will literally read syntax tokens — asterisks, backticks, `#`, link URLs, and fenced code-block fences. For a code-heavy dino like Veloce this produces long unintelligible reads ("backtick backtick backtick t s..."). This degrades the core VOX-01 experience.

**Fix:** Strip markdown to plain text before speaking (a lightweight regex pass removing fences/emphasis/link-URL syntax, or reuse the rendered `textContent` from the bubble DOM). At minimum strip fenced code blocks and inline code.

### WR-04: `speaking` highlight matches by message text — duplicate messages both highlight

**File:** `apps/frontend/src/app/chat/chat.html:491`
**Issue:** `[speaking]="voiceSynth.speaking() && speakingMessageText() === m.text"` identifies the spoken bubble by text equality. Two assistant messages with identical text (common for short replies like "Yes." or repeated regenerations) will both render the speaking state simultaneously. Identity should be by message index/id, not content.

**Fix:** Track the spoken message's index or a stable id instead of its text: `speakingMessageIndex = signal<number | null>(null)` and compare `=== i`.

### WR-05: `onReadAloud` cannot toggle-stop; button aria-pressed implies toggle

**File:** `apps/frontend/src/app/chat/chat.ts:219-233`, `message-bubble.html:139-151`
**Issue:** The read-aloud button exposes `aria-pressed` and swaps to a "Stop reading" label/icon while `speaking`, implying clicking again stops playback. But `onReadAloud` only ever calls `voiceSynth.speak()` (which `cancel()`s then restarts) — it never calls `stop()`. Clicking the active "Stop reading" button restarts the same utterance instead of stopping it, contradicting the accessibility contract communicated to screen-reader users.

**Fix:** Make the handler a toggle:
```ts
onReadAloud(text: string): void {
  if (this.voiceSynth.speaking() && this.speakingMessageText() === text) {
    this.voiceSynth.stop();
    return;
  }
  // ...speak
}
```

## Info

### IN-01: Misleading comment claims `ngOnInit` is a valid effect context

**File:** `apps/frontend/src/app/chat/chat.ts:226`
**Issue:** Comment "effect() in a constructor/init context — registered here via a local effect" is factually wrong (this is an event handler, not a constructor). Update or remove once CR-01 is fixed to avoid re-introducing the bug.

### IN-02: `pauseAfterMs` field on `SsmlHint` is declared but never consumed

**File:** `apps/frontend/src/app/voice/tts-provider.ts:26`, `browser-tts-adapter.ts:30-39`
**Issue:** `pauseAfterMs` is documented "Future use" but `buildUtterance` ignores it and nothing sets it. Dead surface area on a public interface. Acceptable as a documented seam, but consider deferring its addition until implemented to avoid an unused public field.

### IN-03: `VoiceProfile.volume` mismatch between layers

**File:** `libs/shared-types/src/lib/dino.types.ts:7-23` vs `tts-provider.ts:12-18`
**Issue:** `SsmlHint` supports `volume`, and `buildUtterance` maps it, but `VoiceProfile` (the dino-registry source) has no `volume` field and `buildSsmlHint` (chat.ts:236-243) never sets it. So per-dino volume can never be expressed end-to-end. Either drop `volume` from `SsmlHint` or add it to `VoiceProfile` + `buildSsmlHint` for consistency.

### IN-04: Redundant re-export comment in shared-types barrel

**File:** `libs/shared-types/src/index.ts:4`
**Issue:** The comment "VoiceProfile is exported from dino.types.js above — no extra re-export needed" is housekeeping noise. Minor; safe to remove.

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
