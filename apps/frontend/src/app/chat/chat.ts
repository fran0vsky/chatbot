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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from './chat.service';
import { ChatMessage } from './chat.types';
import { MessageBubble } from './message-bubble/message-bubble';

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
  imports: [CommonModule, FormsModule, MessageBubble],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly cdr = inject(ChangeDetectorRef);

  messages: ChatMessage[] = [];
  draft = '';
  isLoading = false;
  selectedModel = 'openai/gpt-4o-mini';
  placeholder: string = PLACEHOLDER_EXAMPLES[0];

  readonly models = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
  ] as const;

  @ViewChild('messageEnd') messageEnd?: ElementRef<HTMLElement>;
  @ViewChild('textareaRef') textareaRef?: ElementRef<HTMLTextAreaElement>;

  private placeholderIndex = 0;
  private placeholderTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.placeholderTimer = setInterval(() => {
      this.placeholderIndex = (this.placeholderIndex + 1) % PLACEHOLDER_EXAMPLES.length;
      this.placeholder = PLACEHOLDER_EXAMPLES[this.placeholderIndex];
      this.cdr.markForCheck();
    }, 3000);
  }

  ngOnDestroy(): void {
    this.stopPlaceholderRotation();
  }

  stopPlaceholderRotation(): void {
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
      this.placeholderTimer = null;
      this.placeholder = PLACEHOLDER_NEUTRAL;
    }
  }

  newChat(): void {
    this.messages = [];
    this.draft = '';
    this.chatService.resetThread();
    if (this.textareaRef) {
      this.autoResize(this.textareaRef.nativeElement);
    }
    this.cdr.detectChanges();
  }

  send(): void {
    if (this.isLoading) return;
    if (this.draft.trim().length === 0) return;

    const text = this.draft.trim();
    this.messages.push({ text, role: 'user' });
    this.draft = '';
    if (this.textareaRef) {
      this.autoResize(this.textareaRef.nativeElement);
    }
    this.isLoading = true;
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

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.send();
    }
  }

  autoResize(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const lineHeight = 24;
    const maxRows = 5;
    textarea.style.height = Math.min(textarea.scrollHeight, lineHeight * maxRows) + 'px';
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messageEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0);
  }
}
