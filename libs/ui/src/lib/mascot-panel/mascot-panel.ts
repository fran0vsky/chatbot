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
  @Output() themeToggled = new EventEmitter<void>();

  readonly waveBars = Array.from({ length: 22 }, (_, i) => ({
    i,
    h: 30 + ((i * 53) % 70),
    d: (i * 67) % 800,
  }));
}
