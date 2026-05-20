import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-chat-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-input.html',
  imports: [FormsModule],
})
export class ChatInput {
  @Input() placeholder = 'Message';
  @Input() disabled = false;
  @Output() send = new EventEmitter<string>();

  draft = '';

  @ViewChild('textareaRef') private textareaRef?: ElementRef<HTMLTextAreaElement>;

  submit(): void {
    if (this.disabled || this.draft.trim().length === 0) return;
    const text = this.draft.trim();
    this.draft = '';
    if (this.textareaRef) {
      this.autoResize(this.textareaRef.nativeElement);
    }
    this.send.emit(text);
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.submit();
    }
  }

  autoResize(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const lineHeight = 24;
    const maxRows = 5;
    textarea.style.height = Math.min(textarea.scrollHeight, lineHeight * maxRows) + 'px';
  }
}
