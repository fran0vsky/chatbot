import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type MascotStatus = 'idle' | 'thinking';

@Component({
  standalone: true,
  selector: 'app-mascot-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mascot-panel.html',
})
export class MascotPanel {
  @Input() status: MascotStatus = 'idle';
}
