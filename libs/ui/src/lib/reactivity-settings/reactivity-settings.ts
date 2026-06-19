import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  DinoReactivityMap,
  DinoSummary,
  REACTION_LEVELS,
  ReactionLevel,
} from '@org/shared-types';
import { Mascot } from '../mascot/mascot.js';

/**
 * Presentational per-dino reaction-level control (Phase 43, SC#1).
 * Renders one row per dino with a segmented control over REACTION_LEVELS
 * (never / rarely / normal / chatty). Purely @Input / @Output — no services
 * injected. The smart ReactivityService (apps/frontend) owns HTTP + state.
 */
@Component({
  standalone: true,
  selector: 'app-reactivity-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Mascot],
  templateUrl: './reactivity-settings.html',
})
export class ReactivitySettings {
  /** The currently selected group participants to configure. */
  @Input() dinos: DinoSummary[] = [];

  /** Stored reaction levels keyed by dinoId. Missing dinoId defaults to 'normal'. */
  @Input() levels: DinoReactivityMap = {};

  /** Emitted when the user changes a dino's reaction level. */
  @Output() levelChanged = new EventEmitter<{
    dinoId: string;
    level: ReactionLevel;
  }>();

  /** Exposed to the template so it can iterate without hardcoding level literals. */
  readonly reactionLevels = REACTION_LEVELS;

  /** Resolve a dino's current level, defaulting to 'normal' (D-05/SC#4). */
  currentLevel(dinoId: string): ReactionLevel {
    return this.levels[dinoId] ?? 'normal';
  }

  /** User-friendly label for each reaction level. */
  levelLabel(level: ReactionLevel): string {
    switch (level) {
      case 'never':  return 'Never';
      case 'rarely': return 'Rarely';
      case 'normal': return 'Normal';
      case 'chatty': return 'Chatty';
    }
  }

  onLevelClick(dinoId: string, level: ReactionLevel): void {
    this.levelChanged.emit({ dinoId, level });
  }
}
