import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GroupStreamEvent } from '@org/shared-types';
import { ChatService } from './chat.service';
import { GroupchatService, GroupViewMessage } from './groupchat.service';

/** Build a fake async generator that yields the given group events then returns. */
async function* makeEvents(
  events: GroupStreamEvent[],
): AsyncGenerator<GroupStreamEvent, void, void> {
  for (const e of events) {
    yield e;
  }
}

/** Wait for the streamGroup consumption micro-tasks + signal propagation. */
function tick(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('GroupchatService (turn-based)', () => {
  let service: GroupchatService;
  let streamGroup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    streamGroup = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        GroupchatService,
        { provide: ChatService, useValue: { streamGroup } },
      ],
    });

    service = TestBed.inject(GroupchatService);
  });

  afterEach(() => {
    service.stopAll();
    vi.clearAllMocks();
  });

  function dino(list: GroupViewMessage[], dinoId: string): GroupViewMessage | undefined {
    return list.find((m) => m.role === 'dino' && m.dinoId === dinoId);
  }

  it('lays out Round-1 answerers in plan order with finalized text + done status', async () => {
    streamGroup.mockReturnValue(
      makeEvents([
        {
          type: 'plan',
          plan: {
            round1: [
              { dinoId: 'rex', action: 'answer', order: 1 },
              { dinoId: 'philo', action: 'answer', order: 0 },
            ],
            round2: [],
          },
        },
        { type: 'dino_token', dinoId: 'rex', text: 'Hello ' },
        { type: 'dino_token', dinoId: 'rex', text: 'Rex.' },
        { type: 'dino_done', dinoId: 'rex', response: 'Hello Rex.', messageId: 's-rex' },
        { type: 'dino_token', dinoId: 'philo', text: 'Hi Philo.' },
        { type: 'dino_done', dinoId: 'philo', response: 'Hi Philo.', messageId: 's-philo' },
        { type: 'group_done' },
      ]),
    );

    service.send('hello', ['rex', 'philo']);
    await tick();

    const msgs = service.messages();
    const dinoMsgs = msgs.filter((m) => m.role === 'dino');
    // Plan order is philo (order 0) then rex (order 1).
    expect(dinoMsgs.map((m) => m.dinoId)).toEqual(['philo', 'rex']);

    const rex = dino(msgs, 'rex');
    const philo = dino(msgs, 'philo');
    expect(rex?.text).toBe('Hello Rex.');
    expect(rex?.status).toBe('done');
    expect(rex?.serverMessageId).toBe('s-rex');
    expect(philo?.text).toBe('Hi Philo.');
    expect(philo?.status).toBe('done');
  });

  it('attaches a reaction to the targeted message as a chip without adding a line', async () => {
    // Capture the user message id created by send() so we can target it.
    let userId = '';
    streamGroup.mockImplementation(() => {
      userId = service.messages()[0].id;
      return makeEvents([
        { type: 'reaction', dinoId: 'rex', emoji: '🔥', targetMessageId: userId },
        { type: 'group_done' },
      ]);
    });

    service.send('great point', ['rex']);
    await tick();

    const msgs = service.messages();
    // Only the single user message — no extra transcript line for the reaction.
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].reactions).toEqual([{ dinoId: 'rex', emoji: '🔥' }]);
  });

  it('marks a dino message as error on dino_error', async () => {
    streamGroup.mockReturnValue(
      makeEvents([
        {
          type: 'plan',
          plan: { round1: [{ dinoId: 'rex', action: 'answer', order: 0 }], round2: [] },
        },
        { type: 'dino_error', dinoId: 'rex', message: 'Model unavailable' },
        { type: 'group_done' },
      ]),
    );

    service.send('hi', ['rex']);
    await tick();

    const rex = dino(service.messages(), 'rex');
    expect(rex?.status).toBe('error');
    expect(rex?.error).toBe('Model unavailable');
  });

  it('clears streaming on group_done', async () => {
    streamGroup.mockReturnValue(makeEvents([{ type: 'group_done' }]));

    service.send('hi', ['rex']);
    await tick();

    expect(service.streaming()).toBe(false);
  });

  it('sends prior messages (capped) as history to streamGroup', async () => {
    streamGroup.mockReturnValue(makeEvents([{ type: 'group_done' }]));

    // First turn seeds the transcript with a user message.
    service.send('first', ['rex']);
    await tick();

    streamGroup.mockClear();
    streamGroup.mockReturnValue(makeEvents([{ type: 'group_done' }]));

    service.send('second', ['rex']);
    await tick();

    const [message, participantDinoIds, history] = streamGroup.mock.calls[0];
    expect(message).toBe('second');
    expect(participantDinoIds).toEqual(['rex']);
    // History includes the first user turn but NOT the just-added "second" turn.
    expect(history.map((m: GroupViewMessage) => m.text)).toEqual(['first']);
    expect(history.length).toBeLessThanOrEqual(20);
  });

  it('caps participants at MAX_DINOS', async () => {
    streamGroup.mockReturnValue(makeEvents([{ type: 'group_done' }]));

    service.send('hi', ['a', 'b', 'c', 'd', 'e', 'f']);
    await tick();

    const [, participantDinoIds] = streamGroup.mock.calls[0];
    expect(participantDinoIds).toHaveLength(GroupchatService.MAX_DINOS);
  });

  it('stopAll aborts the in-flight stream and clears streaming', async () => {
    let captured: AbortSignal | undefined;
    async function* neverEnds(
      _message: string,
      _ids: string[],
      _history: unknown,
      signal: AbortSignal,
    ): AsyncGenerator<GroupStreamEvent, void, void> {
      captured = signal;
      await new Promise<void>((res) => {
        signal.addEventListener('abort', () => res());
      });
      yield { type: 'group_done' };
    }
    streamGroup.mockImplementation(
      (m: string, ids: string[], h: unknown, s: AbortSignal) => neverEnds(m, ids, h, s),
    );

    service.send('hi', ['rex']);
    await tick(5);
    expect(service.streaming()).toBe(true);

    service.stopAll();
    await tick(5);

    expect(captured?.aborted).toBe(true);
    expect(service.streaming()).toBe(false);
  });
});
