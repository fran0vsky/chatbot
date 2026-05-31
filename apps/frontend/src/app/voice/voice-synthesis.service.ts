import { Injectable, signal } from '@angular/core';
import { SsmlHint, TtsProvider } from './tts-provider.js';
import { buildUtterance } from './browser-tts-adapter.js';

/**
 * Singleton TTS service (VOX-01).
 *
 * Wraps the browser SpeechSynthesis API and exposes signal-based state
 * for use by Angular OnPush components. Implements TtsProvider so a future
 * paid provider (Azure TTS / ElevenLabs) can be injected in its place.
 *
 * Key design decisions (from RESEARCH.md / CONTEXT.md):
 * - Always synth.cancel() before synth.speak() — prevents utterance queue
 *   buildup (Pitfall 6, threat T-28-02).
 * - Load voices lazily inside speak() — getVoices() returns [] at construction
 *   time in Chrome (Pitfall 2).
 * - Signals fire in the service context; no NgZone.run() needed for signal
 *   mutations (signals work in both zone and zoneless Angular).
 * - providedIn:'root' so Phase 29 voice assistant reuses the same instance.
 */
@Injectable({ providedIn: 'root' })
export class VoiceSynthesisService implements TtsProvider {
  /** Whether the current browser supports SpeechSynthesis. */
  readonly supported = signal(
    typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  /** True while an utterance is being spoken. */
  readonly speaking = signal(false);

  private get synth(): SpeechSynthesis {
    return window.speechSynthesis;
  }

  /**
   * Speak `text` with optional prosody hints derived from the active dino's
   * voiceProfile. No-op when SpeechSynthesis is not supported.
   *
   * - Cancels any in-progress utterance first (Pitfall 6 / T-28-02).
   * - Resolves preferredVoice lazily via getVoices() at call time (Pitfall 2).
   */
  speak(text: string, hints?: SsmlHint): void {
    if (!this.supported()) return;

    // Cancel any queued or in-progress utterance before enqueuing a new one
    // (prevents queue buildup — RESEARCH.md Pitfall 6, threat T-28-02).
    this.synth.cancel();

    const utterance = buildUtterance(text, hints);

    // Lazy voice resolution — getVoices() is populated by speak() time in Chrome
    // (RESEARCH.md Pitfall 2). Falls back to system default when not found.
    if (hints?.preferredVoice) {
      const voices = this.synth.getVoices();
      const match = voices.find(
        (v) =>
          v.name === hints.preferredVoice ||
          v.voiceURI === hints.preferredVoice,
      );
      if (match) {
        utterance.voice = match;
      }
      // If no match: fall back silently to system default (D-03 — never error).
    }

    utterance.onstart = () => this.speaking.set(true);
    utterance.onend = () => this.speaking.set(false);
    utterance.onerror = () => this.speaking.set(false);

    this.synth.speak(utterance);
  }

  /**
   * Immediately stop speech and clear the speaking state.
   */
  stop(): void {
    if (!this.supported()) return;
    this.synth.cancel();
    this.speaking.set(false);
  }
}
