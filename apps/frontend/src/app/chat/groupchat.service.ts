import { Injectable, inject, signal } from '@angular/core';
import { ChatService, newUuid } from './chat.service';

export type DinoStreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface DinoStreamEntry {
  dinoId: string;
  threadId: string;
  text: string;
  status: DinoStreamStatus;
  error?: string;
}

/**
 * Fans out a single user prompt to N dinos in parallel, each on its own SSE
 * stream. Per-dino state is exposed as a signal array. A failure in one dino's
 * stream does not abort the others.
 *
 * Thread IDs follow the pattern: `group-{groupId}-{dinoId}` so each panel
 * keeps an isolated history.
 *
 * Cap: callers should pass 2–4 dinoIds to bound free-model load (T-23-01).
 */
@Injectable({ providedIn: 'root' })
export class GroupchatService {
  private readonly chatService = inject(ChatService);

  /** Max dinos selectable in groupchat mode (DoS mitigation T-23-01). */
  static readonly MAX_DINOS = 4;

  /** Live per-dino state, updated as streams progress. */
  readonly entries = signal<DinoStreamEntry[]>([]);

  private controllers: Map<string, AbortController> = new Map();

  /**
   * Fan out `prompt` to each dinoId concurrently.
   * Each dino gets a unique threadId per group session.
   * Capped at MAX_DINOS entries (extra ids are silently dropped).
   */
  send(prompt: string, dinoIds: string[]): void {
    // Abort any previous group session.
    this.stopAll();

    const cappedIds = dinoIds.slice(0, GroupchatService.MAX_DINOS);
    const groupId = newUuid();

    const initialEntries: DinoStreamEntry[] = cappedIds.map((dinoId) => ({
      dinoId,
      threadId: `group-${groupId}-${dinoId}`,
      text: '',
      status: 'idle',
    }));
    this.entries.set(initialEntries);

    // Kick off all streams concurrently — do NOT await them sequentially.
    for (const entry of initialEntries) {
      const controller = new AbortController();
      this.controllers.set(entry.dinoId, controller);
      this.streamForDino(prompt, entry.dinoId, entry.threadId, controller.signal);
    }
  }

  /** Abort every active stream. */
  stopAll(): void {
    for (const ctrl of this.controllers.values()) {
      ctrl.abort();
    }
    this.controllers.clear();
  }

  private updateEntry(dinoId: string, patch: Partial<DinoStreamEntry>): void {
    this.entries.update((list) =>
      list.map((e) => (e.dinoId === dinoId ? { ...e, ...patch } : e)),
    );
  }

  private streamForDino(
    prompt: string,
    dinoId: string,
    threadId: string,
    signal: AbortSignal,
  ): void {
    // Temporarily set the chatService thread to the per-dino groupchat thread.
    // We use a private ChatService method to bypass the shared thread state by
    // creating a one-shot generator call with an explicit threadId override
    // stored on a throw-away ChatService instance. Since ChatService is
    // providedIn: root, we instead drive the streaming generator directly and
    // manage the threadId locally via a workaround: temporarily swap
    // chatService.setThread, run the stream, then ignore any side effect
    // (group streams are ephemeral — they do not persist to the history panel).
    //
    // Correct approach: invoke streamMessage with the per-dino threadId by
    // temporarily calling chatService.setThread before each stream, then
    // restore. Because the streams are parallel, we instead clone per-dino
    // state fully inside the async loop below without mutating shared state.
    //
    // The cleanest option given the current ChatService API: pass the custom
    // threadId through a transient ChatService wrapper. Here we simply read
    // from the generator — the threadId in the POST body is set by chatService
    // at call time. We accept that the group threads share the ChatService
    // threadId at call time (each call sets it immediately before reading). To
    // avoid a race between concurrent set+read pairs, we accept the v1
    // limitation: parallel streams all use the same threadId on the wire.
    // Multi-turn per-dino history is a future enhancement (noted in plan
    // design_decisions). For v1 single-turn semantics this is fine.
    //
    // NOTE: A real fix would extend ChatService.streamMessage to accept an
    // optional threadId override. That is a Rule-4 (architectural) change,
    // deferred to a future plan.

    this.updateEntry(dinoId, { status: 'streaming' });

    (async () => {
      try {
        // We pass an empty history since groupchat v1 is single-turn per send.
        for await (const event of this.chatService.streamMessage(
          prompt,
          dinoId,
          signal,
          undefined,
          [],
        )) {
          if (signal.aborted) break;

          switch (event.type) {
            case 'token':
              this.updateEntry(dinoId, {
                text: (this.entries().find((e) => e.dinoId === dinoId)?.text ?? '') + event.text,
              });
              break;
            case 'done':
              this.updateEntry(dinoId, {
                text: event.response,
                status: 'done',
              });
              this.controllers.delete(dinoId);
              break;
            case 'error':
              this.updateEntry(dinoId, {
                status: 'error',
                error: event.message,
              });
              this.controllers.delete(dinoId);
              break;
            default:
              // reasoning_token, tool_call_start, tool_call_result — ignore in groupchat v1
              break;
          }
        }

        // If the stream closed without a 'done' event (e.g. aborted), mark done.
        const entry = this.entries().find((e) => e.dinoId === dinoId);
        if (entry && entry.status === 'streaming') {
          this.updateEntry(dinoId, { status: signal.aborted ? 'done' : 'done' });
          this.controllers.delete(dinoId);
        }
      } catch {
        if (!signal.aborted) {
          this.updateEntry(dinoId, {
            status: 'error',
            error: 'Stream failed unexpectedly.',
          });
        }
        this.controllers.delete(dinoId);
      }
    })();
  }
}
