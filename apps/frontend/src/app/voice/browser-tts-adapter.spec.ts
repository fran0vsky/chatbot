import { describe, it, expect, beforeEach } from 'vitest';
import { buildUtterance } from './browser-tts-adapter.js';

// Web Speech API mock — jsdom does not implement SpeechSynthesisUtterance.
// We provide a minimal mock that tracks the constructor argument and property
// assignments so tests can assert on them.
class MockSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;

  constructor(text: string) {
    this.text = text;
  }
}

beforeEach(() => {
  // Install the mock globally before each test.
  (globalThis as unknown as Record<string, unknown>)['SpeechSynthesisUtterance'] =
    MockSpeechSynthesisUtterance;
});

describe('buildUtterance', () => {
  it('sets rate and pitch from SsmlHint', () => {
    const u = buildUtterance('Hello', { rate: 1.4, pitch: 0.8 });
    expect(u.rate).toBe(1.4);
    expect(u.pitch).toBe(0.8);
  });

  it('sets volume from SsmlHint', () => {
    const u = buildUtterance('Hello', { volume: 0.5 });
    expect(u.volume).toBe(0.5);
  });

  it('leaves rate and pitch at defaults when no hints supplied', () => {
    const u = buildUtterance('Hello');
    // Default SpeechSynthesisUtterance values
    expect(u.rate).toBe(1);
    expect(u.pitch).toBe(1);
  });

  it('leaves rate and pitch at defaults when hints are undefined', () => {
    const u = buildUtterance('Hello', undefined);
    expect(u.rate).toBe(1);
    expect(u.pitch).toBe(1);
  });

  it('sets utterance text to the raw input string — no SSML wrapping', () => {
    const input = 'Hello world';
    const u = buildUtterance(input, { rate: 1.2 });
    // The text must equal the raw input exactly — no <speak> wrapper added.
    expect(u.text).toBe(input);
    expect(u.text).not.toContain('<speak>');
    expect(u.text).not.toContain('<prosody>');
  });

  it('passes angle-bracket text through unchanged (SSML not injected)', () => {
    // If the user happens to type "<speak>" literally, we must not parse or
    // modify it — the adapter never touches the text content (VOX-02 honesty).
    const ssmlLike = '<speak>Hello <break time="1s"/> world</speak>';
    const u = buildUtterance(ssmlLike);
    // text is preserved as-is (we do NOT strip or wrap it)
    expect(u.text).toBe(ssmlLike);
    // The adapter itself never constructs a <speak> wrapper around other text
    // — confirmed by the fact that non-SSML input also lacks the tag.
    const plain = buildUtterance('plain text');
    expect(plain.text).not.toContain('<speak>');
  });

  it('does not set rate when hints.rate is undefined', () => {
    const u = buildUtterance('Hi', { pitch: 1.5 });
    // rate stays at MockSpeechSynthesisUtterance default (1)
    expect(u.rate).toBe(1);
    expect(u.pitch).toBe(1.5);
  });
});
