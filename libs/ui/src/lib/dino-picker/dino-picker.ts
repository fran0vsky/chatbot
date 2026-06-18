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
  /** Emitted when the user clicks the "add a dino" tile (D-06). */
  @Output() addDino = new EventEmitter<void>();
  /** Passthrough from DinoCard — carries the dino to edit. */
  @Output() editDino = new EventEmitter<DinoSummary>();
  /** Passthrough from DinoCard — carries the dino to delete. */
  @Output() deleteDino = new EventEmitter<DinoSummary>();
}
