import { describe, it, expect, vi } from 'vitest';
import type { AgentsService } from './agents.service';
import {
  GroupAgentsService,
  parseOrchestratorPlan,
  buildAttributedHistory,
} from './group-agents.service';
import { getDino } from './dinos';
import type { Dino, GroupMessage, GroupOrchestratorPlan, GroupStreamEvent, StreamEvent } from '@org/shared-types';

const rexford = getDino('rexford');
const veloce = getDino('veloce');
const glyphos = getDino('glyphos');
const roster: Dino[] = [rexford, veloce, glyphos];

/** A fake streamAgent yielding one token then done. */
function fakeStreamAgent(): AsyncGenerator<StreamEvent, void, void> {
  async function* gen(): AsyncGenerator<StreamEvent, void, void> {
    yield { type: 'token', text: 'hi' };
    yield { type: 'done', response: 'hi', toolCalls: [] };
  }
  return gen();
}

/** Build a service with a mocked AgentsService and a stubbed orchestrator plan. */
function makeService(plan: GroupOrchestratorPlan): {
  service: GroupAgentsService;
  streamAgent: ReturnType<typeof vi.fn>;
} {
  const streamAgent = vi.fn(() => fakeStreamAgent());
  const agents = { streamAgent } as unknown as AgentsService;
  const service = new GroupAgentsService(agents);
  // Stub the private orchestrator so tests never hit OpenRouter and the plan is deterministic.
  // The forcing override still runs through streamGroup → runOrchestrator, so we stub runOrchestrator
  // itself but re-apply mention forcing through the public path by stubbing the LLM-bearing step only.
  vi.spyOn(
    service as unknown as { runOrchestrator: () => Promise<GroupOrchestratorPlan> },
    'runOrchestrator',
  ).mockImplementation(
    async (): Promise<GroupOrchestratorPlan> => structuredClone(plan),
  );
  return { service, streamAgent };
}

