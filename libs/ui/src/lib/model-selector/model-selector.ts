import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

export interface ChatModel {
  readonly id: string;
  readonly label: string;
}

@Component({
  standalone: true,
  selector: 'app-model-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './model-selector.html',
})
export class ModelSelector {
  @Input() models: readonly ChatModel[] = [];
  @Input() selectedModel = '';
  @Input() disabled = false;
  @Output() modelChange = new EventEmitter<string>();
}
