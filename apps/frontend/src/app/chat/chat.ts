import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatMessage, ConversationSession } from '@org/shared-types';
import { HeaderBar, HistoryPanel, InputComposer, MessageBubble, ModelSelector, ToolCallBubble } from '@chatbot/ui';
import { ChatService } from './chat.service';
import { HistoryService } from './history.service';

const PLACEHOLDER_EXAMPLES = [
  'Explain quantum computing in simple terms...',
  'Write a poem about the ocean...',
  'Help me debug a TypeScript error...',
  'Summarize the history of jazz...',
] as const;

const PLACEHOLDER_NEUTRAL = 'Message';

@Component({
  standalone: true,
  selector: 'app-chat',
  imports: [HeaderBar, HistoryPanel, InputComposer, MessageBubble, ModelSelector, ToolCallBubble],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly historyService = inject(HistoryService);
  private readonly cdr = inject(ChangeDetectorRef);

  messages: ChatMessage[] = [{ text: 'Hello! How can I assist you today?', role: 'assistant' }];
  isLoading = false;
  selectedModel = 'openai/gpt-4o-mini';
  placeholder: string = PLACEHOLDER_EXAMPLES[0];
  isDayMode = false;
  historyOpen = false;
  sessions: ConversationSession[] = [];

  private sessionTitle = '';
  private sessionCreatedAt = 0;
  private currentRequest: Subscription | null = null;

  readonly models = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (free)' },
    { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (free)' },
    { id: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B (free)' },
  ] as const;

  @ViewChild('messageEnd') private messageEnd?: ElementRef<HTMLElement>;

  private placeholderIndex = 0;
  private placeholderTimer: ReturnType<typeof setInterval> | null = null;

  get activeSessionId(): string {
    return this.chatService.currentThreadId;
  }

  ngOnInit(): void {
    const saved = localStorage.getItem('desert-theme') as 'day' | 'night' | null;
    this.applyTheme(saved === 'day' ? 'day' : 'night');
    this.sessions = this.historyService.loadSessions();
    this.placeholderTimer = setInterval(() => {
      this.placeholderIndex = (this.placeholderIndex + 1) % PLACEHOLDER_EXAMPLES.length;
      this.placeholder = PLACEHOLDER_EXAMPLES[this.placeholderIndex];
      this.cdr.markForCheck();
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
    }
    this.currentRequest?.unsubscribe();
  }

  onStop(): void {
    if (!this.isLoading) return;
    this.currentRequest?.unsubscribe();
    this.currentRequest = null;
    this.isLoading = false;
    this.sessions = this.historyService.upsertSession({
      id: this.chatService.currentThreadId,
      title: this.sessionTitle || 'Untitled',
      messages: [...this.messages],
      createdAt: this.sessionCreatedAt || Date.now(),
    });
    this.cdr.detectChanges();
  }

  private applyTheme(mode: 'day' | 'night'): void {
    this.isDayMode = mode === 'day';
    document.documentElement.classList.remove('day-mode', 'night-mode');
    document.documentElement.classList.add(mode === 'day' ? 'day-mode' : 'night-mode');
    this.cdr.markForCheck();
  }

  toggleTheme(): void {
    const next = this.isDayMode ? 'night' : 'day';
    localStorage.setItem('desert-theme', next);
    this.applyTheme(next);
  }

  toggleHistory(): void {
    this.historyOpen = !this.historyOpen;
    this.cdr.markForCheck();
  }

  closeHistory(): void {
    this.historyOpen = false;
    this.cdr.markForCheck();
  }

  switchToSession(session: ConversationSession): void {
    this.saveCurrentSession();
    this.messages = session.messages;
    this.sessionTitle = session.title;
    this.sessionCreatedAt = session.createdAt;
    this.chatService.setThread(session.id);
    this.historyOpen = false;
    this.cdr.detectChanges();
  }

  deleteSession(id: string): void {
    const wasActive = this.chatService.currentThreadId === id;
    this.sessions = this.historyService.deleteSession(id);
    if (wasActive) {
      this.startNewChat();
    }
    this.cdr.markForCheck();
  }

  renameSession(id: string, title: string): void {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    this.sessions = this.historyService.updateTitle(id, trimmed);
    if (this.chatService.currentThreadId === id) {
      this.sessionTitle = trimmed;
    }
    this.cdr.markForCheck();
  }

  togglePinSession(id: string): void {
    this.sessions = this.historyService.togglePin(id);
    this.cdr.markForCheck();
  }

  newChat(): void {
    this.saveCurrentSession();
    this.startNewChat();
  }

  private startNewChat(): void {
    this.messages = [{ text: 'Hello! How can I assist you today?', role: 'assistant' }];
    this.sessionTitle = '';
    this.sessionCreatedAt = 0;
    this.chatService.resetThread();
    this.historyOpen = false;
    this.cdr.detectChanges();
  }

  private saveCurrentSession(): void {
    if (!this.messages.some((m) => m.role === 'user')) return;
    this.sessions = this.historyService.upsertSession({
      id: this.chatService.currentThreadId,
      title: this.sessionTitle || 'Untitled',
      messages: [...this.messages],
      createdAt: this.sessionCreatedAt || Date.now(),
    });
  }

  onSend(text: string): void {
    if (this.isLoading) return;

    if (!this.sessionTitle) {
      this.sessionTitle = text.length > 50 ? text.slice(0, 50) + '…' : text;
      this.sessionCreatedAt = Date.now();
    }

    this.messages.push({ text, role: 'user' });
    this.beginRequest();
    this.dispatchRequest(text);
  }

  onRegenerate(index: number): void {
    if (this.isLoading) return;
    if (index <= 0 || index >= this.messages.length) return;
    const target = this.messages[index];
    if (target.role !== 'assistant') return;
    const prevUser = this.messages[index - 1];
    if (!prevUser || prevUser.role !== 'user') return;

    this.messages = this.messages.slice(0, index);
    this.beginRequest();
    this.dispatchRequest(prevUser.text);
  }

  onEditAndResend(index: number, newText: string): void {
    if (this.isLoading) return;
    const target = this.messages[index];
    if (!target || target.role !== 'user') return;

    this.saveCurrentSession();

    const truncated = this.messages.slice(0, index);
    this.chatService.resetThread();
    this.sessionTitle = newText.length > 50 ? newText.slice(0, 50) + '…' : newText;
    this.sessionCreatedAt = Date.now();
    this.messages = [...truncated, { text: newText, role: 'user' }];
    this.beginRequest();
    this.dispatchRequest(newText);
  }

  private beginRequest(): void {
    this.isLoading = true;
    this.placeholder = PLACEHOLDER_NEUTRAL;
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
      this.placeholderTimer = null;
    }
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private dispatchRequest(text: string): void {
    this.currentRequest?.unsubscribe();
    this.currentRequest = this.chatService.sendMessage(text, this.selectedModel).subscribe({
      next: (resp) => {
        if (resp.toolCalls && resp.toolCalls.length > 0) {
          for (const call of resp.toolCalls) {
            this.messages.push({
              text: '',
              role: 'tool',
              toolName: call.name,
              toolArgs: call.args,
              toolResult: call.result,
            });
          }
        }
        this.messages.push({ text: resp.response, role: 'assistant' });
        this.currentRequest = null;
        this.finishRequest();
      },
      error: (err: unknown) => {
        const body = (err as { error?: { message?: string; link?: string } })?.error;
        const errorText = body?.message ?? 'Something went wrong. Please try again.';
        const linkPart = body?.link ? `\n\n[View model on OpenRouter](${body.link})` : '';
        this.messages.push({ text: errorText + linkPart, role: 'error' });
        this.currentRequest = null;
        this.finishRequest();
      },
    });
  }

  private finishRequest(): void {
    this.isLoading = false;
    this.sessions = this.historyService.upsertSession({
      id: this.chatService.currentThreadId,
      title: this.sessionTitle,
      messages: [...this.messages],
      createdAt: this.sessionCreatedAt,
    });
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messageEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0);
  }
}
