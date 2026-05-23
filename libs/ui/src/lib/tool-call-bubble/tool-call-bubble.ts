import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  inject,
} from '@angular/core';
import { ChatMessage } from '@org/shared-types';

@Component({
  standalone: true,
  selector: 'app-tool-call-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tool-call-bubble.html',
  styleUrl: './tool-call-bubble.scss',
})
export class ToolCallBubble {
  @Input({ required: true }) message!: ChatMessage;

  expanded = false;

  private readonly cdr = inject(ChangeDetectorRef);

  get prettyArgs(): string {
    const args = this.message.toolArgs;
    if (!args || Object.keys(args).length === 0) return '(no arguments)';
    return JSON.stringify(args, null, 2);
  }

  get resultText(): string {
    return this.message.toolResult && this.message.toolResult.length > 0
      ? this.message.toolResult
      : '(no result)';
  }

  toggle(): void {
    this.expanded = !this.expanded;
    this.cdr.markForCheck();
  }
}
