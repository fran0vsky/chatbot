import { Injectable } from '@angular/core';
import { ChatRequest, StreamEvent } from '@org/shared-types';
import { environment } from '../../environments/environment';

// crypto.randomUUID() is only exposed in secure contexts (HTTPS / localhost).
// On a plain-HTTP origin like the demo VM, calling it throws and breaks the
// Angular bootstrap. Fall back to a Math.random-based RFC4122 v4 generator —
// not cryptographically strong, but fine for client-side session IDs.
function newUuid(): string {
  const c = (typeof crypto !== 'undefined' ? crypto : undefined) as
    | (Crypto & { randomUUID?: () => string })
    | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private threadId: string = newUuid();

  get currentThreadId(): string {
    return this.threadId;
  }

  resetThread(): void {
    this.threadId = newUuid();
  }

  setThread(id: string): void {
    this.threadId = id;
  }

  async *streamMessage(
    message: string,
    model: string | undefined,
    signal: AbortSignal,
    enabledTools?: string[],
  ): AsyncGenerator<StreamEvent, void, void> {
    const body: ChatRequest = { message, threadId: this.threadId, model, enabledTools };

    let response: Response;
    try {
      response = await fetch(`${environment.apiUrl}/api/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Network error';
      yield { type: 'error', message: msg };
      return;
    }

    if (!response.ok || !response.body) {
      yield {
        type: 'error',
        message: `Request failed (${response.status})`,
      };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let frameEnd = buffer.indexOf('\n\n');
        while (frameEnd !== -1) {
          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);
          const dataLine = frame.startsWith('data: ') ? frame.slice(6) : frame;
          if (dataLine.length > 0) {
            try {
              yield JSON.parse(dataLine) as StreamEvent;
            } catch {
              // skip malformed frames
            }
          }
          frameEnd = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Stream read error';
      yield { type: 'error', message: msg };
    }
  }
}
