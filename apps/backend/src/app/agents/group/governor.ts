import {
  AgentProfile,
  GroupMessage,
  SpeechIntent,
  TopicAnalysis,
  isTargetedIntent,
} from '@org/shared-types';

// --- The Conversation Governor (Phase 37) ------------------------------------
// Every anti-chaos rule lives here as a pure function so it is auditable and
// unit-testable without touching an LLM: the per-turn budget, who is eligible to
// speak, the speaker score, the allowed intent set, intent validation
// (downgrades), and the post-turn bookkeeping. The engine is the only caller.

/** Hard ceilings for a single user message. Tuned per roster size. */
export interface TurnBudget {
  /** Total dino MESSAGES generated this user turn (the loop's hard stop). */
  maxAgentMessages: number;
  /** Max replies pinned to any one message (anti pile-up). */
  maxRepliesPerMessage: number;
  /** Max times any one dino may be replied to (anti dogpile). */
  maxRepliesPerAgent: number;
  /** Consecutive `agree_with_agent` turns allowed before agreement is barred. */
  maxConsecutiveAgreements: number;
  /** Max turns a single dino may take (anti monologue). */
  maxTurnsPerAgent: number;
}

/**
 * Budget scales gently with roster size but is always bounded so the worst-case
 * LLM cost stays near the old `1 + 4 + 3 = 8` ceiling: 1 topic call + N intent
 * calls + N generation calls, with N = maxAgentMessages.
 */
export function defaultBudget(rosterSize: number): TurnBudget {
  return {
    maxAgentMessages: Math.min(8, Math.max(3, rosterSize * 2)),
    maxRepliesPerMessage: 2,
    maxRepliesPerAgent: 2,
    maxConsecutiveAgreements: 1,
    maxTurnsPerAgent: 2,
  };
}

/** The engine's working memory for one user turn. */
export interface ConversationState {
  transcript: GroupMessage[];
  turnsTaken: number;
  perAgentTurns: Record<string, number>;
  repliesToMessage: Record<string, number>;
  repliesToAgent: Record<string, number>;
  lastSpeaker?: string;
  consecutiveAgreements: number;
  consecutiveSilences: number;
  topic: TopicAnalysis;
}

/** A resolved decision about how the chosen dino will speak this turn. */
export interface IntentDecision {
  intent: SpeechIntent;
  targetMessageId?: string;
  targetAgentId?: string;
  confidence: number;
}

export function initConversationState(
  history: GroupMessage[],
  topic: TopicAnalysis,
): ConversationState {
  return {
    transcript: [...history],
    turnsTaken: 0,
    perAgentTurns: {},
    repliesToMessage: {},
    repliesToAgent: {},
    consecutiveAgreements: 0,
    consecutiveSilences: 0,
    topic,
  };
}

/** The most recent dino-authored message in the transcript, if any. */
export function lastDinoMessage(state: ConversationState): GroupMessage | undefined {
  for (let i = state.transcript.length - 1; i >= 0; i--) {
    if (state.transcript[i].role === 'dino') return state.transcript[i];
  }
  return undefined;
}

const norm = (t: string): string => t.toLowerCase().trim();

/** Fraction of the topic's required expertise this profile covers (0..1). */
export function expertiseMatch(profile: AgentProfile, topic: TopicAnalysis): number {
  if (topic.requiredExpertise.length === 0) return 0.5;
  const strong = new Set(profile.expertiseAreas.map(norm));
  const hits = topic.requiredExpertise.filter((t) => strong.has(norm(t))).length;
  return hits / topic.requiredExpertise.length;
}

/** True when the topic touches one of this dino's declared weak areas. */
export function topicHitsWeakArea(profile: AgentProfile, topic: TopicAnalysis): boolean {
  const weak = new Set(profile.weakAreas.map(norm));
  if (weak.size === 0) return false;
  return (
    topic.requiredExpertise.some((t) => weak.has(norm(t))) ||
    topic.subtopics.some((t) => weak.has(norm(t)))
  );
}

