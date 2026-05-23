import { Injectable } from '@angular/core';
import { ChatRequest, StreamEvent } from '@org/shared-types';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private threadId: string = crypto.randomUUID();

  get currentThreadId(): string {
    return this.threadId;
  }

  resetThread(): void {
    this.threadId = crypto.randomUUID();
  }

  setThread(id: string): void {
    this.threadId = id;
  }

  async *streamMessage(
    message: string,
    model: string | undefined,
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent, void, void> {
    const body: ChatRequest = { message, threadId: this.threadId, model };

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
