import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ConversationSession } from '@org/shared-types';

@Component({
  standalone: true,
  selector: 'app-history-panel',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-panel.html',
})
export class HistoryPanel {
  @Input() open = false;
  @Input() sessions: ConversationSession[] = [];
  @Input() activeSessionId = '';
  @Output() sessionSelected = new EventEmitter<ConversationSession>();
  @Output() sessionDeleted = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();

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
