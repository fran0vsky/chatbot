import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CuratedModel,
  DinoSummary,
  UpdateCustomDinoRequest,
} from '@org/shared-types';
import { DinoService } from './dino.service';

const TOOL_CATALOGUE = [
  { name: 'get_current_time', label: 'Current time' },
  { name: 'web_search', label: 'Web search' },
  { name: 'fetch_page', label: 'Fetch page' },
] as const;

/**
 * Smart standalone OnPush component for creating and editing custom dinos.
 * Injects DinoService for all HTTP calls (D-04).
 *
 * Modes:
 *  - Create: no [editing] input — form starts blank.
 *  - Edit:   [editing] input set — form pre-fills from the summary.
 *
 * Emits (saved) when the backend confirms; (cancelled) on cancel click.
 */
@Component({
  standalone: true,
  selector: 'app-custom-dino-creator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './custom-dino-creator.html',
})
export class CustomDinoCreator implements OnInit {
  private readonly dinoService = inject(DinoService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** When set, the form opens in edit mode pre-filled with this dino's values. */
  @Input() editing?: DinoSummary;

  /** Emitted after a successful create or update. */
  @Output() saved = new EventEmitter<void>();

  /** Emitted when the user cancels without saving. */
  @Output() cancelled = new EventEmitter<void>();

  // ─── Catalogue state ────────────────────────────────────────────────────
  readonly models = signal<CuratedModel[]>([]);
  readonly tools = TOOL_CATALOGUE;

  // ─── Form fields (D-05) ─────────────────────────────────────────────────
  readonly name = signal('');
  readonly blurb = signal('');
  /** The reaction/personality prompt → backend's systemPrompt field. */
  readonly systemPrompt = signal('');
  readonly selectedModel = signal('');
  readonly selectedTools = signal<string[]>([]);
  readonly avatarUrl = signal('');

  // ─── Upload / save state ─────────────────────────────────────────────────
  readonly uploading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Save is enabled only when required fields are filled and no operation is
   * in progress.
   */
  readonly canSave = computed(
    () =>
      this.name().trim().length > 0 &&
      this.systemPrompt().trim().length > 0 &&
      this.selectedModel().length > 0 &&
      !this.uploading() &&
      !this.saving(),
  );

  ngOnInit(): void {
    // Seed fields from the editing summary if provided (D-04).
    if (this.editing) {
      this.name.set(this.editing.name);
      this.blurb.set(this.editing.blurb ?? '');
      this.avatarUrl.set(this.editing.avatarUrl ?? '');
      this.selectedModel.set(this.editing.model ?? '');
      this.selectedTools.set([...(this.editing.toolNames ?? [])]);
      // systemPrompt is not in the summary projection — leave blank with hint.
    }

    // Load the curated model catalogue for the dropdown.
    this.dinoService.fetchModels().subscribe({
      next: (list) => {
        this.models.set(list);
        // Default to first model when creating (not pre-seeded by editing).
        if (!this.editing && list.length > 0 && !this.selectedModel()) {
          this.selectedModel.set(list[0].id);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set('Could not load models. Check your connection.');
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Avatar upload (D-04) ────────────────────────────────────────────────

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.error.set(null);

    this.dinoService.uploadAvatar(file).subscribe({
      next: (res) => {
        this.avatarUrl.set(res.url);
        this.uploading.set(false);
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Avatar upload failed.';
        this.error.set(msg);
        this.uploading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Tool checkbox toggle ────────────────────────────────────────────────

  isToolSelected(name: string): boolean {
    return this.selectedTools().includes(name);
  }

  toggleTool(name: string): void {
    this.selectedTools.update((current) =>
      current.includes(name)
        ? current.filter((t) => t !== name)
        : [...current, name],
    );
  }

  // ─── Save (create or update) ─────────────────────────────────────────────

  save(): void {
    if (!this.canSave()) return;

    this.saving.set(true);
    this.error.set(null);

    const toolNames = this.selectedTools();
    const avatarUrl = this.avatarUrl() || undefined;

    if (this.editing) {
      // Edit mode — PATCH only what the form provides (D-04).
      const req: UpdateCustomDinoRequest = {
        name: this.name().trim(),
        blurb: this.blurb().trim() || undefined,
        systemPrompt: this.systemPrompt().trim() || undefined,
        model: this.selectedModel(),
        toolNames,
        avatarUrl,
      };
      this.dinoService.updateCustomDino(this.editing.id, req).subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          const msg = this.extractError(err);
          this.error.set(msg);
          this.saving.set(false);
          this.cdr.markForCheck();
        },
      });
    } else {
      // Create mode — all required fields must be present.
      this.dinoService
        .createCustomDino({
          name: this.name().trim(),
          blurb: this.blurb().trim() || undefined,
          systemPrompt: this.systemPrompt().trim(),
          model: this.selectedModel(),
          toolNames,
          avatarUrl,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.saved.emit();
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            const msg = this.extractError(err);
            this.error.set(msg);
            this.saving.set(false);
            this.cdr.markForCheck();
          },
        });
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Extract a human-readable error message from an HTTP error. */
  private extractError(err: unknown): string {
    if (err && typeof err === 'object') {
      const e = err as { error?: { message?: string }; message?: string };
      if (e.error?.message) return e.error.message;
      if (e.message) return e.message;
    }
    return 'Something went wrong. Please try again.';
  }
}