/** Dinos still allowed to speak this turn: under their turn cap, not last speaker. */
export function eligibleSpeakers(
  profiles: AgentProfile[],
  state: ConversationState,
  budget: TurnBudget,
): AgentProfile[] {
  return profiles.filter((p) => {
    if ((state.perAgentTurns[p.dinoId] ?? 0) >= budget.maxTurnsPerAgent) return false;
    // No back-to-back turns (kills A→B→A→B ping-pong) — unless it's the only
    // dino left who can speak.
    if (profiles.length > 1 && p.dinoId === state.lastSpeaker) return false;
    return true;
  });
}

/**
 * Score how natural/useful it is for `profile` to speak next. Higher = better.
 * Pure and deterministic (no jitter) so selection is reproducible in tests.
 */
export function scoreSpeaker(
  profile: AgentProfile,
  state: ConversationState,
  last: GroupMessage | undefined,
): number {
  let score = 0;
  score += 2.0 * expertiseMatch(profile, state.topic);
  score += 1.0 * profile.interactionBiases.talkativeness;
  // Right-of-reply: a dino directly asked a question jumps the queue.
  if (last && last.intent === 'ask_agent' && last.replyToAgentId === profile.dinoId) {
    score += 3.0;
  }
  // Affinity toward whoever just spoke.
  if (last?.dinoId) {
    score += 0.5 * (profile.interactionBiases.affinity?.[last.dinoId] ?? 0);
  }
  // Pre-ranked best-suited dinos get a small nudge for the first turns.
  const rank = state.topic.bestSuitedDinoIds.indexOf(profile.dinoId);
  if (rank >= 0) score += Math.max(0, 0.6 - 0.2 * rank);
  // Fatigue: the more a dino has spoken, the less it should keep going.
  score -= 0.75 * (state.perAgentTurns[profile.dinoId] ?? 0);
  return score;
}

/**
 * The next dino to speak, or `undefined` to end the turn. Ends when nobody is
 * eligible. Otherwise picks the highest score, breaking ties by fewer turns
 * taken then roster order (stable, deterministic).
 */
export function pickNextSpeaker(
  profiles: AgentProfile[],
  state: ConversationState,
  budget: TurnBudget,
): string | undefined {
  const eligible = eligibleSpeakers(profiles, state, budget);
  if (eligible.length === 0) return undefined;
  const last = lastDinoMessage(state);
  const ranked = eligible
    .map((p, idx) => ({
      id: p.dinoId,
      score: scoreSpeaker(p, state, last),
      turns: state.perAgentTurns[p.dinoId] ?? 0,
      idx,
    }))
    .sort((a, b) => b.score - a.score || a.turns - b.turns || a.idx - b.idx);
  return ranked[0].id;
}

/**
 * The intents `profile` is allowed to choose from right now. This is the key
 * lever that makes disagreement useful and uncertainty honest: targeted intents
 * only appear when there is a prior dino message; disagree/correct only when the
 * topic is contested or in the dino's expertise; admit/ask only surface (and are
 * encouraged) when the topic hits the dino's weak areas; agreement is barred
 * once the agreement streak is saturated.
 */
export function allowedIntents(
  profile: AgentProfile,
  state: ConversationState,
  budget: TurnBudget,
): SpeechIntent[] {
  const hasPriorDino = state.transcript.some((m) => m.role === 'dino');
  // stay_silent only makes sense when there's already been a prior dino turn —
  // offering it on the very first speaker causes the cheap director LLM to
  // choose silence when given sparse topic context, collapsing the turn.
  const allowed = new Set<SpeechIntent>(['answer_user']);
  if (hasPriorDino) allowed.add('stay_silent');
  const weak = topicHitsWeakArea(profile, state.topic);

  if (weak) {
    allowed.add('admit_uncertainty');
    if (hasPriorDino) allowed.add('ask_agent');
  }

  if (hasPriorDino) {
    allowed.add('build_on_agent');
    allowed.add('ask_agent');
    if (state.consecutiveAgreements < budget.maxConsecutiveAgreements) {
      allowed.add('agree_with_agent');
    }
    // Disagreement is never forced — only made available when there's a real
    // basis for it (contested topic or genuine expertise to push back from).
    if (state.topic.isContested || expertiseMatch(profile, state.topic) >= 0.5) {
      allowed.add('disagree_with_agent');
      allowed.add('correct_agent');
    }
  }

  return [...allowed];
}

