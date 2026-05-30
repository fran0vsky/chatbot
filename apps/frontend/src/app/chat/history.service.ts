import { Injectable } from '@angular/core';
import { ConversationSession } from '@org/shared-types';
import {
  removeFromList,
  renameInList,
  togglePinInList,
  upsertInList,
} from '../store/session/session-list.ops';

const STORAGE_KEY = 'desert-chat-history';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  loadSessions(): ConversationSession[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ConversationSession[]) : [];
    } catch {
      return [];
    }
  }

  upsertSession(session: ConversationSession): ConversationSession[] {
    const sessions = upsertInList(this.loadSessions(), session);
    this.persist(sessions);
    return sessions;
  }

  deleteSession(id: string): ConversationSession[] {
    const sessions = removeFromList(this.loadSessions(), id);
    this.persist(sessions);
    return sessions;
  }

  updateTitle(id: string, title: string): ConversationSession[] {
    const sessions = renameInList(this.loadSessions(), id, title);
    this.persist(sessions);
    return sessions;
  }

  togglePin(id: string): ConversationSession[] {
    const sessions = togglePinInList(this.loadSessions(), id);
    this.persist(sessions);
    return sessions;
  }

  private persist(sessions: ConversationSession[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
}
