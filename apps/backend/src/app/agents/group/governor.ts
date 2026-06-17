import { GroupMessage, TopicAnalysis } from '@org/shared-types';

// --- Conversation state (Group Engine v3, Phase 41) --------------------------
// The Phase 37 governor (central speaker scheduling, the allowed-intent set,
// intent validation/downgrades, the per-turn TurnBudget, and the topic-fit
// scoring) is GONE in v3: every dino now decides autonomously on its own model
// (see `group/decision.ts` for the flat cost ceiling and decision primitive).
// What survives is just the working transcript bookkeeping the engine still
// needs — the interleaved attributed message list for one user turn.

/** The engine's working memory for one user turn (just the live transcript). */
export interface ConversationState {
  /** The interleaved attributed transcript: prior history + this turn's messages. */
  transcript: GroupMessage[];
  /**
   * Retained for back-compat with the `initConversationState(history, topic)`
   * call shape. v3 no longer runs central topic analysis, so this is unused by
   * the engine; kept optional so the type stays stable for any reader.
   */
  topic?: TopicAnalysis;
}

/** Seed a fresh per-turn state from prior history (transcript is a copy). */
export function initConversationState(
  history: GroupMessage[],
  topic?: TopicAnalysis,
): ConversationState {
  return { transcript: [...history], topic };
}
