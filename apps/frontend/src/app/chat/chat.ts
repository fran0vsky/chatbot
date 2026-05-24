import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ChatMessage, ConversationSession, StreamEvent, ToolCallRecord } from '@org/shared-types';
import { HeaderBar, HistoryPanel, InputComposer, MessageBubble, ModelSelector, ReasoningBlock, ToolCallBubble } from '@chatbot/ui';
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
  imports: [HeaderBar, HistoryPanel, InputComposer, MessageBubble, ModelSelector, ReasoningBlock, ToolCallBubble],
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
  private currentAbort: AbortController | null = null;
  private streamingToolCallIds: string[] = [];

  readonly streamingText = signal('');
  readonly streamingReasoning = signal('');
  readonly reasoningCollapsed = signal(false);
  readonly streamingReasoningDurationMs = signal<number | undefined>(undefined);
  readonly streamingError = signal<string | null>(null);
  readonly streamingToolCalls = signal<ToolCallRecord[]>([]);
  readonly isStreaming = signal(false);

  readonly models = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (free)' },
    { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (free)' },
    { id: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B (free)' },
    { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free, reasoning)' },
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
    this.currentAbort?.abort();
  }

  onStop(): void {
    if (!this.isStreaming() && !this.isLoading) return;
    this.currentAbort?.abort();
    this.currentAbort = null;
    const partial = this.streamingText();
    for (const call of this.streamingToolCalls()) {
      this.messages.push({
        text: '',
        role: 'tool',
        toolName: call.name,
        toolArgs: call.args,
        toolResult: call.result,
      });
    }
    if (partial.length > 0) {
      const partialReasoning = this.streamingReasoning();
      this.messages.push({
        text: partial,
        role: 'assistant',
        ...(partialReasoning.length > 0 ? { reasoning: partialReasoning } : {}),
      });
    }
    this.clearStreaming();
    this.isLoading = false;
    this.sessions = this.historyService.upsertSession({
      id: this.chatService.currentThreadId,
      title: this.sessionTitle || 'Untitled',
      messages: [...this.messages],
      createdAt: this.sessionCreatedAt || Date.now(),
    });
    this.cdr.detectChanges();
    this.scrollToBottom();
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
    if (this.isLoading || this.isStreaming()) return;

    if (!this.sessionTitle) {
      this.sessionTitle = text.length > 50 ? text.slice(0, 50) + '…' : text;
      this.sessionCreatedAt = Date.now();
    }

    this.messages.push({ text, role: 'user' });
    this.beginRequest();
    this.dispatchRequest(text);
  }

  onRegenerate(index: number): void {
    if (this.isLoading || this.isStreaming()) return;
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
    if (this.isLoading || this.isStreaming()) return;
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

  private async dispatchRequest(text: string): Promise<void> {
    this.currentAbort?.abort();
    const controller = new AbortController();
    this.currentAbort = controller;

    this.streamingText.set('');
    this.streamingError.set(null);
    this.streamingToolCalls.set([]);
    this.streamingToolCallIds = [];
    this.isStreaming.set(true);

    try {
      for await (const event of this.chatService.streamMessage(
        text,
        this.selectedModel,
        controller.signal,
      )) {
        this.handleStreamEvent(event);
      }
    } catch {
      // service swallows AbortError; any other throw becomes a generic error event already
    } finally {
      if (this.currentAbort === controller) this.currentAbort = null;
    }
  }

  private handleStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'reasoning_token': {
        if (this.isLoading) this.isLoading = false;
        this.streamingReasoning.update((s) => s + event.text);
        this.cdr.markForCheck();
        return;
      }
      case 'token': {
        if (this.isLoading) {
          this.isLoading = false;
        }
        if (this.streamingReasoning().length > 0 && !this.reasoningCollapsed()) {
          this.reasoningCollapsed.set(true);
        }
        this.streamingText.update((s) => s + event.text);
        this.cdr.markForCheck();
        this.scrollToBottom();
        return;
      }
      case 'tool_call_start': {
        this.streamingToolCallIds.push(event.id);
        this.streamingToolCalls.update((arr) => [
          ...arr,
          { name: event.name, args: event.args, result: '' },
        ]);
        this.cdr.markForCheck();
        this.scrollToBottom();
        return;
      }
      case 'tool_call_result': {
        const idx = this.streamingToolCallIds.indexOf(event.id);
        if (idx === -1) return;
        this.streamingToolCalls.update((arr) => {
          const next = arr.slice();
          next[idx] = { ...next[idx], result: event.result };
          return next;
        });
        this.cdr.markForCheck();
        return;
      }
      case 'done': {
        this.commitTurn(event.response, event.toolCalls ?? [], event.reasoning, event.reasoningDurationMs);
        return;
      }
      case 'error': {
        this.commitErrorTurn(event.message, event.link);
        return;
      }
    }
  }

  private commitTurn(
    response: string,
    toolCalls: ToolCallRecord[],
    reasoning?: string,
    reasoningDurationMs?: number,
  ): void {
    for (const call of toolCalls) {
      this.messages.push({
        text: '',
        role: 'tool',
        toolName: call.name,
        toolArgs: call.args,
        toolResult: call.result,
      });
    }
    const assistantMsg: ChatMessage = {
      text: response,
      role: 'assistant',
      ...(reasoning ? { reasoning } : {}),
      ...(reasoningDurationMs !== undefined ? { reasoningDurationMs } : {}),
    };
    this.messages.push(assistantMsg);
    this.clearStreaming();
    this.finishRequest();
  }

  private commitErrorTurn(message: string, link?: string): void {
    const partial = this.streamingText();
    if (partial.length > 0) {
      for (const call of this.streamingToolCalls()) {
        this.messages.push({
          text: '',
          role: 'tool',
          toolName: call.name,
          toolArgs: call.args,
          toolResult: call.result,
        });
      }
      const footer = link
        ? `\n\n_Response interrupted: ${message}_ ([details](${link}))`
        : `\n\n_Response interrupted: ${message}_`;
      this.messages.push({ text: partial + footer, role: 'assistant' });
    } else {
      const linkPart = link ? `\n\n[View model on OpenRouter](${link})` : '';
      this.messages.push({ text: message + linkPart, role: 'error' });
    }
    this.clearStreaming();
    this.finishRequest();
  }

  private clearStreaming(): void {
    this.streamingText.set('');
    this.streamingReasoning.set('');
    this.reasoningCollapsed.set(false);
    this.streamingReasoningDurationMs.set(undefined);
    this.streamingError.set(null);
    this.streamingToolCalls.set([]);
    this.streamingToolCallIds = [];
    this.isStreaming.set(false);
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