/** Resolve the message a targeted intent points at, preferring explicit ids. */
export function resolveTarget(
  decision: IntentDecision,
  state: ConversationState,
): GroupMessage | undefined {
  if (!isTargetedIntent(decision.intent)) return undefined;
  if (decision.targetMessageId) {
    const m = state.transcript.find((t) => t.id === decision.targetMessageId);
    if (m && m.role === 'dino') return m;
  }
  if (decision.targetAgentId) {
    for (let i = state.transcript.length - 1; i >= 0; i--) {
      const m = state.transcript[i];
      if (m.role === 'dino' && m.dinoId === decision.targetAgentId) return m;
    }
  }
  return lastDinoMessage(state);
}

/**
 * Enforce the rules on a proposed intent and return a safe, resolved decision:
 *  - an out-of-set intent is coerced to `answer_user`;
 *  - a targeted intent with no resolvable target is downgraded to `answer_user`;
 *  - a targeted intent whose target has hit its reply caps (pile-up / dogpile)
 *    is downgraded to `answer_user` so the conversation moves on.
 * The returned decision carries the resolved `targetMessageId`/`targetAgentId`.
 */
export function validateIntent(
  profile: AgentProfile,
  decision: IntentDecision,
  state: ConversationState,
  budget: TurnBudget,
): IntentDecision {
  const allowed = new Set(allowedIntents(profile, state, budget));
  let intent: SpeechIntent = allowed.has(decision.intent) ? decision.intent : 'answer_user';
  let target: GroupMessage | undefined;

  if (isTargetedIntent(intent)) {
    target = resolveTarget({ ...decision, intent }, state);
    const targetAgent = target?.dinoId;
    const overReplied =
      !!target &&
      ((state.repliesToMessage[target.id] ?? 0) >= budget.maxRepliesPerMessage ||
        (targetAgent ? (state.repliesToAgent[targetAgent] ?? 0) >= budget.maxRepliesPerAgent : false));
    // A dino can never reply to its OWN message; that's a monologue, not a reply.
    const selfTarget = target?.dinoId === profile.dinoId;
    if (!target || overReplied || selfTarget) {
      intent = 'answer_user';
      target = undefined;
    }
  }

  return {
    intent,
    targetMessageId: target?.id,
    targetAgentId: target?.dinoId,
    confidence: clamp01(decision.confidence),
  };
}

/** Fold a completed turn back into the state's counters. */
export function recordTurn(
  state: ConversationState,
  dinoId: string,
  decision: IntentDecision,
): void {
  state.turnsTaken += 1;
  state.perAgentTurns[dinoId] = (state.perAgentTurns[dinoId] ?? 0) + 1;
  state.lastSpeaker = dinoId;
  state.consecutiveSilences = 0;
  state.consecutiveAgreements =
    decision.intent === 'agree_with_agent' ? state.consecutiveAgreements + 1 : 0;
  if (decision.targetMessageId) {
    state.repliesToMessage[decision.targetMessageId] =
      (state.repliesToMessage[decision.targetMessageId] ?? 0) + 1;
  }
  if (decision.targetAgentId) {
    state.repliesToAgent[decision.targetAgentId] =
      (state.repliesToAgent[decision.targetAgentId] ?? 0) + 1;
  }
}

/**
 * Record that the chosen speaker stayed silent. Bumps its turn count and marks
 * it as the last speaker so the scheduler won't immediately re-pick it — this
 * guarantees the loop makes progress even if several dinos pass in a row.
 */
export function recordSilence(state: ConversationState, dinoId: string): void {
  state.consecutiveSilences += 1;
  state.perAgentTurns[dinoId] = (state.perAgentTurns[dinoId] ?? 0) + 1;
  state.lastSpeaker = dinoId;
}

/** True while the loop may keep going (hard message ceiling not yet hit). */
export function canContinue(state: ConversationState, budget: TurnBudget): boolean {
  return state.turnsTaken < budget.maxAgentMessages;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.6;
  return Math.min(1, Math.max(0, n));
}
