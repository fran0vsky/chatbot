import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  inject,
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { ChatMessage } from '@org/shared-types';
import { TypingIndicator } from '../typing-indicator/typing-indicator.js';

@Component({
  standalone: true,
  selector: 'app-message-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  imports: [MarkdownComponent, TypingIndicator],
})
export class MessageBubble {
  @Input({ required: true }) message!: ChatMessage;
  @Input() typing = false;

  copied = false;
  private readonly cdr = inject(ChangeDetectorRef);

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
      () => {},
    );
  }
}
