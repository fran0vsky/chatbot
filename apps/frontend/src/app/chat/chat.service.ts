import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRequest, ChatResponse } from '@org/shared-types';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  readonly threadId = crypto.randomUUID();

  sendMessage(message: string): Observable<ChatResponse> {
    const body: ChatRequest = { message, threadId: this.threadId };
    return this.http.post<ChatResponse>(`${environment.apiUrl}/api/agents/chat`, body);
  }
}
