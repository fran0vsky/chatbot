import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type MascotSize = 'sm' | 'hero';

@Component({
  standalone: true,
  selector: 'app-mascot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mascot.html',
})
export class Mascot {
  @Input() size: MascotSize = 'sm';
}
