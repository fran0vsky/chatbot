import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-typing-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './typing-indicator.html',
  styleUrl: './typing-indicator.scss',
})
export class TypingIndicator {}
