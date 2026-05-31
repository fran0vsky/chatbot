import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToolInfo } from '@org/shared-types';

@Component({
  standalone: true,
  selector: 'app-input-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-composer.html',
  imports: [FormsModule],
})
export class InputComposer {
  @Input() placeholder = 'Message';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() tools: readonly ToolInfo[] = [];
  @Input() enabledToolNames: string[] = [];
  /** Whether the browser supports SpeechRecognition. When false, mic button is hidden. */
  @Input() sttSupported = false;
  /** Whether the mic is currently listening. Drives button visual state. */
  @Input() listening = false;
  @Output() send = new EventEmitter<string>();
  @Output() stop = new EventEmitter<void>();
  @Output() toolToggled = new EventEmitter<{ name: string; enabled: boolean }>();
  /** Emitted when the user clicks the mic button (toggle: start if idle, stop if listening). */
  @Output() micToggle = new EventEmitter<void>();

  draft = '';
  atMaxHeight = false;
  toolsOpen = false;

  @ViewChild('textareaRef') private textareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('toolsPopover') private toolsPopoverRef?: ElementRef<HTMLDivElement>;

  toggleToolsPopover(): void {
    this.toolsOpen = !this.toolsOpen;
  }

  isToolEnabled(name: string): boolean {
    return this.enabledToolNames.includes(name);
  }

  onToolCheckboxChange(name: string, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.toolToggled.emit({ name, enabled: input.checked });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.toolsOpen) return;
    const popover = this.toolsPopoverRef?.nativeElement;
    if (popover && !popover.contains(ev.target as Node)) {
      this.toolsOpen = false;
    }
  }

  submit(): void {
    if (this.loading) {
      this.stop.emit();
      return;
    }
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
    const computed = getComputedStyle(textarea);
    const parsed = parseFloat(computed.lineHeight);
    const lineHeight = Number.isNaN(parsed) ? 24 : parsed;
    const maxRows = 8;
    const maxHeight = lineHeight * maxRows;
    const target = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = target + 'px';
    this.atMaxHeight = textarea.scrollHeight > maxHeight;
  }
}
