import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';
import { ChatMessage } from '../chat.types';

@Component({
  standalone: true,
  selector: 'app-message-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  imports: [CommonModule, MarkdownComponent],
})
export class MessageBubble {
  @Input({ required: true }) message!: ChatMessage;
  @Input() typing = false;

  copied = false;

  private readonly sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  readonly snakeSvg: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <rect x="2" y="0" width="2" height="1" fill="#4A7C59"/>
    <rect x="1" y="1" width="4" height="1" fill="#4A7C59"/>
    <rect x="0" y="2" width="5" height="1" fill="#4A7C59"/>
    <rect x="1" y="2" width="1" height="1" fill="#1A1209"/>
    <rect x="3" y="2" width="1" height="1" fill="#1A1209"/>
    <rect x="1" y="3" width="6" height="1" fill="#4A7C59"/>
    <rect x="2" y="4" width="5" height="1" fill="#4A7C59"/>
    <rect x="3" y="5" width="3" height="1" fill="#4A7C59"/>
    <rect x="5" y="6" width="2" height="1" fill="#4A7C59"/>
    <rect x="0" y="2" width="1" height="1" fill="#C1644A"/>
  </svg>`
  );

  copyMessage(): void {
    navigator.clipboard.writeText(this.message.text).then(
      () => {
        this.copied = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.copied = false;
          this.cdr.markForCheck();
        }, 1500);
      },
      () => {
        // Clipboard blocked — leave copied as false, no logging
      }
    );
  }
}
