import { Injectable } from '@angular/core';
import { ConversationSession } from '@org/shared-types';

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
    const sessions = this.loadSessions();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = { ...sessions[idx], ...session };
    } else {
      sessions.unshift(session);
    }
    this.persist(sessions);
    return sessions;
  }

  deleteSession(id: string): ConversationSession[] {
    const sessions = this.loadSessions().filter((s) => s.id !== id);
    this.persist(sessions);
    return sessions;
  }

  updateTitle(id: string, title: string): ConversationSession[] {
    const sessions = this.loadSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx >= 0) {
      sessions[idx] = { ...sessions[idx], title };
      this.persist(sessions);
    }
    return sessions;
  }

  togglePin(id: string): ConversationSession[] {
    const sessions = this.loadSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx >= 0) {
      sessions[idx] = { ...sessions[idx], pinned: !sessions[idx].pinned };
      this.persist(sessions);
    }
    return sessions;
  }

  private persist(sessions: ConversationSession[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
}
