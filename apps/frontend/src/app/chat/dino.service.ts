import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DinoSummary } from '@org/shared-types';
import { environment } from '../../environments/environment';

/**
 * Fetches and caches the dino roster from GET /api/dinos. The backend resolves
 * a dino's model + system prompt + toolset server-side; the client only ever
 * holds the safe DinoSummary projection (no system prompt).
 */
@Injectable({ providedIn: 'root' })
export class DinoService {
  private readonly http = inject(HttpClient);
  readonly dinos = signal<DinoSummary[]>([]);
  readonly loaded = signal(false);

  loadDinos(): void {
    this.http.get<DinoSummary[]>(`${environment.apiUrl}/api/dinos`).subscribe({
      next: (list) => {
        this.dinos.set(list);
        this.loaded.set(true);
      },
      error: () => {
        // Graceful degradation: empty roster, still flag as loaded so the UI
        // can render an empty state instead of spinning forever.
        this.dinos.set([]);
        this.loaded.set(true);
      },
    });
  }

  getById(id: string | undefined): DinoSummary | undefined {
    if (!id) return undefined;
    return this.dinos().find((d) => d.id === id);
  }
}
