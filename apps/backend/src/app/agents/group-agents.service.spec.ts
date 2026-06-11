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
  GroupMessage,
  GroupStreamEvent,
  StreamEvent,
  TopicAnalysis,
} from '@org/shared-types';
import type { IntentDecision } from './group/governor';

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

const baseTopic = (over: Partial<TopicAnalysis> = {}): TopicAnalysis => ({
  subtopics: ['cars'],
  requiredExpertise: ['cars'],
  isContested: true,
  bestSuitedDinoIds: ['rexford', 'veloce', 'glyphos'],
  ...over,
});

/**
 * Build a service with a mocked AgentsService and stubbed director seams
 * (analyzeTopic + decideIntent) so tests never hit OpenRouter and the
 * discussion is deterministic.
 */
function makeService(opts: {
  topic?: TopicAnalysis;
  decision?: IntentDecision | (() => IntentDecision);
  answerText?: string;
}): { service: GroupAgentsService; streamAgent: ReturnType<typeof vi.fn> } {
  const streamAgent = vi.fn(() => fakeStreamAgent(opts.answerText));
  const agents = { streamAgent } as unknown as AgentsService;
  const service = new GroupAgentsService(agents);

  vi.spyOn(
    service as unknown as { analyzeTopic: () => Promise<TopicAnalysis> },
    'analyzeTopic',
  ).mockResolvedValue(opts.topic ?? baseTopic());

  const decide = opts.decision ?? ({ intent: 'answer_user', confidence: 0.7 } as IntentDecision);
  vi.spyOn(
    service as unknown as { decideIntent: () => Promise<IntentDecision> },
    'decideIntent',
  ).mockImplementation(async () => (typeof decide === 'function' ? decide() : decide));

  return { service, streamAgent };
}

async function collect(gen: AsyncGenerator<GroupStreamEvent, void, void>): Promise<GroupStreamEvent[]> {
  const out: GroupStreamEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

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

describe('buildDirective', () => {
  const p = getProfile('rexford');
  it('names the target for a disagreement', () => {
    const d = buildDirective('disagree_with_agent', p, 'Veloce', baseTopic());
    expect(d).toContain('Veloce');
    expect(d.toLowerCase()).toContain('disagree');
  });
  it('tells an uncertain dino to defer to someone better suited', () => {
    const d = buildDirective('admit_uncertainty', p, undefined, baseTopic());
    expect(d.toLowerCase()).toContain('better suited');
  });
});

describe('GroupAgentsService.streamGroup (dynamic engine)', () => {
  const signal = (): AbortSignal => new AbortController().signal;

  it('emits a plan event first and group_done last', async () => {
    const { service } = makeService({});
    const events = await collect(service.streamGroup('hi', ['rexford'], undefined, undefined, signal()));
    expect(events[0].type).toBe('plan');
    expect(events[events.length - 1].type).toBe('group_done');
  });

  it('only real speaking turns call streamAgent, with a per-turn directive', async () => {
    const { service, streamAgent } = makeService({});
    await collect(service.streamGroup('cars?', ['rexford'], undefined, undefined, signal()));
    expect(streamAgent).toHaveBeenCalled();
    // arg[5] = dinoId, arg[9] = directive
    expect(streamAgent.mock.calls[0][5]).toBe('rexford');
    expect(typeof streamAgent.mock.calls[0][9]).toBe('string');
  });

  it('never exceeds the per-turn message budget', async () => {
    const { service, streamAgent } = makeService({});
    await collect(
      service.streamGroup('go', ['rexford', 'veloce', 'glyphos'], undefined, undefined, signal()),
    );
    // budget.maxAgentMessages for 3 dinos = min(8, max(3, 6)) = 6.
    expect(streamAgent.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('forces an @mentioned dino to answer', async () => {
    const { service, streamAgent } = makeService({});
    await collect(
      service.streamGroup('hey @Veloce help', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    expect(streamAgent.mock.calls.map((c) => c[5])).toContain('veloce');
  });

  it('attaches intent + reply metadata to a targeted reply', async () => {
    // Every intent call returns "disagree with rexford"; only valid once a dino
    // has spoken, so the first speaker is coerced to answer_user by the governor.
    const { service } = makeService({
      topic: baseTopic({ bestSuitedDinoIds: ['rexford', 'veloce'] }),
      decision: { intent: 'disagree_with_agent', targetAgentId: 'rexford', confidence: 0.8 },
    });
    const events = await collect(
      service.streamGroup('petrol vs electric?', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    const veloceDone = events.find(
      (e): e is Extract<GroupStreamEvent, { type: 'dino_done' }> =>
        e.type === 'dino_done' && e.dinoId === 'veloce',
    );
    expect(veloceDone?.intent).toBe('disagree_with_agent');
    expect(veloceDone?.replyToAgentId).toBe('rexford');
    expect(veloceDone?.replyToMessageId).toBeDefined();
  });

  it('lets an image-gen dino react instead of answering (never calls streamAgent)', async () => {
    const { service, streamAgent } = makeService({
      topic: baseTopic({ bestSuitedDinoIds: ['rexford', 'vinci'] }),
    });
    const events = await collect(
      service.streamGroup('draw a car', ['rexford', 'vinci'], undefined, undefined, signal()),
    );
    const called = streamAgent.mock.calls.map((c) => c[5]);
    expect(called).toContain('rexford');
    expect(called).not.toContain('vinci');
    expect(events.some((e) => e.type === 'reaction' && e.dinoId === 'vinci')).toBe(true);
  });

  it('terminates without generation when every dino stays silent', async () => {
    const { service, streamAgent } = makeService({
      decision: { intent: 'stay_silent', confidence: 0.5 },
    });
    const events = await collect(
      service.streamGroup('go', ['rexford', 'veloce'], undefined, undefined, signal()),
    );
    expect(streamAgent).not.toHaveBeenCalled();
    expect(events[events.length - 1].type).toBe('group_done');
  });
});
