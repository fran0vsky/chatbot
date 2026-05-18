import { Component } from '@angular/core';
import { ChatComponent } from './chat/chat';

@Component({
  imports: [ChatComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
