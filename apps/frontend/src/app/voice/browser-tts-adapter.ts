/**
 * Browser TTS adapter: maps SsmlHint → SpeechSynthesisUtterance properties.
 *
 * SSML LIMITATION NOTICE:
 * SSML tags (e.g. <speak>, <prosody>, <break>) are NOT passed to
 * SpeechSynthesisUtterance.text. The SpeechSynthesis API does not process SSML
 * in any major browser as of 2025 — on macOS/Chrome/Edge, SSML markup is spoken
 * literally as text ("less-than speak greater-than…").
 * See: https://github.com/mdn/browser-compat-data/issues/15663
 * See: https://bugs.chromium.org/p/chromium/issues/detail?id=795371
 *
 * VOX-02 is satisfied via the SsmlHint struct which maps rate/pitch/volume
 * onto supported SpeechSynthesisUtterance properties instead. A paid provider
 * (Azure TTS / ElevenLabs) behind the TtsProvider interface can accept real
 * SSML strings later without changing callers.
 */

import { SsmlHint } from './tts-provider.js';

/**
 * Build a SpeechSynthesisUtterance from text and optional prosody hints.
 *
 * - Sets rate, pitch, volume from hints when present.
 * - Leaves utterance defaults (rate=1, pitch=1, volume=1) when hints are absent.
 * - NEVER injects SSML/XML into utterance.text (see limitation notice above).
 *
 * Voice selection (preferredVoice) is handled separately by VoiceSynthesisService
 * because getVoices() must be called lazily at speak() time (Pitfall 2).
 */
export function buildUtterance(
  text: string,
  hints?: SsmlHint,
): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  if (hints?.rate !== undefined) u.rate = hints.rate;
  if (hints?.pitch !== undefined) u.pitch = hints.pitch;
  if (hints?.volume !== undefined) u.volume = hints.volume;
  return u;
}

/**
 * BrowserTtsAdapter: thin wrapper that delegates to buildUtterance.
 *
 * Provided for callers that prefer an object API over the bare function.
 * The primary unit under test is buildUtterance.
 */
export class BrowserTtsAdapter {
  buildUtterance(text: string, hints?: SsmlHint): SpeechSynthesisUtterance {
    return buildUtterance(text, hints);
  }
}
