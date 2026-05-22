import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRequest, ChatResponse } from '@org/shared-types';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private threadId: string = crypto.randomUUID();

  get currentThreadId(): string {
    return this.threadId;
  }

  resetThread(): void {
    this.threadId = crypto.randomUUID();
  }

  setThread(id: string): void {
    this.threadId = id;
  }

  sendMessage(message: string, model?: string): Observable<ChatResponse> {
    const body: ChatRequest = { message, threadId: this.threadId, model };
    return this.http.post<ChatResponse>(`${environment.apiUrl}/api/agents/chat`, body);
  }
}
