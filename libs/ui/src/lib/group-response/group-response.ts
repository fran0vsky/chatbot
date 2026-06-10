import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { DinoSummary, GroupReaction, reactionTooltip } from '@org/shared-types';
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

  /** Hover tooltip caption for a reaction emoji (e.g. 💡 → "thought that's clever"). */
  reactionTooltip(emoji: string): string {
    return reactionTooltip(emoji);
  }
}
