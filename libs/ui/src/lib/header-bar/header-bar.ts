import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ThemeToggle } from '../theme-toggle/theme-toggle.js';
import { NewButton } from '../new-button/new-button.js';
import { ModelSelector, ChatModel } from '../model-selector/model-selector.js';

@Component({
  standalone: true,
  selector: 'app-header-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header-bar.html',
  imports: [ThemeToggle, NewButton, ModelSelector],
})
export class HeaderBar {
  @Input() isDayMode = false;
  @Input() selectedModel = '';
  @Input() models: readonly ChatModel[] = [];
  @Input() disabled = false;
  @Output() themeToggled = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() modelChange = new EventEmitter<string>();
  @Output() historyToggled = new EventEmitter<void>();
}
