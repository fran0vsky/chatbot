import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { VoiceSynthesisService } from './voice-synthesis.service.js';

// ─── Web Speech API mocks ────────────────────────────────────────────────────

class MockSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function makeMockSynth() {
  return {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]),
    onvoiceschanged: null as (() => void) | null,
  };
}

// ─── Test helpers ────────────────────────────────────────────────────────────

function setupWithSpeechSynthesis() {
  const mockSynth = makeMockSynth();
  Object.defineProperty(window, 'speechSynthesis', {
    value: mockSynth,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    value: MockSpeechSynthesisUtterance,
    writable: true,
    configurable: true,
  });
  return mockSynth;
}

function setupWithoutSpeechSynthesis() {
  // Remove speechSynthesis to simulate unsupported environment (e.g. jsdom default)
  Object.defineProperty(window, 'speechSynthesis', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VoiceSynthesisService', () => {
  describe('when SpeechSynthesis is supported', () => {
    let mockSynth: ReturnType<typeof makeMockSynth>;

    beforeEach(() => {
      mockSynth = setupWithSpeechSynthesis();
      TestBed.configureTestingModule({});
    });

    it('speaking signal is false initially', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      expect(svc.speaking()).toBe(false);
    });

    it('supported signal is true when speechSynthesis is available', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      expect(svc.supported()).toBe(true);
    });

    it('speak() calls synth.cancel() before synth.speak()', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      const cancelOrder: string[] = [];
      mockSynth.cancel.mockImplementation(() => cancelOrder.push('cancel'));
      mockSynth.speak.mockImplementation(() => cancelOrder.push('speak'));

      svc.speak('Hello');

      expect(cancelOrder).toEqual(['cancel', 'speak']);
    });

    it('speak() calls synth.speak() with an utterance', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      svc.speak('Test message');
      expect(mockSynth.speak).toHaveBeenCalledOnce();
      const utterance = mockSynth.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
      expect(utterance.text).toBe('Test message');
    });

    it('speak() sets speaking to true via onstart callback', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      svc.speak('Hello');
      const utterance = mockSynth.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
      // Simulate the browser firing onstart
      utterance.onstart?.();
      expect(svc.speaking()).toBe(true);
    });

    it('speak() sets speaking to false via onend callback', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      svc.speak('Hello');
      const utterance = mockSynth.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
      utterance.onstart?.();
      utterance.onend?.();
      expect(svc.speaking()).toBe(false);
    });

    it('speak() sets speaking to false via onerror callback', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      svc.speak('Hello');
      const utterance = mockSynth.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
      utterance.onstart?.();
      utterance.onerror?.();
      expect(svc.speaking()).toBe(false);
    });

    it('stop() calls synth.cancel() and sets speaking to false', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      // First speak to set speaking=true
      svc.speak('Hello');
      const utterance = mockSynth.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
      utterance.onstart?.();
      expect(svc.speaking()).toBe(true);

      mockSynth.cancel.mockClear();
      svc.stop();

      expect(mockSynth.cancel).toHaveBeenCalledOnce();
      expect(svc.speaking()).toBe(false);
    });

    it('speak() applies rate and pitch from SsmlHint', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      svc.speak('Hi', { rate: 1.3, pitch: 0.9 });
      const utterance = mockSynth.speak.mock.calls[0][0] as MockSpeechSynthesisUtterance;
      expect(utterance.rate).toBe(1.3);
      expect(utterance.pitch).toBe(0.9);
    });
  });

  describe('when SpeechSynthesis is NOT supported', () => {
    beforeEach(() => {
      setupWithoutSpeechSynthesis();
      TestBed.configureTestingModule({});
    });

    it('supported signal is false', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      expect(svc.supported()).toBe(false);
    });

    it('speak() is a no-op and does not throw', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      expect(() => svc.speak('Hello')).not.toThrow();
    });

    it('speaking stays false after speak() is called', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      svc.speak('Hello');
      expect(svc.speaking()).toBe(false);
    });

    it('stop() is a no-op and does not throw', () => {
      const svc = TestBed.inject(VoiceSynthesisService);
      expect(() => svc.stop()).not.toThrow();
    });
  });
});
