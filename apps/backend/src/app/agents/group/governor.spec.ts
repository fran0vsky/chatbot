import { describe, it, expect } from 'vitest';
import type { AgentProfile, GroupMessage, TopicAnalysis } from '@org/shared-types';
import {
  allowedIntents,
  canContinue,
  defaultBudget,
  eligibleSpeakers,
  expertiseMatch,
  initConversationState,
  pickNextSpeaker,
  recordSilence,
  recordTurn,
  topicHitsWeakArea,
  validateIntent,
  type ConversationState,
  type IntentDecision,
} from './governor';

function profile(over: Partial<AgentProfile> & { dinoId: string }): AgentProfile {
  return {
    name: over.dinoId,
    species: 'Test',
    personality: '',
    speakingStyle: '',
    expertiseAreas: [],
    weakAreas: [],
    debateStyle: 'diplomatic',
    confidence: 0.6,
    interactionBiases: { likesToChallenge: 0.5, likesToSupport: 0.5, talkativeness: 0.5 },
    ...over,
  };
}

const topic = (over: Partial<TopicAnalysis> = {}): TopicAnalysis => ({
  subtopics: [],
  requiredExpertise: [],
  isContested: false,
  bestSuitedDinoIds: [],
  ...over,
});

function stateWith(transcript: GroupMessage[], t: TopicAnalysis = topic()): ConversationState {
  return initConversationState(transcript, t);
}

const dinoMsg = (id: string, dinoId: string, over: Partial<GroupMessage> = {}): GroupMessage => ({
  id,
  role: 'dino',
  dinoId,
  text: `${dinoId} said something`,
  createdAt: 1,
  ...over,
});

describe('expertiseMatch / topicHitsWeakArea', () => {
  it('scores the fraction of required tags the dino covers', () => {
    const p = profile({ dinoId: 'a', expertiseAreas: ['code', 'tech'] });
    expect(expertiseMatch(p, topic({ requiredExpertise: ['code', 'art'] }))).toBe(0.5);
    expect(expertiseMatch(p, topic({ requiredExpertise: ['code', 'tech'] }))).toBe(1);
  });

  it('detects when the topic hits a weak area', () => {
    const p = profile({ dinoId: 'a', weakAreas: ['art'] });
    expect(topicHitsWeakArea(p, topic({ requiredExpertise: ['art'] }))).toBe(true);
    expect(topicHitsWeakArea(p, topic({ subtopics: ['art'] }))).toBe(true);
    expect(topicHitsWeakArea(p, topic({ requiredExpertise: ['code'] }))).toBe(false);
  });
});

describe('eligibleSpeakers', () => {
  const profiles = [profile({ dinoId: 'a' }), profile({ dinoId: 'b' })];

  it('excludes the last speaker (no back-to-back turns)', () => {
    const state = stateWith([]);
    state.lastSpeaker = 'a';
    const ids = eligibleSpeakers(profiles, state, defaultBudget(2)).map((p) => p.dinoId);
    expect(ids).toEqual(['b']);
  });

  it('excludes a dino that hit its per-agent turn cap', () => {
    const budget = defaultBudget(2);
    const state = stateWith([]);
    state.perAgentTurns = { a: budget.maxTurnsPerAgent };
    const ids = eligibleSpeakers(profiles, state, budget).map((p) => p.dinoId);
    expect(ids).toEqual(['b']);
  });
});

describe('pickNextSpeaker', () => {
  it('prefers the dino with the best expertise fit', () => {
    const profiles = [
      profile({ dinoId: 'generalist' }),
      profile({ dinoId: 'expert', expertiseAreas: ['batteries'] }),
    ];
    const state = stateWith([], topic({ requiredExpertise: ['batteries'] }));
    expect(pickNextSpeaker(profiles, state, defaultBudget(2))).toBe('expert');
  });

  it('gives right-of-reply to a directly-asked dino', () => {
    const profiles = [profile({ dinoId: 'a' }), profile({ dinoId: 'b' })];
    const state = stateWith([
      dinoMsg('m1', 'a', { intent: 'ask_agent', replyToAgentId: 'b' }),
    ]);
    // 'a' just spoke, so it's excluded anyway; 'b' was asked → 'b'.
    expect(pickNextSpeaker(profiles, state, defaultBudget(2))).toBe('b');
  });

  it('returns undefined when nobody is eligible', () => {
    const profiles = [profile({ dinoId: 'a' })];
    const budget = defaultBudget(1);
    const state = stateWith([]);
    state.perAgentTurns = { a: budget.maxTurnsPerAgent };
    expect(pickNextSpeaker(profiles, state, budget)).toBeUndefined();
  });
});

