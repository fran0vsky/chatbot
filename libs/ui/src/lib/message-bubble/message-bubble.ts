import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';
import { ChatMessage } from '@org/shared-types';
import { ReasoningBlock } from '../reasoning-block/reasoning-block.js';
import { TypingIndicator } from '../typing-indicator/typing-indicator.js';
import { Mascot } from '../mascot/mascot.js';

@Component({
  standalone: true,
  selector: 'app-message-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  imports: [MarkdownComponent, ReasoningBlock, TypingIndicator, Mascot, FormsModule],
})
export class MessageBubble {
  @Input({ required: true }) message!: ChatMessage;
  @Input() typing = false;
  @Input() animate = false;
  @Input() canRegenerate = false;
  @Input() canEdit = false;

  @Output() regenerate = new EventEmitter<void>();
  @Output() editSubmit = new EventEmitter<string>();

  copied = false;
  editing = false;
  editDraft = '';

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly COPY_ICON_SVG =
    '<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
    '<path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />' +
    '<path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />' +
    '</svg>';

  private readonly CHECK_ICON_SVG =
    '<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
    '<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clip-rule="evenodd" />' +
    '</svg>';

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

  startEdit(): void {
    this.editDraft = this.message.text;
    this.editing = true;
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editing = false;
    this.editDraft = '';
    this.cdr.markForCheck();
  }

  submitEdit(): void {
    const trimmed = this.editDraft.trim();
    if (trimmed.length === 0 || trimmed === this.message.text) {
      this.cancelEdit();
      return;
    }
    this.editing = false;
    this.editSubmit.emit(trimmed);
    this.cdr.markForCheck();
  }

  onEditKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.submitEdit();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.cancelEdit();
    }
  }

  onRegenerate(): void {
    this.regenerate.emit();
  }

  onMarkdownReady(): void {
    const pres = this.host.nativeElement.querySelectorAll('pre');
    pres.forEach((pre: HTMLPreElement) => {
      if (pre.dataset['headerInjected'] === 'true') return;
      pre.dataset['headerInjected'] = 'true';

      const code = pre.querySelector('code');
      if (!code) return;

      let language = '';
      code.classList.forEach((cls) => {
        if (cls.startsWith('language-')) {
          language = cls.slice('language-'.length).toLowerCase();
        }
      });
      if (language === 'none' || language === 'text') {
        language = '';
      }

      const header: HTMLDivElement = document.createElement('div');
      header.className =
        'flex items-center justify-between px-3 py-2 ' +
        'bg-studio-card dark:bg-studio-night-card ' +
        'border-b border-studio-border dark:border-studio-night-border';

      const label: HTMLSpanElement = document.createElement('span');
      label.className =
        'text-xs font-mono text-studio-ink-muted dark:text-studio-night-muted';
      label.textContent = language;

      const button: HTMLButtonElement = document.createElement('button');
      button.type = 'button';
      button.className =
        'p-1 rounded text-studio-ink-muted dark:text-studio-night-muted ' +
        'hover:bg-studio-border dark:hover:bg-studio-night-border ' +
        'hover:text-studio-ink dark:hover:text-studio-night-text transition-colors';
      button.setAttribute('aria-label', 'Copy code');
      button.innerHTML = this.COPY_ICON_SVG;
      button.addEventListener('click', () => this.copyCodeBlock(button, code));

      header.appendChild(label);
      header.appendChild(button);
      pre.insertBefore(header, pre.firstChild);
    });
  }

  private copyCodeBlock(button: HTMLButtonElement, code: HTMLElement): void {
    navigator.clipboard.writeText(code.textContent ?? '').then(
      () => {
        button.innerHTML = this.CHECK_ICON_SVG;
        button.setAttribute('aria-label', 'Copied');
        setTimeout(() => {
          button.innerHTML = this.COPY_ICON_SVG;
          button.setAttribute('aria-label', 'Copy code');
        }, 2000);
      },
      () => {},
    );
  }
}
