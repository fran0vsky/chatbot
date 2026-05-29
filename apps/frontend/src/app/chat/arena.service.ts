import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ArenaVote, LeaderboardRow } from '@org/shared-types';
import { ChatService } from './chat.service';
import { environment } from '../../environments/environment';

export type ArenaStreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface ArenaPanelEntry {
  /** 'a' or 'b' — anonymous panel label until reveal. */
  panel: 'a' | 'b';
  /** The actual dino id — hidden from the template until revealed. */
  dinoId: string;
  /** Accumulated response text. */
  text: string;
  status: ArenaStreamStatus;
  error?: string;
}

export type ArenaPhase = 'idle' | 'streaming' | 'voted';

/**
 * Manages the Dino Arena: fetch a matchup, stream two anonymous responses,
 * record the user's vote, and expose updated leaderboard data.
 *
 * Identities are hidden until `phase()` transitions to 'voted'.
 */
@Injectable({ providedIn: 'root' })
export class ArenaService {
  private readonly http = inject(HttpClient);
  private readonly chatService = inject(ChatService);

  /** Two anonymous panels A and B. */
  readonly panels = signal<ArenaPanelEntry[]>([]);
  /** Controls what the arena view renders. */
  readonly phase = signal<ArenaPhase>('idle');
  /** Set after a vote is cast — carries the updated ratings. */
  readonly leaderboard = signal<LeaderboardRow[]>([]);

  private controllers: AbortController[] = [];

  private readonly apiBase = `${environment.apiUrl}/api/arena`;

  /**
   * Fetch a matchup from the server and kick off two parallel SSE streams.
   * Resets previous match state.
   */
  async startBattle(prompt: string): Promise<void> {
    this.stopAll();

    const matchup = await firstValueFrom(
      this.http.get<{ aDinoId: string; bDinoId: string }>(`${this.apiBase}/matchup`),
    );

    const entries: ArenaPanelEntry[] = [
      { panel: 'a', dinoId: matchup.aDinoId, text: '', status: 'idle' },
      { panel: 'b', dinoId: matchup.bDinoId, text: '', status: 'idle' },
    ];
    this.panels.set(entries);
    this.phase.set('streaming');

    // Fan out two parallel streams — same pattern as GroupchatService.
    for (const entry of entries) {
      const controller = new AbortController();
      this.controllers.push(controller);
      this.streamForPanel(prompt, entry.panel, entry.dinoId, controller.signal);
    }
  }

  /**
   * Submit the user's vote. Updates leaderboard signal on success.
   * No-ops gracefully if the server is unreachable.
   */
  async vote(aDinoId: string, bDinoId: string, result: ArenaVote['result']): Promise<void> {
    this.stopAll();
    this.phase.set('voted');

    const votePayload: ArenaVote = { aDinoId, bDinoId, result };
    try {
      await firstValueFrom(
        this.http.post(`${this.apiBase}/vote`, votePayload, { observe: 'response' }),
      );
    } catch {
      // Vote not persisted — continue gracefully.
    }

    try {
      const rows = await firstValueFrom(
        this.http.get<LeaderboardRow[]>(`${this.apiBase}/leaderboard`),
      );
      this.leaderboard.set(rows);
    } catch {
      // Leaderboard unavailable — leave whatever was previously loaded.
    }
  }

  /** Load the leaderboard independently (e.g. on Leaderboard tab open). */
  async loadLeaderboard(): Promise<void> {
    try {
      const rows = await firstValueFrom(
        this.http.get<LeaderboardRow[]>(`${this.apiBase}/leaderboard`),
      );
      this.leaderboard.set(rows);
    } catch {
      // Silently degrade — leaderboard stays empty or stale.
    }
  }

  /** Reset to idle state for "Next battle". */
  reset(): void {
    this.stopAll();
    this.panels.set([]);
    this.phase.set('idle');
  }

  /** Abort all active streams. */
  stopAll(): void {
    for (const ctrl of this.controllers) {
      ctrl.abort();
    }
    this.controllers = [];
  }

  // ─── Private streaming logic ─────────────────────────────────────────────

  private updatePanel(panel: 'a' | 'b', patch: Partial<ArenaPanelEntry>): void {
    this.panels.update((list) =>
      list.map((e) => (e.panel === panel ? { ...e, ...patch } : e)),
    );
  }

  private streamForPanel(
    prompt: string,
    panel: 'a' | 'b',
    dinoId: string,
    signal: AbortSignal,
  ): void {
    this.updatePanel(panel, { status: 'streaming' });

    (async () => {
      try {
        for await (const event of this.chatService.streamMessage(
          prompt,
          dinoId,
          signal,
          undefined,
          [],
        )) {
          if (signal.aborted) break;

          switch (event.type) {
            case 'token':
              this.updatePanel(panel, {
                text:
                  (this.panels().find((e) => e.panel === panel)?.text ?? '') +
                  event.text,
              });
              break;
            case 'done':
              this.updatePanel(panel, { text: event.response, status: 'done' });
              break;
            case 'error':
              this.updatePanel(panel, { status: 'error', error: event.message });
              break;
            default:
              // reasoning_token, tool_call_* — ignored in arena v1
              break;
          }
        }

        // If the stream closed without a 'done' event (e.g. aborted).
        const entry = this.panels().find((e) => e.panel === panel);
        if (entry && entry.status === 'streaming') {
          this.updatePanel(panel, { status: 'done' });
        }
      } catch {
        if (!signal.aborted) {
          this.updatePanel(panel, {
            status: 'error',
            error: 'Stream failed unexpectedly.',
          });
        }
      }
    })();
  }
}
