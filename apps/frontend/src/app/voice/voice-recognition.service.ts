import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Singleton STT service (VOX-03).
 *
 * Wraps the browser SpeechRecognition / webkitSpeechRecognition API and
 * exposes signal-based state for use by Angular OnPush components.
 *
 * Key design decisions (from RESEARCH.md / CONTEXT.md):
 * - Feature-detect SpeechRecognition || webkitSpeechRecognition at construction
 *   time. When absent (Firefox), `supported` stays false and the mic button is
 *   hidden in the template (D-09, Pitfall 3).
 * - All recognition callbacks (onresult / onend / onerror) fire OUTSIDE
 *   Angular's zone. Signal mutations are wrapped in `NgZone.run()` so OnPush
 *   components re-render correctly (RESEARCH.md key constraint).
 * - `continuous: false` — single-utterance dictation mode (D-CONTEXT.md §STT).
 * - `start()` is guarded by the `listening` signal to prevent InvalidStateError
 *   when called while recognition is already active (Pitfall 5).
 * - `providedIn:'root'` so Phase 29 voice assistant reuses this same instance.
 *
 * HTTPS note (Pitfall 7): SpeechRecognition requires a secure origin in
 * production. Firebase Hosting is HTTPS; localhost works in dev. An http://
 * custom IP (e.g. 192.168.x.x) will fail — this is browser-enforced, not
 * something we can fix at runtime.
 */
@Injectable({ providedIn: 'root' })
export class VoiceRecognitionService {
  private readonly zone = inject(NgZone);
  private recognition: SpeechRecognition | null = null;

  /** True while the browser is actively listening for speech. */
  readonly listening = signal(false);

  /**
   * The current transcript — updates with each interim result while
   * `listening` is true; holds the final result after `listening` drops.
   */
  readonly transcript = signal('');

  /** Whether the browser supports SpeechRecognition. False on Firefox. */
  readonly supported = signal(false);

  constructor() {
    // Feature-detect both the unprefixed and webkit-prefixed variants.
    const win = window as unknown as Record<string, unknown>;
    const Rec = (win['SpeechRecognition'] ?? win['webkitSpeechRecognition']) as
      | (new () => SpeechRecognition)
      | undefined;

    if (Rec) {
      this.recognition = new Rec();
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false; // single-utterance dictation (not voice commands)

      this.recognition.onresult = (e: SpeechRecognitionEvent) =>
        this.zone.run(() => this.handleResult(e));
      this.recognition.onend = () =>
        this.zone.run(() => this.listening.set(false));
      this.recognition.onerror = () =>
        this.zone.run(() => this.listening.set(false));

      this.supported.set(true);
    }
  }

  /**
   * Start listening. No-op when:
   * - SpeechRecognition is unsupported (Firefox)
   * - already listening (prevents InvalidStateError — Pitfall 5)
   */
  start(): void {
    if (!this.recognition || this.listening()) return;
    this.transcript.set('');
    this.listening.set(true);
    this.recognition.start();
  }

  /**
   * Stop listening. The `onend` callback will fire and drop `listening` to
   * false via NgZone.run(), so callers do not need to mutate `listening` here.
   */
  stop(): void {
    this.recognition?.stop();
  }

  /**
   * Clear the transcript. The voice assistant calls this after consuming a
   * command so the command text never leaks into the composer draft.
   */
  reset(): void {
    this.transcript.set('');
  }

  /**
   * Process a SpeechRecognitionEvent: extract the latest result's transcript
   * and update the signal. When the result is final, drop `listening` to false.
   *
   * @internal Called from onresult — already inside NgZone.run() at callsite.
   */
  private handleResult(e: SpeechRecognitionEvent): void {
    const result = e.results[e.results.length - 1];
    this.transcript.set(result[0].transcript);
    if (result.isFinal) {
      this.listening.set(false);
    }
  }
}
