import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-new-chat-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-chat-button.html',
})
export class NewChatButton {
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}
