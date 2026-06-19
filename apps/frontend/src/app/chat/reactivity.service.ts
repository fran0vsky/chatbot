import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  DinoReactivityMap,
  ReactionLevel,
  ReactivityResponse,
  SetReactivityRequest,
} from '@org/shared-types';
import { environment } from '../../environments/environment';
import { loadUserId } from './chat.service';

/**
 * HTTP service for per-dino reaction-level configuration (Phase 43).
 * Mirrors SkillService in structure: inject HttpClient, scope by loadUserId(),
 * build base from environment. Exposes a signal so the template reacts to changes
 * without manual change detection in ChatComponent.
 *
 * Availability note: if the `dino_reactivity` table is absent (DB degraded mode),
 * GET returns `{ levels: {} }` and PUT no-ops. The signal stays at `{}` — every
 * dino defaults to `'normal'` which is behaviorally identical to pre-Phase-43 (SC#4).
 */
@Injectable({ providedIn: 'root' })
export class ReactivityService {
  private readonly http = inject(HttpClient);
  private readonly userId = loadUserId();
  private readonly base = `${environment.apiUrl}/api`;

  /** Per-dino reaction levels for the current user. Defaults to `{}` (all 'normal'). */
  private readonly _levels = signal<DinoReactivityMap>({});

  /** Readonly view of the levels signal. */
  readonly levels = this._levels.asReadonly();

  /**
   * Load all stored levels for this user.
   * On error: logs and keeps whatever the signal already holds (non-blocking).
   */
  load(): void {
    this.http
      .get<ReactivityResponse>(`${this.base}/dino-reactivity`, {
        params: { userId: this.userId },
      })
      .subscribe({
        next: (res) => this._levels.set(res.levels ?? {}),
        error: (err) =>
          console.error('[ReactivityService] load failed:', err),
      });
  }

  /**
   * Optimistically update the signal then PUT to the backend.
   * On error: logs the failure but keeps the optimistic value (degraded mode —
   * consistent with MemoryService / SkillService approach).
   */
  setLevel(dinoId: string, level: ReactionLevel): void {
    // Optimistic update
    this._levels.update((current) => ({ ...current, [dinoId]: level }));

    const body: SetReactivityRequest = { userId: this.userId, level };
    this.http
      .put<{ dinoId: string; level: ReactionLevel }>(
        `${this.base}/dino-reactivity/${dinoId}`,
        body,
      )
      .subscribe({
        error: (err) =>
          console.error(`[ReactivityService] setLevel(${dinoId}) failed:`, err),
      });
  }
}
