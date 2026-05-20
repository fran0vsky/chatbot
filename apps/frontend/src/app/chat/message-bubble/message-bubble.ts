import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import { ChatMessage } from '../chat.types';

@Component({
  standalone: true,
  selector: 'app-message-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  imports: [CommonModule, MarkdownComponent],
})
export class MessageBubble {
  @Input({ required: true }) message!: ChatMessage;
  @Input() typing = false;

  copied = false;

  private cdr = inject(ChangeDetectorRef);

  copyMessage(): void {
    navigator.clipboard.writeText(this.message.text).then(
      () => {
        this.copied = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.copied = false;
          this.cdr.markForCheck();
        }, 1500);
      },
      () => {
        // Clipboard blocked — leave copied as false, no logging
      }
    );
  }
}
