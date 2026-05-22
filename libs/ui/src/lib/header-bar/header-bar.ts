import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ThemeToggle } from '../theme-toggle/theme-toggle.js';
import { NewButton } from '../new-button/new-button.js';

@Component({
  standalone: true,
  selector: 'app-header-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header-bar.html',
  imports: [ThemeToggle, NewButton],
})
export class HeaderBar {
  @Input() isDayMode = false;
  @Input() disabled = false;
  @Output() themeToggled = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() historyToggled = new EventEmitter<void>();
}
