import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { DinoSummary } from '@org/shared-types';
import { DinoCard } from '../dino-card/dino-card';

@Component({
  standalone: true,
  selector: 'app-dino-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DinoCard],
  templateUrl: './dino-picker.html',
})
export class DinoPicker {
  @Input() dinos: DinoSummary[] = [];
  @Input() activeDinoId?: string;
  @Output() dinoSelected = new EventEmitter<DinoSummary>();
}
