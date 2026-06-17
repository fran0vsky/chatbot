import { describe, it, expect, vi } from 'vitest';
import type { AgentsService } from './agents.service';
import {
  GroupAgentsService,
  buildAttributedHistory,
  buildDirective,
} from './group-agents.service';
import { getDino } from './dinos';
import { getProfile } from './group/agent-profiles';
import type {
  Dino,
  DinoDecision,
  GroupMessage,
  GroupStreamEvent,
  StreamEvent,
} from '@org/shared-types';
import { MAX_ROUNDS, MAX_TOTAL_ANSWERS } from './group/decision';

const rexford = getDino('rexford');
const veloce = getDino('veloce');
const glyphos = getDino('glyphos');
const roster: Dino[] = [rexford, veloce, glyphos];

/** A fake streamAgent yielding one token then done. */
function fakeStreamAgent(text = 'hi'): AsyncGenerator<StreamEvent, void, void> {
  async function* gen(): AsyncGenerator<StreamEvent, void, void> {
    yield { type: 'token', text };
    yield { type: 'done', response: text, toolCalls: [] };
  }
  return gen();
}

/**
 * Build a service with a mocked AgentsService and a stubbed `decideAction` seam
 * so tests never hit OpenRouter and the autonomous loop is deterministic. The
 * `decision` factory receives the deciding dino's id so a test can script
 * per-dino actions.
 */
function makeService(opts: {
  decision?: DinoDecision | ((dinoId: string) => DinoDecision);
  answerText?: string;
}): {
  service: GroupAgentsService;
  streamAgent: ReturnType<typeof vi.fn>;
  decideAction: ReturnType<typeof vi.fn>;
} {
  const streamAgent = vi.fn(() => fakeStreamAgent(opts.answerText));
  const agents = { streamAgent } as unknown as AgentsService;
  const service = new GroupAgentsService(agents);

  const decide = opts.decision ?? ({ action: 'answer', intent: 'answer_user', confidence: 0.7 } as DinoDecision);
  const decideAction = vi.fn(async (...args: unknown[]) => {
    const dino = args[1] as Dino;
    return typeof decide === 'function' ? decide(dino.id) : decide;
  });
  vi.spyOn(
    service as unknown as { decideAction: typeof decideAction },
    'decideAction',
  ).mockImplementation(decideAction);

  return { service, streamAgent, decideAction };
}

