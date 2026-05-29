import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { DinoSummary } from '@org/shared-types';
import { Mascot } from '../mascot/mascot';

@Component({
  standalone: true,
  selector: 'app-dino-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Mascot],
  templateUrl: './dino-card.html',
})
export class DinoCard {
  @Input({ required: true }) dino!: DinoSummary;
  @Input() active = false;
  @Output() selected = new EventEmitter<DinoSummary>();
}
