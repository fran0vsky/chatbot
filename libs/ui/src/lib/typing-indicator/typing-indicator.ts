import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Mascot } from '../mascot/mascot.js';

@Component({
  standalone: true,
  selector: 'app-typing-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './typing-indicator.html',
  styleUrl: './typing-indicator.scss',
  imports: [Mascot],
})
export class TypingIndicator {
  /**
   * When set, the avatar shows this dino's art (via the mascot component, which
   * falls back to the generic Spino if the art is missing). When omitted, the
   * generic Spino is shown.
   */
  @Input() dinoId?: string;
}
