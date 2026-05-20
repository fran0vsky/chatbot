import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ThemeToggle } from '../theme-toggle/theme-toggle.js';
import { NewChatButton } from '../new-chat-button/new-chat-button.js';
import { ModelSelector, ChatModel } from '../model-selector/model-selector.js';

@Component({
  standalone: true,
  selector: 'app-chat-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-header.html',
  imports: [ThemeToggle, NewChatButton, ModelSelector],
})
export class ChatHeader {
  @Input() isDayMode = false;
  @Input() selectedModel = '';
  @Input() models: readonly ChatModel[] = [];
  @Input() disabled = false;
  @Output() themeToggled = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() modelChange = new EventEmitter<string>();
}
