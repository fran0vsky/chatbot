import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import {
  AssistantDecision,
  AssistantDinoRef,
  AssistantInterpretRequest,
  AssistantInterpretResponse,
  AssistantSessionRef,
} from '@org/shared-types';
import { environment } from '../../environments/environment';
import { VoiceRecognitionService } from './voice-recognition.service.js';
import { VoiceSynthesisService } from './voice-synthesis.service.js';
import { dispatchCatalogued } from '../store/action-catalogue';

export type AssistantState = 'idle' | 'listening' | 'thinking';

/** Live app context the assistant needs to resolve commands. */
export interface AssistantContext {
  sessions: AssistantSessionRef[];
  dinos: AssistantDinoRef[];
  currentView?: string;
}

/**
 * Voice Dino Assistant orchestration (Phase 29).
 *
 * Flow: start() → listen (STT) → interpret (backend) → either dispatch a
 * whitelisted action through the catalogue safety gate, or speak a clarifying
 * question / refusal (TTS). Reuses the singleton STT/TTS services from Phase 28.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly voiceRec = inject(VoiceRecognitionService);
  private readonly voiceSynth = inject(VoiceSynthesisService);
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  readonly state = signal<AssistantState>('idle');
  /** True while a command is being listened to or processed (mutes dictation mirroring). */
  readonly active = computed(() => this.state() !== 'idle');
  readonly lastTranscript = signal('');
  readonly lastSay = signal('');

  /** STT availability — the UI hides the assistant button when false (Firefox). */
  readonly supported = this.voiceRec.supported;
  /** TTS speaking state, surfaced for the button's "speaking" visual. */
  readonly speaking = this.voiceSynth.speaking;

  private context: AssistantContext = { sessions: [], dinos: [] };

  constructor() {
    // When a command utterance finishes (listening drops while we're still in
    // 'listening'), grab the final transcript and interpret it. transcript is
    // read untracked so interim results don't re-fire this effect.
    effect(() => {
      const listening = this.voiceRec.listening();
      if (this.state() === 'listening' && !listening) {
        const transcript = untracked(() => this.voiceRec.transcript()).trim();
        void this.process(transcript);
      }
    });
  }

  /** Begin listening for a single spoken command. */
  start(context: AssistantContext): void {
    if (this.active()) return;
    if (!this.voiceRec.supported()) {
      this.voiceSynth.speak('Voice control is not supported in this browser.');
      return;
    }
    this.context = context;
    this.lastTranscript.set('');
    this.lastSay.set('');
    this.voiceSynth.stop();
    this.state.set('listening');
    this.voiceRec.start();
  }

  /** Abort the current command (mic + speech) and return to idle. */
  cancel(): void {
    this.voiceRec.stop();
    this.voiceSynth.stop();
    this.voiceRec.reset();
    this.state.set('idle');
  }

  private async process(transcript: string): Promise<void> {
    if (!transcript) {
      this.voiceRec.reset();
      this.state.set('idle');
      return;
    }
    this.lastTranscript.set(transcript);
    this.state.set('thinking');
    try {
      const body: AssistantInterpretRequest = {
        transcript,
        sessions: this.context.sessions,
        dinos: this.context.dinos,
        currentView: this.context.currentView,
      };
      const res = await firstValueFrom(
        this.http.post<AssistantInterpretResponse>(
          `${environment.apiUrl}/api/assistant/interpret`,
          body,
        ),
      );
      this.executeDecision(res.decision);
    } catch {
      this.speak("Sorry, I couldn't reach the assistant.");
    } finally {
      // Clear the consumed command so it can't leak into the composer when the
      // dictation mirror effect re-runs on the active() → false transition.
      this.voiceRec.reset();
      this.state.set('idle');
    }
  }

  private executeDecision(decision: AssistantDecision): void {
    if (decision.kind === 'clarify' || decision.kind === 'refuse') {
      this.speak(decision.say);
      return;
    }
    // kind === 'action' — dispatch through the catalogue safety gate. Even if the
    // backend returned a bad name/params, this rejects it (defense in depth).
    const res = dispatchCatalogued(this.store, decision.name, decision.params);
    if (!res.ok) {
      this.speak("Sorry, I can't do that one.");
      return;
    }
    // read_last_message is spoken by ChatComponent (it reads the message text),
    // so we must not speak over it here.
    if (decision.name !== 'read_last_message') {
      this.speak(decision.say);
    }
  }

  private speak(text: string): void {
    this.lastSay.set(text);
    this.voiceSynth.speak(text);
  }
}
