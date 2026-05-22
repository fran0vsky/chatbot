import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ConversationSession } from '@org/shared-types';

interface DateGroup {
  label: string;
  sessions: ConversationSession[];
}

@Component({
  standalone: true,
  selector: 'app-history-panel',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-panel.html',
  styles: [':host { display: contents; }'],
})
export class HistoryPanel {
  @Input() open = false;
  @Input() sessions: ConversationSession[] = [];
  @Input() activeSessionId = '';
  @Output() sessionSelected = new EventEmitter<ConversationSession>();
  @Output() sessionDeleted = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();

  get groupedSessions(): DateGroup[] {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    const todaySessions: ConversationSession[] = [];
    const yesterdaySessions: ConversationSession[] = [];
    const prev7Sessions: ConversationSession[] = [];
    const olderSessions: ConversationSession[] = [];

    for (const session of this.sessions) {
      const d = new Date(session.createdAt);
      const startOfSessionDay = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
      ).getTime();
      const daysDiff = Math.floor(
        (startOfToday - startOfSessionDay) / 86_400_000,
      );

      if (daysDiff === 0) {
        todaySessions.push(session);
      } else if (daysDiff === 1) {
        yesterdaySessions.push(session);
      } else if (daysDiff >= 2 && daysDiff <= 7) {
        prev7Sessions.push(session);
      } else if (daysDiff >= 8) {
        olderSessions.push(session);
      }
    }

    const byNewest = (a: ConversationSession, b: ConversationSession): number =>
      b.createdAt - a.createdAt;
    todaySessions.sort(byNewest);
    yesterdaySessions.sort(byNewest);
    prev7Sessions.sort(byNewest);
    olderSessions.sort(byNewest);

    const result: DateGroup[] = [
      { label: 'Today', sessions: todaySessions },
      { label: 'Yesterday', sessions: yesterdaySessions },
      { label: 'Previous 7 days', sessions: prev7Sessions },
      { label: 'Older', sessions: olderSessions },
    ];

    return result.filter((group) => group.sessions.length > 0);
  }

  formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  onDeleteClick(event: Event, id: string): void {
    event.stopPropagation();
    this.sessionDeleted.emit(id);
  }
}