async function collect(gen: AsyncGenerator<GroupStreamEvent, void, void>): Promise<GroupStreamEvent[]> {
  const out: GroupStreamEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

describe('parseOrchestratorPlan', () => {
  it('parses clean JSON', () => {
    const raw = JSON.stringify({
      round1: [{ dinoId: 'rexford', action: 'answer', order: 0 }],
      round2: [],
    });
    const plan = parseOrchestratorPlan(raw, roster);
    expect(plan.round1).toHaveLength(1);
    expect(plan.round1[0]).toMatchObject({ dinoId: 'rexford', action: 'answer' });
  });

  it('parses JSON wrapped in code fences', () => {
    const raw = '```json\n' + JSON.stringify({ round1: [{ dinoId: 'veloce', action: 'answer', order: 0 }], round2: [] }) + '\n```';
    const plan = parseOrchestratorPlan(raw, roster);
    expect(plan.round1[0].dinoId).toBe('veloce');
  });

  it('drops unknown dinoIds', () => {
    const raw = JSON.stringify({
      round1: [
        { dinoId: 'rexford', action: 'answer', order: 0 },
        { dinoId: 'ghost', action: 'answer', order: 1 },
      ],
      round2: [],
    });
    const plan = parseOrchestratorPlan(raw, roster);
    expect(plan.round1).toHaveLength(1);
    expect(plan.round1[0].dinoId).toBe('rexford');
  });

  it('clamps round2 to MAX_INTER_DINO_REPLIES (3)', () => {
    const raw = JSON.stringify({
      round1: [{ dinoId: 'rexford', action: 'answer', order: 0 }],
      round2: [
        { dinoId: 'veloce', action: 'answer', order: 0 },
        { dinoId: 'glyphos', action: 'answer', order: 1 },
        { dinoId: 'rexford', action: 'answer', order: 2 },
        { dinoId: 'veloce', action: 'answer', order: 3 },
      ],
    });
    const plan = parseOrchestratorPlan(raw, roster);
    expect(plan.round2).toHaveLength(3);
  });

  it('keeps a single emoji on a react decision', () => {
    const raw = JSON.stringify({
      round1: [{ dinoId: 'veloce', action: 'react', emoji: '👍🔥', order: 0 }],
      round2: [],
    });
    const plan = parseOrchestratorPlan(raw, roster);
    expect(plan.round1[0].action).toBe('react');
    expect([...(plan.round1[0].emoji ?? '')]).toHaveLength(1);
  });

  it('returns the all-answer fallback on garbage', () => {
    const plan = parseOrchestratorPlan('not json at all {{{', roster);
    expect(plan.round1).toHaveLength(roster.length);
    expect(plan.round1.every((d) => d.action === 'answer')).toBe(true);
    expect(plan.round2).toHaveLength(0);
  });
});

describe('buildAttributedHistory', () => {
  const transcript: GroupMessage[] = [
    { id: 'm1', role: 'user', text: 'hello', createdAt: 1 },
    { id: 'm2', role: 'dino', dinoId: 'rexford', text: 'I am Rexford', createdAt: 2 },
    { id: 'm3', role: 'dino', dinoId: 'veloce', text: 'I am Veloce', createdAt: 3 },
  ];

  it('maps the answerer own messages to assistant', () => {
    const hist = buildAttributedHistory(transcript, 'rexford', roster);
    const own = hist.find((h) => h.text.startsWith('I am Rexford'));
    expect(own?.role).toBe('assistant');
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

describe('GroupAgentsService.streamGroup', () => {
  it('only answer decisions call streamAgent; react emits a reaction with no call', async () => {
    const plan: GroupOrchestratorPlan = {
      round1: [
        { dinoId: 'rexford', action: 'answer', order: 0 },
        { dinoId: 'veloce', action: 'react', emoji: '👍', order: 1 },
        { dinoId: 'glyphos', action: 'silent', order: 2 },
      ],
      round2: [],
    };
    const { service, streamAgent } = makeService(plan);
    const events = await collect(
      service.streamGroup('hello team', ['rexford', 'veloce', 'glyphos'], undefined, undefined, new AbortController().signal),
    );

    expect(streamAgent).toHaveBeenCalledTimes(1);
    expect(streamAgent.mock.calls[0][5]).toBe('rexford'); // dinoId arg position
    expect(events.some((e) => e.type === 'reaction' && e.dinoId === 'veloce' && e.emoji === '👍')).toBe(true);
  });

  it('forces an @mentioned silent dino to answer', async () => {
    const plan: GroupOrchestratorPlan = {
      round1: [{ dinoId: 'veloce', action: 'silent', order: 0 }],
      round2: [],
    };
    const { service, streamAgent } = makeService(plan);
    await collect(
      service.streamGroup('hey @Veloce help', ['rexford', 'veloce'], undefined, undefined, new AbortController().signal),
    );
    const calledDinoIds = streamAgent.mock.calls.map((c) => c[5]);
    expect(calledDinoIds).toContain('veloce');
  });

  it('runs at most MAX_INTER_DINO_REPLIES answer calls in round 2', async () => {
    const plan: GroupOrchestratorPlan = {
      round1: [{ dinoId: 'rexford', action: 'answer', order: 0 }],
      round2: [
        { dinoId: 'veloce', action: 'answer', order: 0 },
        { dinoId: 'glyphos', action: 'answer', order: 1 },
        { dinoId: 'rexford', action: 'answer', order: 2 },
        { dinoId: 'veloce', action: 'answer', order: 3 },
      ],
    };
    const { service, streamAgent } = makeService(plan);
    await collect(
      service.streamGroup('go', ['rexford', 'veloce', 'glyphos'], undefined, undefined, new AbortController().signal),
    );
    // 1 round-1 answerer + at most 3 round-2 answerers = 4 total.
    expect(streamAgent.mock.calls.length).toBeLessThanOrEqual(4);
    expect(streamAgent.mock.calls.length).toBe(4);
  });

  it('targets a round-2 reaction at the responded-to dino\'s round-1 message', async () => {
    const plan: GroupOrchestratorPlan = {
      round1: [{ dinoId: 'rexford', action: 'answer', order: 0 }],
      round2: [{ dinoId: 'veloce', action: 'react', emoji: '👍', respondingTo: 'rexford', order: 0 }],
    };
    const { service } = makeService(plan);
    const events = await collect(
      service.streamGroup('go', ['rexford', 'veloce'], undefined, undefined, new AbortController().signal),
    );
    const rexfordDone = events.find(
      (e): e is Extract<GroupStreamEvent, { type: 'dino_done' }> =>
        e.type === 'dino_done' && e.dinoId === 'rexford',
    );
    const reaction = events.find(
      (e): e is Extract<GroupStreamEvent, { type: 'reaction' }> =>
        e.type === 'reaction' && e.dinoId === 'veloce',
    );
    // The reaction must pin to Rexford's actual round-1 message id, not be dropped.
    expect(reaction?.targetMessageId).toBeDefined();
    expect(reaction?.targetMessageId).toBe(rexfordDone?.messageId);
  });

  it('emits a plan event first and group_done last', async () => {
    const plan: GroupOrchestratorPlan = {
      round1: [{ dinoId: 'rexford', action: 'answer', order: 0 }],
      round2: [],
    };
    const { service } = makeService(plan);
    const events = await collect(
      service.streamGroup('hi', ['rexford'], undefined, undefined, new AbortController().signal),
    );
    expect(events[0].type).toBe('plan');
    expect(events[events.length - 1].type).toBe('group_done');
  });
});
