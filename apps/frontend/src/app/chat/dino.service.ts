import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateCustomDinoRequest,
  CuratedModel,
  CustomDino,
  DinoSummary,
  UpdateCustomDinoRequest,
} from '@org/shared-types';
import { environment } from '../../environments/environment';
import { loadUserId } from './chat.service';

/**
 * Fetches and caches the dino roster from GET /api/dinos. The backend resolves
 * a dino's model + system prompt + toolset server-side; the client only ever
 * holds the safe DinoSummary projection (no system prompt).
 *
 * Also provides custom-dino CRUD methods (D-02/D-03): all calls are scoped to
 * the anonymous per-device userId so users only see/mutate their own dinos.
 */
@Injectable({ providedIn: 'root' })
export class DinoService {
  private readonly http = inject(HttpClient);
  private readonly userId = loadUserId();
  readonly dinos = signal<DinoSummary[]>([]);
  readonly loaded = signal(false);

  /**
   * The HTTP boundary used by the dino NgRx effect. Kept here so all dino
   * roster requests funnel through DinoService (frontend HTTP-in-services rule).
   * Includes userId so the merged endpoint returns custom dinos alongside built-ins.
   */
  fetchDinos(): Observable<DinoSummary[]> {
    const params = new HttpParams().set('userId', this.userId);
    return this.http.get<DinoSummary[]>(`${environment.apiUrl}/api/dinos`, { params });
  }

  loadDinos(): void {
    const params = new HttpParams().set('userId', this.userId);
    this.http.get<DinoSummary[]>(`${environment.apiUrl}/api/dinos`, { params }).subscribe({
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

  // ─────────────────── Custom Dino CRUD (D-03) ─────────────────────────────

  /** Fetch the curated model catalogue for the model dropdown. */
  fetchModels(): Observable<CuratedModel[]> {
    return this.http.get<CuratedModel[]>(`${environment.apiUrl}/api/models`);
  }

  /**
   * Upload an avatar image via multipart POST.
   * Returns the public URL to store in avatarUrl.
   */
  uploadAvatar(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(
      `${environment.apiUrl}/api/custom-dinos/avatar`,
      form,
    );
  }

  /**
   * Create a new custom dino scoped to the current user.
   * Merges userId into the request body (D-03).
   */
  createCustomDino(
    req: Omit<CreateCustomDinoRequest, 'userId'>,
  ): Observable<CustomDino> {
    const body: CreateCustomDinoRequest = { ...req, userId: this.userId };
    return this.http.post<CustomDino>(
      `${environment.apiUrl}/api/custom-dinos`,
      body,
    );
  }

  /**
   * Update an existing custom dino by id. The userId is passed as a query
   * param so the backend can scope the lookup (D-03).
   */
  updateCustomDino(
    id: string,
    req: UpdateCustomDinoRequest,
  ): Observable<CustomDino> {
    const params = new HttpParams().set('userId', this.userId);
    return this.http.put<CustomDino>(
      `${environment.apiUrl}/api/custom-dinos/${id}`,
      req,
      { params },
    );
  }

  /**
   * Delete a custom dino by id. The userId is passed as a query param
   * so the backend can scope the deletion (D-03).
   */
  deleteCustomDino(id: string): Observable<void> {
    const params = new HttpParams().set('userId', this.userId);
    return this.http.delete<void>(
      `${environment.apiUrl}/api/custom-dinos/${id}`,
      { params },
    );
  }
}
