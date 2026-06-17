import { describe, it, expect } from 'vitest';
import type { GroupMessage } from '@org/shared-types';
import { initConversationState, type ConversationState } from './governor';

// v3 (Phase 41) pruned the central director: the only governor surface left is
// the lean per-turn ConversationState + its seeder. Everything else
// (pickNextSpeaker/scoreSpeaker/allowedIntents/validateIntent/TurnBudget/…) was
// removed because each dino now decides autonomously on its own model.

const dinoMsg = (id: string, dinoId: string): GroupMessage => ({
  id,
  role: 'dino',
  dinoId,
  text: `${dinoId} said something`,
  createdAt: 1,
});

describe('initConversationState', () => {
  it('seeds the transcript from prior history (as a copy, not a reference)', () => {
    const history: GroupMessage[] = [dinoMsg('m1', 'rexford')];
    const state: ConversationState = initConversationState(history);
    expect(state.transcript).toEqual(history);
    expect(state.transcript).not.toBe(history);
  });

  it('starts empty when there is no history', () => {
    const state = initConversationState([]);
    expect(state.transcript).toEqual([]);
  });

  it('mutating the state transcript does not mutate the source history', () => {
    const history: GroupMessage[] = [dinoMsg('m1', 'veloce')];
    const state = initConversationState(history);
    state.transcript.push(dinoMsg('m2', 'glyphos'));
    expect(history).toHaveLength(1);
    expect(state.transcript).toHaveLength(2);
  });
});