describe('allowedIntents', () => {
  const p = profile({ dinoId: 'a', expertiseAreas: ['cars'] });

  it('first speaker can only answer (no stay_silent when no prior dino)', () => {
    const intents = allowedIntents(p, stateWith([]), defaultBudget(3));
    expect(intents).toEqual(['answer_user']);
    expect(intents).not.toContain('stay_silent');
  });

  it('allows targeted intents once a dino has spoken', () => {
    const state = stateWith([dinoMsg('m1', 'b')], topic({ requiredExpertise: ['cars'] }));
    const intents = allowedIntents(p, state, defaultBudget(3));
    expect(intents).toContain('build_on_agent');
    expect(intents).toContain('disagree_with_agent'); // expertise >= 0.5
  });

  it('bars disagreement when the topic is neither contested nor in expertise', () => {
    const weak = profile({ dinoId: 'a', expertiseAreas: ['art'] });
    const state = stateWith([dinoMsg('m1', 'b')], topic({ requiredExpertise: ['batteries'] }));
    expect(allowedIntents(weak, state, defaultBudget(3))).not.toContain('disagree_with_agent');
  });

  it('offers uncertainty/ask when the topic hits a weak area', () => {
    const weak = profile({ dinoId: 'a', weakAreas: ['batteries'] });
    const state = stateWith([dinoMsg('m1', 'b')], topic({ requiredExpertise: ['batteries'] }));
    const intents = allowedIntents(weak, state, defaultBudget(3));
    expect(intents).toContain('admit_uncertainty');
    expect(intents).toContain('ask_agent');
  });

  it('bars agreement once the agreement streak is saturated', () => {
    const state = stateWith([dinoMsg('m1', 'b')]);
    state.consecutiveAgreements = 1; // == maxConsecutiveAgreements default
    expect(allowedIntents(p, state, defaultBudget(3))).not.toContain('agree_with_agent');
  });
});

describe('validateIntent', () => {
  const p = profile({ dinoId: 'a', expertiseAreas: ['cars'] });
  const budget = defaultBudget(3);

  it('coerces a disallowed intent to answer_user', () => {
    const state = stateWith([]); // first speaker: disagree not allowed
    const d: IntentDecision = { intent: 'disagree_with_agent', confidence: 0.9 };
    expect(validateIntent(p, d, state, budget).intent).toBe('answer_user');
  });

  it('resolves a targeted intent to the addressed message', () => {
    const state = stateWith([dinoMsg('m1', 'b')], topic({ requiredExpertise: ['cars'] }));
    const d: IntentDecision = { intent: 'build_on_agent', targetAgentId: 'b', confidence: 0.8 };
    const out = validateIntent(p, d, state, budget);
    expect(out.intent).toBe('build_on_agent');
    expect(out.targetMessageId).toBe('m1');
    expect(out.targetAgentId).toBe('b');
  });

  it('downgrades a reply that would dogpile an over-replied dino', () => {
    const state = stateWith([dinoMsg('m1', 'b')], topic({ requiredExpertise: ['cars'] }));
    state.repliesToAgent = { b: budget.maxRepliesPerAgent };
    const d: IntentDecision = { intent: 'disagree_with_agent', targetAgentId: 'b', confidence: 0.8 };
    expect(validateIntent(p, d, state, budget).intent).toBe('answer_user');
  });

  it('never lets a dino reply to its own message', () => {
    const state = stateWith([dinoMsg('m1', 'a')], topic({ requiredExpertise: ['cars'] }));
    const d: IntentDecision = { intent: 'build_on_agent', targetAgentId: 'a', confidence: 0.8 };
    const out = validateIntent(p, d, state, budget);
    expect(out.intent).toBe('answer_user');
    expect(out.targetMessageId).toBeUndefined();
  });
});

describe('bookkeeping + termination', () => {
  it('recordTurn tracks turns, reply caps, and the agreement streak', () => {
    const state = stateWith([dinoMsg('m1', 'b')]);
    recordTurn(state, 'a', { intent: 'agree_with_agent', targetMessageId: 'm1', targetAgentId: 'b', confidence: 0.7 });
    expect(state.turnsTaken).toBe(1);
    expect(state.perAgentTurns['a']).toBe(1);
    expect(state.lastSpeaker).toBe('a');
    expect(state.repliesToMessage['m1']).toBe(1);
    expect(state.repliesToAgent['b']).toBe(1);
    expect(state.consecutiveAgreements).toBe(1);

    recordTurn(state, 'c', { intent: 'answer_user', confidence: 0.6 });
    expect(state.consecutiveAgreements).toBe(0); // reset on non-agree
  });

  it('recordSilence advances progress so the loop can terminate', () => {
    const state = stateWith([]);
    recordSilence(state, 'a');
    expect(state.consecutiveSilences).toBe(1);
    expect(state.perAgentTurns['a']).toBe(1);
    expect(state.lastSpeaker).toBe('a');
  });

  it('canContinue stops at the message ceiling', () => {
    const budget = defaultBudget(3);
    const state = stateWith([]);
    state.turnsTaken = budget.maxAgentMessages;
    expect(canContinue(state, budget)).toBe(false);
  });
});
