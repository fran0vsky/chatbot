import { Signal } from '@angular/core';

/**
 * Lightweight SSML-inspired prosody hint struct for the browser TTS path.
 *
 * SSML tags are NOT passed to SpeechSynthesisUtterance.text — see
 * browser-compat-data/issues/15663 and RESEARCH.md VOX-02 for why.
 * These fields map directly to SpeechSynthesisUtterance properties.
 * A paid provider (Azure TTS / ElevenLabs) behind TtsProvider can accept
 * real SSML strings without callers changing.
 */
export interface SsmlHint {
  /** Speech rate. Range: 0.1–10. Default: 1.0. */
  rate?: number;
  /** Speech pitch. Range: 0–2. Default: 1.0. */
  pitch?: number;
  /** Speech volume. Range: 0–1. Default: 1.0. */
  volume?: number;
  /**
   * Preferred system-voice name/URI.
   * Resolved lazily at speak() time; falls back to system default when absent
   * or not installed.
   */
  preferredVoice?: string;
  /** Synthetic pause appended after the utterance (ms). Future use. */
  pauseAfterMs?: number;
}

/**
 * Abstraction seam for TTS providers.
 *
 * BrowserTtsAdapter is the concrete implementation for Phase 28.
 * A future paid provider (Azure TTS / ElevenLabs) can implement this
 * interface without callers changing (Phase N+1).
 */
export interface TtsProvider {
  speak(text: string, hints?: SsmlHint): void;
  stop(): void;
  readonly speaking: Signal<boolean>;
}