async function collect(gen: AsyncGenerator<GroupStreamEvent, void, void>): Promise<GroupStreamEvent[]> {
  const out: GroupStreamEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

const signal = (): AbortSignal => new AbortController().signal;

describe('buildAttributedHistory', () => {
  const transcript: GroupMessage[] = [
    { id: 'm1', role: 'user', text: 'hello', createdAt: 1 },
    { id: 'm2', role: 'dino', dinoId: 'rexford', text: 'I am Rexford', createdAt: 2 },
    { id: 'm3', role: 'dino', dinoId: 'veloce', text: 'I am Veloce', createdAt: 3 },
  ];

  it('maps the answerer own messages to assistant', () => {
    const hist = buildAttributedHistory(transcript, 'rexford', roster);
    expect(hist.find((h) => h.text.startsWith('I am Rexford'))?.role).toBe('assistant');
  });

  it('maps other speakers to label-prefixed user turns', () => {
    const hist = buildAttributedHistory(transcript, 'rexford', roster);
    expect(hist.find((h) => h.text === 'User: hello')?.role).toBe('user');
    expect(hist.find((h) => h.text === 'Veloce: I am Veloce')?.role).toBe('user');
  });

  it('slices to HISTORY_CAP (20)', () => {
    const long: GroupMessage[] = Array.from({ length: 30 }, (_, i) => ({
      id: `x${i}`,
      role: 'user' as const,
      text: `msg ${i}`,
      createdAt: i,
    }));
    const hist = buildAttributedHistory(long, 'rexford', roster);
    expect(hist).toHaveLength(20);
    expect(hist[hist.length - 1].text).toBe('User: msg 29');
  });
});

describe('buildDirective (v3 — takes a DinoDecision)', () => {
  const p = getProfile('rexford');
  it('names the target for a disagreement', () => {
    const d = buildDirective({ action: 'answer', intent: 'disagree_with_agent' }, p, 'Veloce');
    expect(d).toContain('Veloce');
    expect(d.toLowerCase()).toContain('disagree');
  });
  it('tells an uncertain dino to defer to someone better suited', () => {
    const d = buildDirective({ action: 'answer', intent: 'admit_uncertainty' }, p, undefined);
    expect(d.toLowerCase()).toContain('better suited');
  });
  it('defaults a missing intent to answer_user', () => {
    const d = buildDirective({ action: 'answer' }, p, undefined);
    expect(d.toLowerCase()).toContain('answer user');
  });
});

describe('GroupAgentsService.streamGroup (v3 autonomous loop)', () => {
  it('emits a plan event first and group_done last', async () => {
    const { service } = makeService({ decision: { action: 'silent' } });
    const events = await collect(service.streamGroup('hi', ['rexford'], undefined, undefined, signal()));
    expect(events[0].type).toBe('plan');
    expect(events[events.length - 1].type).toBe('group_done');
  });

  it('consults every participant dino once in round 0 (no central pre-selection)', async () => {
    // All silent → exactly one round runs (zero answers stops the loop).
    const { service, decideAction } = makeService({ decision: { action: 'silent' } });
    await collect(
      service.streamGroup('go', ['rexford', 'veloce', 'glyphos'], undefined, undefined, signal()),
    );
    const consulted = decideAction.mock.calls.map((c) => (c[1] as Dino).id);
    expect(consulted).toEqual(['rexford', 'veloce', 'glyphos']);
  });

  it('an answer decision yields dino_token + dino_done and routes through the dino own model', async () => {
    // Only rexford answers; the rest stay silent so the loop stops after round 0.
    const { service, streamAgent } = makeService({
      decision: (id) =>
        id === 'rexford'
          ? { action: 'answer', intent: 'answer_user', confidence: 0.8 }
          : { action: 'silent' },
      answerText: 'petrol still wins',
    });
    const events = await collect(
      service.streamGroup('cars?', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    expect(events.some((e) => e.type === 'dino_token' && e.dinoId === 'rexford')).toBe(true);
    const done = events.find(
      (e): e is Extract<GroupStreamEvent, { type: 'dino_done' }> =>
        e.type === 'dino_done' && e.dinoId === 'rexford',
    );
    expect(done?.response).toBe('petrol still wins');
    // arg[5] = dinoId → own-model routing happens server-side in streamAgent.
    // Only rexford ever generates (veloce is always silent); rexford may take a
    // follow-up round, so assert every generation routed to rexford's id.
    const generators = streamAgent.mock.calls.map((c) => c[5]);
    expect(generators.length).toBeGreaterThan(0);
    expect(generators.every((id: unknown) => id === 'rexford')).toBe(true);
  });

  it('a react decision yields a reaction event with NO generation call', async () => {
    const { service, streamAgent } = makeService({
      decision: { action: 'react', emoji: '🔥' },
    });
    const events = await collect(
      service.streamGroup('go', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    expect(streamAgent).not.toHaveBeenCalled();
    const reaction = events.find(
      (e): e is Extract<GroupStreamEvent, { type: 'reaction' }> => e.type === 'reaction',
    );
    expect(reaction?.emoji).toBe('🔥');
    expect(reaction?.targetMessageId).toBeDefined();
  });

  it('a silent decision yields nothing but plan + group_done', async () => {
    const { service, streamAgent } = makeService({ decision: { action: 'silent' } });
    const events = await collect(
      service.streamGroup('go', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    expect(streamAgent).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).toEqual(['plan', 'group_done']);
  });

  it('pushes each answer onto the transcript before the next dino decides (sequential context)', async () => {
    // veloce answers in round 0; by the time glyphos decides, rexford+veloce
    // turns should already be in the thread the decision call receives.
    const seen: number[] = [];
    const streamAgent = vi.fn(() => fakeStreamAgent('a'));
    const service = new GroupAgentsService({ streamAgent } as unknown as AgentsService);
    vi.spyOn(
      service as unknown as { decideAction: (...a: unknown[]) => Promise<DinoDecision> },
      'decideAction',
    ).mockImplementation(async (...args: unknown[]) => {
      const state = args[2] as { transcript: GroupMessage[] };
      seen.push(state.transcript.filter((m) => m.role === 'dino').length);
      return { action: 'answer', intent: 'answer_user', confidence: 0.7 };
    });
    await collect(
      service.streamGroup('go', ['rexford', 'veloce', 'glyphos'], undefined, undefined, signal()),
    );
    // First three consults (round 0) see 0, 1, 2 prior dino messages respectively.
    expect(seen.slice(0, 3)).toEqual([0, 1, 2]);
  });

  it('forces an @mentioned dino to answer in round 0 (skips its decision call)', async () => {
    const { service, streamAgent, decideAction } = makeService({
      decision: { action: 'silent' },
    });
    await collect(
      service.streamGroup('hey @Veloce help', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    // veloce was forced → it answered (streamAgent) and was NOT consulted in round 0.
    expect(streamAgent.mock.calls.map((c) => c[5])).toContain('veloce');
    const round0Consulted = decideAction.mock.calls
      .slice(0, 2)
      .map((c) => (c[1] as Dino).id);
    expect(round0Consulted).not.toContain('veloce');
  });

  it('lets an image-gen dino react instead of answering (never calls streamAgent for it)', async () => {
    const { service, streamAgent } = makeService({
      decision: (id) =>
        id === 'rexford'
          ? { action: 'answer', intent: 'answer_user', confidence: 0.8 }
          : { action: 'silent' },
    });
    const events = await collect(
      service.streamGroup('draw a car', ['rexford', 'vinci'], undefined, undefined, signal()),
    );
    const called = streamAgent.mock.calls.map((c) => c[5]);
    expect(called).toContain('rexford');
    expect(called).not.toContain('vinci');
    expect(events.some((e) => e.type === 'reaction' && e.dinoId === 'vinci')).toBe(true);
  });

  it('enforces the cost ceiling: total answers <= MAX_TOTAL_ANSWERS and rounds <= MAX_ROUNDS', async () => {
    // Every dino always wants to answer → caps must bound the run.
    const { service, streamAgent, decideAction } = makeService({
      decision: { action: 'answer', intent: 'answer_user', confidence: 0.9 },
    });
    await collect(
      service.streamGroup(
        'go',
        ['rexford', 'veloce', 'glyphos', 'nimbus'],
        undefined,
        undefined,
        signal(),
      ),
    );
    // Answers (streamAgent generation calls) never exceed the hard total ceiling.
    expect(streamAgent.mock.calls.length).toBeLessThanOrEqual(MAX_TOTAL_ANSWERS);
    // decideAction runs at most MAX_GROUP_DINOS (4) × MAX_ROUNDS per turn.
    expect(decideAction.mock.calls.length).toBeLessThanOrEqual(4 * MAX_ROUNDS);
  });

  it('stops after a zero-answer round (everyone reacts/stays silent)', async () => {
    const { service, decideAction } = makeService({ decision: { action: 'react', emoji: '👍' } });
    await collect(
      service.streamGroup('go', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    // Round 0 produced zero answers → only one round of consults (2 dinos).
    expect(decideAction.mock.calls.length).toBe(2);
  });
});
