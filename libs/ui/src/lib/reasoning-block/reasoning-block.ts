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

  durationLabel(): string {
    if (this.durationMs == null) {
      return this.streaming ? 'Thinking…' : '';
    }
    if (this.durationMs < 1000) return 'Thought for <1s';
    return `Thought for ${Math.round(this.durationMs / 1000)}s`;
  }

  actionLabel(): string {
    return this.collapsed() ? 'Show reasoning' : 'Hide reasoning';
  }

  ariaLabel(): string {
    return this.collapsed() ? 'Show model reasoning' : 'Hide model reasoning';
  }

  toggleLabel(): string {
    const dur = this.durationLabel();
    const action = this.actionLabel();
    return dur ? `${dur} · ${action}` : action;
  }
}
