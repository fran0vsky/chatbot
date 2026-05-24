import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ChatService } from './chat.service';
import { environment } from '../../environments/environment';

function makeSseStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = frames.map((f) => encoder.encode(`data: ${f}\n\n`));
  let idx = 0;
  return new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(chunks[idx++]);
      } else {
        controller.close();
      }
    },
  });
}

describe('ChatService SSE streaming', () => {
  let service: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatService);
  });

  it('forwards reasoning_token events through the SSE parser', async () => {
    const frame = JSON.stringify({ type: 'reasoning_token', text: 'foo' });
    const mockResponse = new Response(makeSseStream([frame]));
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const abort = new AbortController();
    const events: { type: string; text?: string }[] = [];
    for await (const ev of service.streamMessage('hi', undefined, abort.signal)) {
      events.push(ev);
    }
    const rt = events.find((e) => e.type === 'reasoning_token');
    expect(rt).toBeDefined();
    expect(rt?.text).toBe('foo');
  });

  it('forwards done event with reasoning and reasoningDurationMs', async () => {
    const frame = JSON.stringify({
      type: 'done',
      response: 'answer',
      toolCalls: [],
      reasoning: 'merged trace',
      reasoningDurationMs: 1234,
    });
    const mockResponse = new Response(makeSseStream([frame]));
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const abort = new AbortController();
    const events: Record<string, unknown>[] = [];
    for await (const ev of service.streamMessage('hi', undefined, abort.signal)) {
      events.push(ev as Record<string, unknown>);
    }
    const done = events.find((e) => e['type'] === 'done');
    expect(done?.['reasoning']).toBe('merged trace');
    expect(done?.['reasoningDurationMs']).toBe(1234);
  });
});

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('generates a threadId via crypto.randomUUID on construction', () => {
    expect(service.threadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('posts to the configured apiUrl with message and threadId', () => {
    service.sendMessage('hello').subscribe((resp) => {
      expect(resp.response).toBe('hi back');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/agents/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'hello', threadId: service.threadId });
    req.flush({ response: 'hi back' });
  });

  it('sends the same threadId across multiple calls (CONV-01)', () => {
    service.sendMessage('first').subscribe();
    service.sendMessage('second').subscribe();

    const reqs = httpMock.match(`${environment.apiUrl}/api/agents/chat`);
    expect(reqs.length).toBe(2);
    expect(reqs[0].request.body.threadId).toBe(service.threadId);
    expect(reqs[1].request.body.threadId).toBe(service.threadId);
    reqs.forEach((r) => r.flush({ response: 'ok' }));
  });
});
