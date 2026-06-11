import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { DinoSummary, GroupReaction, reactionLabel } from '@org/shared-types';
import { Mascot } from '../mascot/mascot.js';
import { TypingIndicator } from '../typing-indicator/typing-indicator.js';

export type GroupResponseStatus = 'idle' | 'streaming' | 'done' | 'error';

/**
 * Presentational per-dino response panel used inside the groupchat view.
 * Renders a mascot + name header, streaming/markdown body, and a
 * status/typing indicator. Has no injected services and no side-effects.
 */
@Component({
  standalone: true,
  selector: 'app-group-response',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-response.html',
  imports: [MarkdownComponent, Mascot, TypingIndicator],
})
export class GroupResponse {
  /** The dino whose response this panel shows. */
  @Input({ required: true }) dino!: DinoSummary;

  /** Accumulated response text (may be partial while streaming). */
  @Input() text = '';

  /** Current streaming/completion status. */
  @Input() status: GroupResponseStatus = 'idle';

  /** Error message shown when status === 'error'. */
  @Input() error?: string;

  /** Emoji reactions pinned to this message (D-06). Each = reacting dino + emoji. */
  @Input() reactions?: GroupReaction[];

  /** When set, shows a subtle "replying to {name}" affordance in the header (D-05). */
  @Input() respondingToName?: string;

  /** Lookup of dinoId → display name, used to attribute reactions by name. */
  @Input() dinoNames?: Record<string, string>;

  /**
   * Full hover label for a reaction, attributed to the reacting dino —
   * e.g. "Nimbus thought that's brilliant". Falls back to the bare caption
   * when the reacting dino isn't in the provided name lookup.
   */
  reactionLabel(reaction: GroupReaction): string {
    return reactionLabel(this.dinoNames?.[reaction.dinoId], reaction.emoji);
  }
}
