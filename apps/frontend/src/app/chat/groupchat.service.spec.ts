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

  // ─── Persistence + reopen (D-08 / GRP2-04) ───

  /** Drive a complete group turn so the service holds a populated transcript. */
  async function seedTranscript(): Promise<void> {
    let userId = '';
    streamGroup.mockImplementation(() => {
      userId = service.messages()[0].id;
      return makeEvents([
        {
          type: 'plan',
          plan: {
            round1: [
              { dinoId: 'philo', action: 'answer', order: 0 },
              { dinoId: 'rex', action: 'answer', order: 1 },
            ],
            round2: [],
          },
        },
        { type: 'dino_done', dinoId: 'philo', response: 'Hi Philo.', messageId: 's-philo' },
        { type: 'dino_done', dinoId: 'rex', response: 'Hello Rex.', messageId: 's-rex' },
        // React to the user's message so a chip round-trips through persistence.
        { type: 'reaction', dinoId: 'rex', emoji: '🔥', targetMessageId: userId },
        { type: 'group_done' },
      ]);
    });
    service.send('what do you think?', ['philo', 'rex']);
    await tick();
  }

  it('toSession() produces an isGroup session with the roster, stable id, and dino→assistant+dinoId mapping', async () => {
    await seedTranscript();

    const session = service.toSession('Group: design review');

    expect(session.isGroup).toBe(true);
    expect(session.title).toBe('Group: design review');
    expect(session.participantDinoIds).toEqual(['philo', 'rex']);

    // user → 'user'; dino → 'assistant' carrying its dinoId.
    expect(session.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant']);
    const philo = session.messages.find((m) => m.dinoId === 'philo');
    const rex = session.messages.find((m) => m.dinoId === 'rex');
    expect(philo?.text).toBe('Hi Philo.');
    expect(rex?.text).toBe('Hello Rex.');

    // The reaction chip on the user message is preserved.
    expect(session.messages[0].reactions).toEqual([{ dinoId: 'rex', emoji: '🔥' }]);

    // Stable id across calls within the same session.
    const again = service.toSession('Group: design review');
    expect(again.id).toBe(session.id);
  });

  it('loadSession() restores the messages signal and returns the saved roster', async () => {
    await seedTranscript();
    const session = service.toSession('Group: design review');

    // Reset to a fresh service state, then reopen the saved session.
    service.startNewSession();
    expect(service.messages()).toHaveLength(0);

    const roster = service.loadSession(session);
    expect(roster).toEqual(['philo', 'rex']);

    const restored = service.messages();
    expect(restored.map((m) => m.role)).toEqual(['user', 'dino', 'dino']);
    expect(dino(restored, 'philo')?.text).toBe('Hi Philo.');
    expect(dino(restored, 'rex')?.text).toBe('Hello Rex.');
    expect(dino(restored, 'rex')?.status).toBe('done');
    expect(restored[0].reactions).toEqual([{ dinoId: 'rex', emoji: '🔥' }]);
  });

  it('round-trips a transcript: toSession → loadSession preserves order, attribution, and reactions', async () => {
    await seedTranscript();
    const original = service.messages();
    const session = service.toSession('Group: design review');

    service.startNewSession();
    service.loadSession(session);
    const restored = service.messages();

    expect(restored.map((m) => m.role)).toEqual(original.map((m) => m.role));
    expect(restored.map((m) => m.dinoId)).toEqual(original.map((m) => m.dinoId));
    expect(restored.map((m) => m.text)).toEqual(original.map((m) => m.text));
    expect(restored.map((m) => m.reactions)).toEqual(original.map((m) => m.reactions));
  });

  it('reopening via loadSession adopts the session id so re-saving updates in place', async () => {
    await seedTranscript();
    const first = service.toSession('Group: design review');

    service.startNewSession();
    service.loadSession(first);
    const resaved = service.toSession('Group: design review (edited)');

    expect(resaved.id).toBe(first.id);
  });

  // ─── Group Engine v3 autonomous stream (Phase 41 / GRP3-03) ───
  //
  // v3 emits an EMPTY `plan` (round1: [], round2: []) — no pre-created slots —
  // and then drives the transcript purely from `dino_token`/`dino_done`
  // (slots created dynamically) plus first-class autonomous `reaction` events.
  // This drives a scripted multi-round mixed turn and proves the existing
  // applyEvent routing renders it unchanged: ordered answers, reply attribution,
  // a targeted reaction chip, and streaming cleared at the end.
  it('renders the v3 autonomous stream: empty plan, ordered answers, a targeted reaction, group_done', async () => {
    let userId = '';
    streamGroup.mockImplementation(() => {
      userId = service.messages()[0].id;
      return makeEvents([
        // v3 sends an EMPTY plan — no premature slots must be created.
        { type: 'plan', plan: { round1: [], round2: [] } },
        // Dino A answers the user.
        { type: 'dino_token', dinoId: 'rex', text: 'Spinosaurus ' },
        { type: 'dino_token', dinoId: 'rex', text: 'were aquatic.' },
        {
          type: 'dino_done',
          dinoId: 'rex',
          response: 'Spinosaurus were aquatic.',
          messageId: 's-rex',
          intent: 'answer_user',
          replyToMessageId: userId,
        },
        // Dino B answers LATER, replying to A (GRP3-02 attribution).
        { type: 'dino_token', dinoId: 'philo', text: 'I disagree, ' },
        { type: 'dino_token', dinoId: 'philo', text: 'they waded.' },
        {
          type: 'dino_done',
          dinoId: 'philo',
          response: 'I disagree, they waded.',
          messageId: 's-philo',
          intent: 'disagree_with_agent',
          replyToMessageId: 's-rex',
          replyToAgentId: 'rex',
        },
        // Dino C reacts to B's message (autonomous first-class reaction).
        { type: 'reaction', dinoId: 'glyphos', emoji: '🤔', targetMessageId: 's-philo' },
        { type: 'group_done' },
      ]);
    });

    service.send('Were Spinosaurus aquatic?', ['rex', 'philo', 'glyphos']);
    await tick();

    const msgs = service.messages();
    const dinoMsgs = msgs.filter((m) => m.role === 'dino');

    // The empty plan created NO premature slots — only the two answering dinos
    // produced bubbles, in arrival order (A before B).
    expect(dinoMsgs.map((m) => m.dinoId)).toEqual(['rex', 'philo']);

    // Transcript order overall: user, then A, then B (top-to-bottom).
    expect(msgs.map((m) => m.role)).toEqual(['user', 'dino', 'dino']);

    const rex = dino(msgs, 'rex');
    const philo = dino(msgs, 'philo');

    expect(rex?.text).toBe('Spinosaurus were aquatic.');
    expect(rex?.status).toBe('done');
    expect(rex?.intent).toBe('answer_user');

    // B carries its reply metadata (intent chip + reply stub source).
    expect(philo?.text).toBe('I disagree, they waded.');
    expect(philo?.status).toBe('done');
    expect(philo?.intent).toBe('disagree_with_agent');
    expect(philo?.replyToAgentId).toBe('rex');
    expect(philo?.replyToMessageId).toBe('s-rex');

    // C's reaction chip is pinned to B's message (matched by serverMessageId).
    expect(philo?.reactions).toEqual([{ dinoId: 'glyphos', emoji: '🤔' }]);
    // The reaction added NO extra transcript line.
    expect(dinoMsgs).toHaveLength(2);

    // The turn is fully settled.
    expect(service.streaming()).toBe(false);
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
