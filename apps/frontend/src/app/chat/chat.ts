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
import { ChatMessage } from '@org/shared-types';
import { ChatHeader, ChatInput, MessageBubble } from '@chatbot/ui';
import { ChatService } from './chat.service';

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
  imports: [ChatHeader, ChatInput, MessageBubble],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly cdr = inject(ChangeDetectorRef);

  messages: ChatMessage[] = [{ text: 'Hello! How can I assist you today?', role: 'assistant' }];
  isLoading = false;
  selectedModel = 'openai/gpt-4o-mini';
  placeholder: string = PLACEHOLDER_EXAMPLES[0];
  isDayMode = false;

  readonly models = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
  ] as const;

  @ViewChild('messageEnd') private messageEnd?: ElementRef<HTMLElement>;

  private placeholderIndex = 0;
  private placeholderTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const saved = localStorage.getItem('desert-theme') as 'day' | 'night' | null;
    this.applyTheme(saved === 'day' ? 'day' : 'night');
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

  newChat(): void {
    this.messages = [{ text: 'Hello! How can I assist you today?', role: 'assistant' }];
    this.chatService.resetThread();
    this.cdr.detectChanges();
  }

  onSend(text: string): void {
    if (this.isLoading) return;

    this.messages.push({ text, role: 'user' });
    this.isLoading = true;
    this.placeholder = PLACEHOLDER_NEUTRAL;
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
      this.placeholderTimer = null;
    }
    this.cdr.detectChanges();
    this.scrollToBottom();

    this.chatService.sendMessage(text, this.selectedModel).subscribe({
      next: (resp) => {
        this.messages.push({ text: resp.response, role: 'assistant' });
        this.isLoading = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: () => {
        this.messages.push({ text: 'Something went wrong. Please try again.', role: 'error' });
        this.isLoading = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messageEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0);
  }
}
