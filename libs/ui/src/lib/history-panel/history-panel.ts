import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChildren,
  QueryList,
  AfterViewChecked,
  inject,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConversationSession } from '@org/shared-types';
import { Mascot } from '../mascot/mascot';

interface DateGroup {
  label: string;
  sessions: ConversationSession[];
}

@Component({
  standalone: true,
  selector: 'app-history-panel',
  imports: [NgClass, NgTemplateOutlet, FormsModule, Mascot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-panel.html',
  styles: [':host { display: contents; }'],
})
export class HistoryPanel implements AfterViewChecked {
  @Input() open = false;
  @Input() mobileOpen = false;
  @Input() sessions: ConversationSession[] = [];
  @Input() activeSessionId = '';
  @Input() activeView: 'chats' | 'knowledge' | 'groupchat' | 'arena' | 'leaderboard' = 'chats';
  @Output() sessionSelected = new EventEmitter<ConversationSession>();
  @Output() sessionDeleted = new EventEmitter<string>();
  @Output() sessionRenamed = new EventEmitter<{ id: string; title: string }>();
  @Output() sessionPinned = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() viewChange = new EventEmitter<'chats' | 'knowledge' | 'groupchat' | 'arena' | 'leaderboard'>();

  renamingId: string | null = null;
  renameDraft = '';
  confirmingDeleteId: string | null = null;

  private readonly cdr = inject(ChangeDetectorRef);
  private focusRenameId: string | null = null;

  @ViewChildren('renameInput') private renameInputs?: QueryList<ElementRef<HTMLInputElement>>;

  get groupedSessions(): DateGroup[] {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    const pinnedSessions: ConversationSession[] = [];
    const todaySessions: ConversationSession[] = [];
    const yesterdaySessions: ConversationSession[] = [];
    const prev7Sessions: ConversationSession[] = [];
    const olderSessions: ConversationSession[] = [];

    for (const session of this.sessions) {
      if (session.pinned) {
        pinnedSessions.push(session);
        continue;
      }
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
    pinnedSessions.sort(byNewest);
    todaySessions.sort(byNewest);
    yesterdaySessions.sort(byNewest);
    prev7Sessions.sort(byNewest);
    olderSessions.sort(byNewest);

    const result: DateGroup[] = [
      { label: 'Pinned', sessions: pinnedSessions },
      { label: 'Today', sessions: todaySessions },
      { label: 'Yesterday', sessions: yesterdaySessions },
      { label: 'Previous 7 days', sessions: prev7Sessions },
      { label: 'Older', sessions: olderSessions },
    ];

    return result.filter((group) => group.sessions.length > 0);
  }

  /** Max participant mascots shown in a group-thread cluster (the rest are summarized as +N). */
  static readonly MAX_CLUSTER_MASCOTS = 3;

  /** The first few participant dino ids for the group-thread mascot cluster. */
  clusterDinoIds(session: ConversationSession): string[] {
    return (session.participantDinoIds ?? []).slice(0, HistoryPanel.MAX_CLUSTER_MASCOTS);
  }

  /** Count of participants beyond the displayed cluster (for the +N badge), or 0. */
  extraParticipantCount(session: ConversationSession): number {
    const total = session.participantDinoIds?.length ?? 0;
    return Math.max(0, total - HistoryPanel.MAX_CLUSTER_MASCOTS);
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

  startRename(event: Event, session: ConversationSession): void {
    event.stopPropagation();
    this.renamingId = session.id;
    this.renameDraft = session.title;
    this.confirmingDeleteId = null;
    this.focusRenameId = session.id;
    this.cdr.markForCheck();
  }

  onRenameKeydown(event: KeyboardEvent, session: ConversationSession): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename(session);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename();
    }
  }

  commitRename(session: ConversationSession): void {
    const trimmed = this.renameDraft.trim();
    if (trimmed.length > 0 && trimmed !== session.title) {
      this.sessionRenamed.emit({ id: session.id, title: trimmed });
    }
    this.cancelRename();
  }

  cancelRename(): void {
    this.renamingId = null;
    this.renameDraft = '';
    this.cdr.markForCheck();
  }

  onTitleDblClick(event: Event, session: ConversationSession): void {
    this.startRename(event, session);
  }

  requestDelete(event: Event, id: string): void {
    event.stopPropagation();
    this.confirmingDeleteId = id;
    this.cdr.markForCheck();
  }

  confirmDelete(event: Event, id: string): void {
    event.stopPropagation();
    this.confirmingDeleteId = null;
    this.sessionDeleted.emit(id);
  }

  cancelDelete(event: Event): void {
    event.stopPropagation();
    this.confirmingDeleteId = null;
    this.cdr.markForCheck();
  }

  onPinClick(event: Event, id: string): void {
    event.stopPropagation();
    this.sessionPinned.emit(id);
  }

  ngAfterViewChecked(): void {
    if (this.focusRenameId && this.renameInputs) {
      const input = this.renameInputs.find(
        (ref) => ref.nativeElement.dataset['sessionId'] === this.focusRenameId,
      );
      if (input) {
        input.nativeElement.focus();
        input.nativeElement.select();
        this.focusRenameId = null;
      }
    }
  }
}
