import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from './chat.service';
import { ChatMessage } from './chat.types';
import { MessageBubble } from './message-bubble/message-bubble';

@Component({
  standalone: true,
  selector: 'app-chat',
  imports: [CommonModule, FormsModule, MessageBubble],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent {
  private readonly chatService = inject(ChatService);
  private readonly cdr = inject(ChangeDetectorRef);

  messages: ChatMessage[] = [];
  draft = '';
  isLoading = false;

  @ViewChild('messageEnd') messageEnd?: ElementRef<HTMLElement>;
  @ViewChild('textareaRef') textareaRef?: ElementRef<HTMLTextAreaElement>;

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

    this.chatService.sendMessage(text).subscribe({
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
