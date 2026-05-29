import { TestBed } from '@angular/core/testing';
import { StreamEvent } from '@org/shared-types';
import { ChatService } from './chat.service';
import { GroupchatService, DinoStreamEntry } from './groupchat.service';

/** Build a fake async generator that yields the given events then returns. */
async function* makeEvents(events: StreamEvent[]): AsyncGenerator<StreamEvent, void, void> {
  for (const e of events) {
    yield e;
  }
}

/** Helper to wait for signal propagation (micro-task + a small macro delay). */
function tick(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('GroupchatService', () => {
  let service: GroupchatService;
  let chatService: jest.Mocked<Pick<ChatService, 'streamMessage' | 'setThread'>>;

  beforeEach(() => {
    const streamMessageMock = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        GroupchatService,
        {
          provide: ChatService,
          useValue: {
            streamMessage: streamMessageMock,
          },
        },
      ],
    });

    service = TestBed.inject(GroupchatService);
    chatService = TestBed.inject(ChatService) as unknown as typeof chatService;
    (chatService as { streamMessage: jest.Mock }).streamMessage = streamMessageMock;
  });

  afterEach(() => {
    service.stopAll();
    jest.clearAllMocks();
  });

  it('initialises entries with idle status for each dinoId', async () => {
    (chatService.streamMessage as jest.Mock).mockReturnValue(makeEvents([]));

    service.send('hello', ['rex', 'philo']);
    const entries = service.entries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e: DinoStreamEntry) => e.dinoId)).toEqual(['rex', 'philo']);
  });

  it('accumulates token events into per-dino text independently', async () => {
    (chatService.streamMessage as jest.Mock)
      .mockImplementationOnce(() =>
        makeEvents([
          { type: 'token', text: 'Hello ' } as StreamEvent,
          { type: 'token', text: 'Rex.' } as StreamEvent,
          { type: 'done', response: 'Hello Rex.', toolCalls: [] } as StreamEvent,
        ]),
      )
      .mockImplementationOnce(() =>
        makeEvents([
          { type: 'token', text: 'Hi ' } as StreamEvent,
          { type: 'token', text: 'Philo.' } as StreamEvent,
          { type: 'done', response: 'Hi Philo.', toolCalls: [] } as StreamEvent,
        ]),
      );

    service.send('hello', ['rex', 'philo']);
    await tick(50);

    const entries = service.entries();
    const rex = entries.find((e: DinoStreamEntry) => e.dinoId === 'rex');
    const philo = entries.find((e: DinoStreamEntry) => e.dinoId === 'philo');

    expect(rex?.text).toBe('Hello Rex.');
    expect(rex?.status).toBe('done');
    expect(philo?.text).toBe('Hi Philo.');
    expect(philo?.status).toBe('done');
  });

  it('isolates a failing stream: one error does not affect others', async () => {
    (chatService.streamMessage as jest.Mock)
      .mockImplementationOnce(() =>
        makeEvents([
          { type: 'error', message: 'Model unavailable' } as StreamEvent,
        ]),
      )
      .mockImplementationOnce(() =>
        makeEvents([
          { type: 'token', text: 'All good.' } as StreamEvent,
          { type: 'done', response: 'All good.', toolCalls: [] } as StreamEvent,
        ]),
      );

    service.send('test', ['bad-dino', 'good-dino']);
    await tick(50);

    const entries = service.entries();
    const bad = entries.find((e: DinoStreamEntry) => e.dinoId === 'bad-dino');
    const good = entries.find((e: DinoStreamEntry) => e.dinoId === 'good-dino');

    expect(bad?.status).toBe('error');
    expect(bad?.error).toBe('Model unavailable');
    expect(good?.status).toBe('done');
    expect(good?.text).toBe('All good.');
  });

  it('caps dinoIds at MAX_DINOS (4)', () => {
    (chatService.streamMessage as jest.Mock).mockReturnValue(makeEvents([]));

    service.send('hi', ['a', 'b', 'c', 'd', 'e', 'f']);
    expect(service.entries()).toHaveLength(GroupchatService.MAX_DINOS);
  });

  it('stopAll aborts all active streams and clears controllers', async () => {
    let aborted = false;
    async function* neverEnds(
      _: string,
      __: string | undefined,
      signal: AbortSignal,
    ): AsyncGenerator<StreamEvent, void, void> {
      await new Promise<void>((res) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          res();
        });
      });
    }

    (chatService.streamMessage as jest.Mock).mockImplementation(
      (_msg: string, _dino: string | undefined, signal: AbortSignal) => neverEnds(_msg, _dino, signal),
    );

    service.send('hi', ['dino1']);
    await tick(5);
    service.stopAll();
    await tick(10);

    expect(aborted).toBe(true);
  });

  it('clears entries from a previous send when a new send is called', async () => {
    (chatService.streamMessage as jest.Mock).mockReturnValue(makeEvents([]));

    service.send('first', ['a', 'b']);
    expect(service.entries()).toHaveLength(2);

    service.send('second', ['x']);
    expect(service.entries()).toHaveLength(1);
    expect(service.entries()[0].dinoId).toBe('x');
  });
});
