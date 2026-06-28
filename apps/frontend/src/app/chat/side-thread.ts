import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { ChatMessage, SideThread, StreamEvent, ToolCallRecord } from '@org/shared-types';
import { InputComposer, MessageBubble, ReasoningBlock, ToolCallBubble } from '@chatbot/ui';
import { ChatService, newUuid } from './chat.service';
import { buildHistory } from './history-builder';

/**
 * A drill-down side thread (branch) rendered in the right-hand drawer.
 *
 * Owns its own message list + streaming state and talks to the same dino via the
 * shared ChatService. Context isolation is structural: the branch builds history
 * from `contextMessages` (the main thread up to the anchor) + its OWN turns, and
 * the main thread never sees these turns — so the agent cannot read the branch
 * until the user merges it back.
 *
 * The parent owns persistence and the merge summary: this component emits
 * `messagesChanged` after each turn and `merge` / `discard` on the user's action.
 */
@Component({
  standalone: true,
  selector: 'app-side-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './side-thread.html',
  imports: [InputComposer, MessageBubble, ReasoningBlock, ToolCallBubble],
})
export class SideThreadComponent implements OnChanges, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) thread!: SideThread;
  @Input() dinoId?: string;
  /** Main-thread messages up to & including the anchor — read-only branch context. */
  @Input() contextMessages: ChatMessage[] = [];
  /** External guard: true while the main thread is streaming or a merge is running. */
  @Input() busy = false;

  @Output() messagesChanged = new EventEmitter<ChatMessage[]>();
  @Output() merge = new EventEmitter<ChatMessage[]>();
  @Output() discard = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  readonly messages = signal<ChatMessage[]>([]);
  readonly streamingText = signal('');
  readonly streamingReasoning = signal('');
  readonly streamingToolCalls = signal<ToolCallRecord[]>([]);
  readonly streamingError = signal<string | null>(null);
  readonly isStreaming = signal(false);
  isLoading = false;

  private streamingToolCallIds: string[] = [];
  private abort: AbortController | null = null;
  private loadedThreadId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    // Re-seed local message state only when a different thread is bound, so live
    // streaming updates within the same thread are never clobbered by re-renders.
    if (changes['thread'] && this.thread && this.thread.id !== this.loadedThreadId) {
      this.cancelStream();
      this.loadedThreadId = this.thread.id;
      this.messages.set([...this.thread.messages]);
      this.clearStreaming();
    }
  }

  ngOnDestroy(): void {
    this.cancelStream();
  }

  /** True once the dino has answered at least once — gates the Merge button. */
  canMerge(): boolean {
    return (
      this.thread?.status === 'open' &&
      this.messages().some((m) => m.role === 'assistant') &&
      !this.isStreaming() &&
      !this.busy
    );
  }

  onSend(text: string, imageDataUrl?: string): void {
    if (this.busy || this.isStreaming() || this.thread.status !== 'open') return;
    if (!text && !imageDataUrl) return;

    this.messages.update((m) => [
      ...m,
      { id: newUuid(), text, role: 'user', createdAt: Date.now(), ...(imageDataUrl ? { imageDataUrl } : {}) },
    ]);
    this.messagesChanged.emit(this.messages());
    void this.dispatchRequest(text, imageDataUrl);
  }

  onMerge(): void {
    if (!this.canMerge()) return;
    this.merge.emit(this.messages());
  }

  onDiscard(): void {
    this.cancelStream();
    this.discard.emit();
  }

  onClose(): void {
    this.close.emit();
  }

  onStop(): void {
    this.cancelStream();
    this.isLoading = false;
    this.clearStreaming();
    this.cdr.markForCheck();
  }

  // Branch history = full main context up to the anchor + the branch's own prior
  // turns (current turn excluded — sent as `message`). Same cap/shape as main.
  private branchHistory(): ReturnType<typeof buildHistory> {
    return buildHistory([...this.contextMessages, ...this.messages().slice(0, -1)]);
  }

  private async dispatchRequest(text: string, imageDataUrl?: string): Promise<void> {
    this.cancelStream();
    const controller = new AbortController();
    this.abort = controller;

    this.isLoading = true;
    this.streamingText.set('');
    this.streamingReasoning.set('');
    this.streamingError.set(null);
    this.streamingToolCalls.set([]);
    this.streamingToolCallIds = [];
    this.isStreaming.set(true);
    this.cdr.markForCheck();

    try {
      // enabledTools left undefined so the branch inherits the dino's full toolset
      // (web_search etc. are useful when fact-checking an answer).
      for await (const event of this.chatService.streamMessage(
        text,
        this.dinoId,
        controller.signal,
        undefined,
        this.branchHistory(),
        imageDataUrl,
      )) {
        this.handleStreamEvent(event);
      }
    } catch {
      // service surfaces errors as 'error' events; nothing to do here
    } finally {
      if (this.abort === controller) this.abort = null;
    }
  }

  private handleStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'reasoning_token':
        if (this.isLoading) this.isLoading = false;
        this.streamingReasoning.update((s) => s + event.text);
        this.cdr.markForCheck();
        return;
      case 'token':
        if (this.isLoading) this.isLoading = false;
        this.streamingText.update((s) => s + event.text);
        this.cdr.markForCheck();
        return;
      case 'tool_call_start':
        this.streamingToolCallIds.push(event.id);
        this.streamingToolCalls.update((arr) => [
          ...arr,
          { name: event.name, args: event.args, result: '' },
        ]);
        this.cdr.markForCheck();
        return;
      case 'tool_call_result': {
        const idx = this.streamingToolCallIds.indexOf(event.id);
        if (idx === -1) return;
        this.streamingToolCalls.update((arr) => {
          const next = arr.slice();
          next[idx] = { ...next[idx], result: event.result };
          return next;
        });
        this.cdr.markForCheck();
        return;
      }
      case 'done':
        this.commitTurn(event.response, event.toolCalls ?? [], event.reasoning, event.reasoningDurationMs);
        return;
      case 'error':
        this.commitErrorTurn(event.message);
        return;
      // 'image' / 'skill_active' are not surfaced inside a side thread.
      default:
        return;
    }
  }

  private commitTurn(
    response: string,
    toolCalls: ToolCallRecord[],
    reasoning?: string,
    reasoningDurationMs?: number,
  ): void {
    const appended: ChatMessage[] = [];
    for (const call of toolCalls) {
      appended.push({
        id: newUuid(),
        text: '',
        role: 'tool',
        toolName: call.name,
        toolArgs: call.args,
        toolResult: call.result,
        createdAt: Date.now(),
      });
    }
    appended.push({
      id: newUuid(),
      text: response,
      role: 'assistant',
      createdAt: Date.now(),
      ...(reasoning ? { reasoning } : {}),
      ...(reasoningDurationMs !== undefined ? { reasoningDurationMs } : {}),
    });
    this.messages.update((m) => [...m, ...appended]);
    this.messagesChanged.emit(this.messages());
    this.finish();
  }

  private commitErrorTurn(message: string): void {
    this.messages.update((m) => [
      ...m,
      { id: newUuid(), text: message, role: 'error', createdAt: Date.now() },
    ]);
    this.messagesChanged.emit(this.messages());
    this.finish();
  }

  private finish(): void {
    this.isLoading = false;
    this.clearStreaming();
    this.cdr.markForCheck();
  }

  private clearStreaming(): void {
    this.streamingText.set('');
    this.streamingReasoning.set('');
    this.streamingError.set(null);
    this.streamingToolCalls.set([]);
    this.streamingToolCallIds = [];
    this.isStreaming.set(false);
  }

  private cancelStream(): void {
    this.abort?.abort();
    this.abort = null;
  }
}
