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
  /**
   * When true the card belongs to the current user (id starts with 'custom:').
   * Enables the edit and delete affordances and swaps the mascot for avatarUrl.
   */
  @Input() custom = false;
  @Output() selected = new EventEmitter<DinoSummary>();
  @Output() editDino = new EventEmitter<DinoSummary>();
  @Output() deleteDino = new EventEmitter<DinoSummary>();
}
