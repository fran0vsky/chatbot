import { describe, it, expect } from 'vitest';
import { AGENT_PROFILES } from './agent-profiles';
import {
  MAX_GROUP_DINOS,
  MAX_ROUNDS,
  MAX_ANSWERS_PER_DINO,
  MAX_TOTAL_ANSWERS,
  buildDecisionPrompt,
  parseDecision,
  heuristicDecision,
  initRoundCounters,
  recordAnswer,
  dinoAtAnswerCap,
  atTotalAnswerCap,
  shouldStopRounds,
  clamp01,
} from './decision';

describe('cost-ceiling constants', () => {
  it('expose the documented v3 values', () => {
    expect(MAX_GROUP_DINOS).toBe(4);
    expect(MAX_ROUNDS).toBe(3);
    expect(MAX_ANSWERS_PER_DINO).toBe(2);
    expect(MAX_TOTAL_ANSWERS).toBe(8);
  });
});

describe('clamp01', () => {
  it('clamps to 0..1 and defaults non-finite input', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0.6);
  });
});

describe('buildDecisionPrompt', () => {
  it('returns pure system+human strings in persona, mentioning all three actions', () => {
    const p = AGENT_PROFILES['rexford'];
    const { system, human } = buildDecisionPrompt(p, 'User: hi', true);
    expect(typeof system).toBe('string');
    expect(typeof human).toBe('string');
    expect(system).toContain('Rexford');
    expect(system).toContain('answer');
    expect(system).toContain('react');
    expect(system).toContain('silent');
    expect(system).toContain('ONLY a JSON object');
    expect(human).toContain('User: hi');
    expect(human).toContain('already spoken this round');
  });

  it('tells the dino when no one has spoken yet', () => {
    const { human } = buildDecisionPrompt(AGENT_PROFILES['iris'], 'User: hi', false);
    expect(human).toContain('No dino has spoken yet');
  });
});

describe('parseDecision tolerance', () => {
  it('parses fenced JSON', () => {
    const d = parseDecision('```json\n{"action":"react","emoji":"🔥"}\n```');
    expect(d.action).toBe('react');
    expect(d.emoji).toBe('🔥');
  });

  it('parses plain JSON answer with stance', () => {
    const d = parseDecision('{"action":"answer","intent":"build_on_agent","confidence":0.8}');
    expect(d.action).toBe('answer');
    expect(d.intent).toBe('build_on_agent');
    expect(d.confidence).toBe(0.8);
  });

  it('returns silent (no throw) on garbage', () => {
    const d = parseDecision('garbage not json');
    expect(d.action).toBe('silent');
  });

  it('coerces an unknown action to silent', () => {
    const d = parseDecision('{"action":"explode"}');
    expect(d.action).toBe('silent');
  });

  it('coerces an unknown answer intent to answer_user', () => {
    const d = parseDecision('{"action":"answer","intent":"nonsense"}');
    expect(d.action).toBe('answer');
    expect(d.intent).toBe('answer_user');
  });

  it('downgrades react-without-emoji to silent', () => {
    const d = parseDecision('{"action":"react"}');
    expect(d.action).toBe('silent');
  });

  it('downgrades react with empty/whitespace emoji to silent', () => {
    const d = parseDecision('{"action":"react","emoji":"   "}');
    expect(d.action).toBe('silent');
  });

  it('clamps confidence into 0..1', () => {
    expect(parseDecision('{"action":"silent","confidence":5}').confidence).toBe(1);
    expect(parseDecision('{"action":"silent","confidence":-3}').confidence).toBe(0);
  });

  it('preserves replyTo* on an answer', () => {
    const d = parseDecision(
      '{"action":"answer","replyToMessageId":"m1","replyToAgentId":"veloce"}',
    );
    expect(d.replyToMessageId).toBe('m1');
    expect(d.replyToAgentId).toBe('veloce');
  });
});

describe('heuristicDecision validity', () => {
  it('a talkative profile (rexford) answers', () => {
    const d = heuristicDecision(AGENT_PROFILES['rexford'], false);
    expect(d.action).toBe('answer');
    expect(d.intent).toBeDefined();
  });

  it('a talkative challenger derives a targeted stance when others have spoken', () => {
    const d = heuristicDecision(AGENT_PROFILES['rexford'], true);
    expect(d.action).toBe('answer');
    expect(d.intent).toBe('disagree_with_agent');
  });

  it('a reticent profile reacts (with emoji) when there is a prior turn', () => {
    // veloce: talkativeness 0.5, confidence 0.78 → still answers; use a hand-built reticent profile.
    const reticent = {
      ...AGENT_PROFILES['iris'],
      confidence: 0.5,
      interactionBiases: { likesToChallenge: 0.2, likesToSupport: 0.3, talkativeness: 0.3 },
    };
    const d = heuristicDecision(reticent, true);
    expect(d.action).toBe('react');
    expect(typeof d.emoji).toBe('string');
    expect(d.emoji?.length).toBeGreaterThan(0);
  });

  it('a reticent profile with no prior turn stays silent', () => {
    const reticent = {
      ...AGENT_PROFILES['iris'],
      confidence: 0.5,
      interactionBiases: { likesToChallenge: 0.2, likesToSupport: 0.3, talkativeness: 0.3 },
    };
    const d = heuristicDecision(reticent, false);
    expect(d.action).toBe('silent');
  });

  it('always returns a valid shape: emoji present iff react', () => {
    for (const p of Object.values(AGENT_PROFILES)) {
      for (const prior of [true, false]) {
        const d = heuristicDecision(p, prior);
        expect(['answer', 'react', 'silent']).toContain(d.action);
        if (d.action === 'react') expect(d.emoji).toBeTruthy();
        else expect(d.emoji).toBeUndefined();
      }
    }
  });
});

describe('round/cost predicates', () => {
  it('dinoAtAnswerCap is true at MAX_ANSWERS_PER_DINO', () => {
    const c = initRoundCounters();
    expect(dinoAtAnswerCap(c, 'rexford')).toBe(false);
    for (let i = 0; i < MAX_ANSWERS_PER_DINO; i++) recordAnswer(c, 'rexford');
    expect(dinoAtAnswerCap(c, 'rexford')).toBe(true);
    // a different dino is unaffected
    expect(dinoAtAnswerCap(c, 'veloce')).toBe(false);
  });

  it('atTotalAnswerCap is true at MAX_TOTAL_ANSWERS', () => {
    const c = initRoundCounters();
    expect(atTotalAnswerCap(c)).toBe(false);
    for (let i = 0; i < MAX_TOTAL_ANSWERS; i++) recordAnswer(c, `d${i}`);
    expect(atTotalAnswerCap(c)).toBe(true);
  });

  it('shouldStopRounds stops when a round produced zero answers', () => {
    expect(shouldStopRounds(0, 0)).toBe(true);
  });

  it('shouldStopRounds stops at the round cap', () => {
    // roundIndex MAX_ROUNDS-1 is the last allowed round → stop after it
    expect(shouldStopRounds(MAX_ROUNDS - 1, 3)).toBe(true);
  });

  it('shouldStopRounds continues mid-conversation with answers', () => {
    expect(shouldStopRounds(0, 2)).toBe(false);
  });
});
