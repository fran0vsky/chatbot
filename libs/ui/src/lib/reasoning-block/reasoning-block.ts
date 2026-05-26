import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-reasoning-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reasoning-block.html',
})
export class ReasoningBlock {
  @Input({ required: true }) reasoning = '';
  @Input() streaming = false;
  @Input() durationMs?: number;
  @Input() autoCollapsed = false;

  private readonly userToggle = signal<boolean | null>(null);

  readonly collapsed = computed(() => {
    const override = this.userToggle();
    if (override !== null) return override;
    if (this.streaming) return false;
    return this.autoCollapsed;
  });

  toggle(): void {
    this.userToggle.set(!this.collapsed());
  }

  hasReasoning(): boolean {
    return this.reasoning.trim().length > 0;
  }

  /**
   * Header chip text:
   *  - streaming             => "Thinking…"
   *  - done + durationMs     => "Thought for X.Xs"
   *  - done + no duration    => "Reasoning"
   */
  headerLabel(): string {
    if (this.streaming) return 'Thinking…';
    if (this.durationMs != null) {
      return `Thought for ${(this.durationMs / 1000).toFixed(1)}s`;
    }
    return 'Reasoning';
  }

  ariaLabel(): string {
    return this.collapsed() ? 'Show model reasoning' : 'Hide model reasoning';
  }

  // Kept for backwards-compat with any external references; not used in template.
  toggleLabel(): string {
    return this.headerLabel();
  }
}
