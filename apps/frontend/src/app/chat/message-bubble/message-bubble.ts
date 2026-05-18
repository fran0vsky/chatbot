import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../chat.types';

@Component({
  standalone: true,
  selector: 'app-message-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  imports: [CommonModule],
})
export class MessageBubble {
  @Input({ required: true }) message!: ChatMessage;
  @Input() typing = false;
}
