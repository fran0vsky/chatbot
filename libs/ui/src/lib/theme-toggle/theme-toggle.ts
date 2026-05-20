import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-toggle.html',
})
export class ThemeToggle {
  @Input() isDayMode = false;
  @Input() disabled = false;
  @Output() toggled = new EventEmitter<void>();
}
