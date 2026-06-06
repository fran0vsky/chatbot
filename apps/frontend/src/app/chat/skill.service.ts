import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DinoSkill, LearnedItems } from '@org/shared-types';
import { environment } from '../../environments/environment';
import { loadUserId } from './chat.service';

/**
 * HTTP for teach-a-skill: list/create/delete a dino's taught skills and view/
 * delete its auto-extracted memories (MEM-04..06). Scoped by the same anonymous
 * userId the chat uses (Phase 21) and the active dinoId — both server-side filters.
 */
@Injectable({ providedIn: 'root' })
export class SkillService {
  private readonly http = inject(HttpClient);
  private readonly userId = loadUserId();
  private readonly base = `${environment.apiUrl}/api`;

  /** Everything this dino has learned about the user: taught skills + memories. */
  getLearned(dinoId: string): Observable<LearnedItems> {
    return this.http.get<LearnedItems>(`${this.base}/skills`, {
      params: { userId: this.userId, dinoId },
    });
  }

  /** Teach the dino a new skill; resolves to the persisted skill. */
  addSkill(dinoId: string, title: string, instruction: string, whenToActivate?: string): Observable<DinoSkill> {
    return this.http.post<DinoSkill>(`${this.base}/skills`, {
      userId: this.userId,
      dinoId,
      title,
      instruction,
      ...(whenToActivate ? { whenToActivate } : {}),
    });
  }

  /** Update an existing skill's title, trigger and instruction. */
  updateSkill(id: string, fields: { title: string; whenToActivate?: string; instruction: string }): Observable<DinoSkill> {
    return this.http.put<DinoSkill>(`${this.base}/skills/${id}`, fields);
  }

  deleteSkill(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/skills/${id}`);
  }

  deleteMemory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/memories/${id}`);
  }
}
