import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type MascotStatus = 'idle' | 'thinking';

@Component({
  standalone: true,
  selector: 'app-mascot-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mascot-panel.html',
  styles: [':host { display: contents; }'],
})
export class MascotPanel {
  @Input() status: MascotStatus = 'idle';
  @Input() isDayMode = false;

  /** Active dino — drives the big body sprite + name label. Falls back to Spino. */
  @Input() dinoId?: string;
  @Input() dinoName?: string;

  @Output() themeToggled = new EventEmitter<void>();

  /** Display name in the panel header/footer. */
  get displayName(): string {
    return this.dinoName ?? 'Spino';
  }

  /** Bottom-anchored body sprite for the given theme — active dino, else Spino. */
  bodySrc(theme: 'day' | 'night'): string {
    return this.dinoId
      ? `/spino/dinos/${this.dinoId}-${theme}.png`
      : `/spino/mascot-${theme}.png`;
  }

  readonly waveBars = Array.from({ length: 22 }, (_, i) => ({
    i,
    h: 30 + ((i * 53) % 70),
    d: (i * 67) % 800,
  }));
}
