import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-new-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-button.html',
})
export class NewButton {
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}
