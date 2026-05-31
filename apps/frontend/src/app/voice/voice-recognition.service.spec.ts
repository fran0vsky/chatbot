import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceRecognitionService } from './voice-recognition.service.js';

// ---------------------------------------------------------------------------
// Shared mock for SpeechRecognition
// ---------------------------------------------------------------------------

interface MockRecognition {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  interimResults: boolean;
  lang: string;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
}

function makeMockRecognition(): MockRecognition {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    interimResults: false,
    lang: '',
    continuous: false,
    onresult: null,
    onend: null,
    onerror: null,
  };
}

/**
 * Build a minimal SpeechRecognitionEvent-like object for firing in tests.
 * We cast via unknown because jsdom does not expose the constructor; the
 * service only reads `e.results[last][0].transcript` and `e.results[last].isFinal`.
 */
function makeResultEvent(
  transcript: string,
  isFinal: boolean,
): SpeechRecognitionEvent {
  return {
    results: [
      Object.assign([{ transcript }], { isFinal }),
    ] as unknown as SpeechRecognitionResultList,
  } as unknown as SpeechRecognitionEvent;
}

/** Type-safe accessor for window as an extensible record (avoids no-explicit-any). */
const win = window as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Test: without any SpeechRecognition global (jsdom default)
// ---------------------------------------------------------------------------
describe('VoiceRecognitionService — unsupported browser', () => {
  beforeEach(() => {
    // Ensure neither global exists
    delete win['SpeechRecognition'];
    delete win['webkitSpeechRecognition'];

    TestBed.configureTestingModule({ providers: [VoiceRecognitionService] });
  });

  afterEach(() => {
    delete win['SpeechRecognition'];
    delete win['webkitSpeechRecognition'];
    vi.restoreAllMocks();
  });

  it('should report supported() = false', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    expect(svc.supported()).toBe(false);
  });

  it('start() is a safe no-op when unsupported', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    // Must not throw
    expect(() => svc.start()).not.toThrow();
    expect(svc.listening()).toBe(false);
  });

  it('stop() is a safe no-op when unsupported', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    expect(() => svc.stop()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test: with SpeechRecognition mock installed
// ---------------------------------------------------------------------------
describe('VoiceRecognitionService — supported browser', () => {
  let mockRec: MockRecognition;

  beforeEach(() => {
    mockRec = makeMockRecognition();
    win['SpeechRecognition'] = vi.fn(() => mockRec);
    delete win['webkitSpeechRecognition'];

    TestBed.configureTestingModule({ providers: [VoiceRecognitionService] });
  });

  afterEach(() => {
    delete win['SpeechRecognition'];
    delete win['webkitSpeechRecognition'];
    vi.restoreAllMocks();
  });

  it('should report supported() = true', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    expect(svc.supported()).toBe(true);
  });

  it('should configure recognition with correct settings', () => {
    TestBed.inject(VoiceRecognitionService);
    expect(mockRec.interimResults).toBe(true);
    expect(mockRec.lang).toBe('en-US');
    expect(mockRec.continuous).toBe(false);
  });

  it('start() sets listening true and calls recognition.start()', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    const zone = TestBed.inject(NgZone);

    zone.run(() => svc.start());

    expect(svc.listening()).toBe(true);
    expect(mockRec.start).toHaveBeenCalledTimes(1);
  });

  it('start() resets transcript before listening', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    const zone = TestBed.inject(NgZone);

    // Simulate a prior interim result by firing onresult manually
    zone.run(() => {
      if (mockRec.onresult) {
        mockRec.onresult(makeResultEvent('old transcript', false));
      }
    });

    // Now start a fresh session — transcript should reset
    zone.run(() => svc.start());

    expect(svc.transcript()).toBe('');
  });

  it('firing interim onresult updates transcript without ending listening', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    const zone = TestBed.inject(NgZone);

    zone.run(() => svc.start());

    // Simulate interim recognition event (isFinal = false)
    zone.run(() => {
      if (mockRec.onresult) {
        mockRec.onresult(makeResultEvent('hello wor', false));
      }
    });

    expect(svc.transcript()).toBe('hello wor');
    expect(svc.listening()).toBe(true);
  });

  it('firing onresult with isFinal=true sets listening false', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    const zone = TestBed.inject(NgZone);

    zone.run(() => svc.start());
    expect(svc.listening()).toBe(true);

    // Simulate final recognition event
    zone.run(() => {
      if (mockRec.onresult) {
        mockRec.onresult(makeResultEvent('hello world', true));
      }
    });

    expect(svc.transcript()).toBe('hello world');
    expect(svc.listening()).toBe(false);
  });

  it('calling start() while already listening does NOT call recognition.start() twice', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    const zone = TestBed.inject(NgZone);

    zone.run(() => svc.start());
    zone.run(() => svc.start()); // second call — guard should block this

    expect(mockRec.start).toHaveBeenCalledTimes(1);
  });

  it('onend callback sets listening to false', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    const zone = TestBed.inject(NgZone);

    zone.run(() => svc.start());
    expect(svc.listening()).toBe(true);

    zone.run(() => {
      if (mockRec.onend) {
        mockRec.onend();
      }
    });

    expect(svc.listening()).toBe(false);
  });

  it('onerror callback sets listening to false', () => {
    const svc = TestBed.inject(VoiceRecognitionService);
    const zone = TestBed.inject(NgZone);

    zone.run(() => svc.start());
    expect(svc.listening()).toBe(true);

    zone.run(() => {
      if (mockRec.onerror) {
        mockRec.onerror(new Event('error') as SpeechRecognitionErrorEvent);
      }
    });

    expect(svc.listening()).toBe(false);
  });
});
