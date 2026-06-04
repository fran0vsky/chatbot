import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToolInfo } from '@org/shared-types';

/** Payload emitted on submit: the trimmed text plus an optional attached image. */
export interface ComposerSubmit {
  text: string;
  imageDataUrl?: string;
}

/** Longest edge an attached image is downscaled to before sending (keeps payload small). */
const MAX_IMAGE_DIMENSION = 1024;
/** Reject originals larger than this before we even try to decode them. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Read an image File, downscale it so its longest edge is <= maxDim, and return a
 * JPEG data URL. Runs entirely in the browser — no upload until the message sends.
 */
function downscaleImage(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('no canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

@Component({
  standalone: true,
  selector: 'app-input-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-composer.html',
  imports: [FormsModule],
})
export class InputComposer implements AfterViewChecked {
  @Input() placeholder = 'Message';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() tools: readonly ToolInfo[] = [];
  @Input() enabledToolNames: string[] = [];
  /** Whether the browser supports SpeechRecognition. When false, mic button is hidden. */
  @Input() sttSupported = false;
  /** Whether the mic is currently listening. Drives button visual state. */
  @Input() listening = false;
  /** Whether image attach/paste is offered (vision input — VIS-01). */
  @Input() allowImage = false;
  @Output() send = new EventEmitter<ComposerSubmit>();
  @Output() stop = new EventEmitter<void>();
  @Output() toolToggled = new EventEmitter<{ name: string; enabled: boolean }>();
  /** Emitted when the user clicks the mic button (toggle: start if idle, stop if listening). */
  @Output() micToggle = new EventEmitter<void>();

  draft = '';
  atMaxHeight = false;
  toolsOpen = false;
  /** Tracks the last draft value that was used for resize, to guard ngAfterViewChecked. */
  private lastResizedDraft: string | undefined = undefined;
  /** Attached image as a (downscaled) data URL, shown as a thumbnail until sent. */
  attachedImageDataUrl: string | null = null;
  /** Transient message shown when an attachment is rejected. */
  imageError = '';

  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('textareaRef') private textareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('toolsPopover') private toolsPopoverRef?: ElementRef<HTMLDivElement>;
  @ViewChild('imageInput') private imageInputRef?: ElementRef<HTMLInputElement>;

  /**
   * Called every change-detection cycle. Re-runs autoResize only when `draft`
   * has changed since the last resize — ensures programmatic fills (suggestion
   * prompts, STT transcripts) size the textarea without requiring a keystroke.
   * Guarded by `lastResizedDraft` to avoid unbounded work every tick.
   */
  ngAfterViewChecked(): void {
    if (this.draft !== this.lastResizedDraft && this.textareaRef) {
      this.lastResizedDraft = this.draft;
      this.autoResize(this.textareaRef.nativeElement);
    }
  }

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

  // ─── Image attachment (VIS-01) ───────────────────────────────────────────

  openImagePicker(): void {
    this.imageInputRef?.nativeElement.click();
  }

  onImageSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.ingestImageFile(file);
    input.value = ''; // let the user re-pick the same file later
  }

  onPaste(ev: ClipboardEvent): void {
    if (!this.allowImage) return;
    const items = ev.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          ev.preventDefault(); // don't paste the binary blob into the textarea
          void this.ingestImageFile(file);
        }
        return;
      }
    }
  }

  removeImage(): void {
    this.attachedImageDataUrl = null;
    this.imageError = '';
  }

  private async ingestImageFile(file: File): Promise<void> {
    this.imageError = '';
    if (!file.type.startsWith('image/')) {
      this.imageError = 'Only image files can be attached.';
      this.cdr.markForCheck();
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError = 'Image is too large (max 5 MB).';
      this.cdr.markForCheck();
      return;
    }
    try {
      this.attachedImageDataUrl = await downscaleImage(file, MAX_IMAGE_DIMENSION);
    } catch {
      this.imageError = 'Could not read that image.';
    }
    this.cdr.markForCheck();
  }

  submit(): void {
    if (this.loading) {
      this.stop.emit();
      return;
    }
    const text = this.draft.trim();
    const imageDataUrl = this.attachedImageDataUrl ?? undefined;
    // An image alone (no text) is a valid send — e.g. "describe this".
    if (this.disabled || (text.length === 0 && !imageDataUrl)) return;
    this.draft = '';
    this.attachedImageDataUrl = null;
    this.imageError = '';
    if (this.textareaRef) {
      this.autoResize(this.textareaRef.nativeElement);
    }
    this.send.emit({ text, imageDataUrl });
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
