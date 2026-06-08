import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

/**
 * Presentational donut ring displaying approximate context-window usage.
 * No injected services — all data is passed via inputs. Token estimation
 * lives in the consuming smart component and @org/shared-types helpers.
 *
 * Visual: a small SVG donut (background circle + foreground arc via
 * stroke-dasharray) whose arc length is proportional to `percent`.
 * Past `warnThreshold` the arc shifts to an amber warning colour.
 *
 * Part of Phase 32 / CTX-03 context-usage ring.
 */
@Component({
  standalone: true,
  selector: 'app-usage-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usage-ring.html',
})
export class UsageRing {
  /** Fill percentage, 0–100. Values outside this range are clamped. */
  @Input() percent = 0;
  /** Approximate token count, shown in tooltip when provided. */
  @Input() tokens?: number;
  /** Percentage threshold above which the ring switches to a warning colour. */
  @Input() warnThreshold = 80;

  /** Fixed SVG radius for the donut ring. */
  readonly radius = 8;

  /** Full circumference of the donut circle (2πr). */
  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  /** Clamped fill percentage (0–100). */
  get clampedPercent(): number {
    return Math.min(100, Math.max(0, this.percent));
  }

  /** Foreground arc length in SVG units — drives stroke-dasharray. */
  get dashLength(): number {
    return (this.circumference * this.clampedPercent) / 100;
  }

  /** True when fill is at or above the warning threshold. */
  get isWarning(): boolean {
    return this.clampedPercent >= this.warnThreshold;
  }

  /** Tooltip text summarising approximate usage. */
  get tooltipText(): string {
    const pct = `~${this.clampedPercent}%`;
    if (this.tokens !== undefined) {
      return `~${this.tokens.toLocaleString()} tokens (${pct})`;
    }
    return `Context: ${pct}`;
  }

  /** Accessible label for screen readers. */
  get ariaLabel(): string {
    return this.isWarning
      ? `Context window ${this.clampedPercent}% full — near limit`
      : `Context window ${this.clampedPercent}% full`;
  }
}
