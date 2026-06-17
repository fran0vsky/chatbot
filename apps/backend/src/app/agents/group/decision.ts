import {
  AgentProfile,
  DinoDecision,
  SpeechIntent,
} from '@org/shared-types';

// --- The Autonomous Decision Primitive (Group Engine v3, Phase 41) -----------
// This module is the LLM-free foundation of v3. Every participant dino makes its
// OWN decision (answer / react / silent) on its OWN model; this file owns the
// pure scaffolding for that: the flat cost ceiling, the decision-prompt builder,
// a tolerant decision parser, a deterministic heuristic fallback, and the
// round/cost-control predicates. It mirrors `group/governor.ts`: pure, exported,
// unit-tested functions with zero network/LLM dependency. The engine (Plan 02)
// is the only caller; it runs the model and drives the round loop with these.

// --- Cost ceiling (D-02 / Phase 41 Success Criterion #4) ---------------------
// Flat hard caps that REPLACE the Phase 37 governor's `TurnBudget`/`defaultBudget`
// (the central speaker-scheduling budget that capped a director-driven turn). In
// Group Engine v3 there is no director: every participant dino independently makes
// ONE decision call on its own model each round, so the ceiling is enforced as
// flat per-turn limits here instead of a scheduler budget.
//
// This block is the SINGLE SOURCE OF TRUTH for the cost ceiling, consumed by both
// the engine (Plan 02 `streamGroup`) and the docs / HUMAN-UAT.
//
// Worst-case LLM calls per user turn:
//   decision calls ≤ MAX_GROUP_DINOS × MAX_ROUNDS = 4 × 3 = 12  (one per dino per round)
//   answer  calls  ≤ MAX_TOTAL_ANSWERS            = 8           (hard generation ceiling)
//   ────────────────────────────────────────────────────────────
//   ≤ 20 calls/turn absolute worst case, but the round loop terminates early when a
//   whole round produces zero answers (`shouldStopRounds`), so typical turns are far
//   lower. Decision calls are tiny JSON classifications (cheap even on a dino's own
//   larger model); only the ≤ 8 answer calls generate full responses. This keeps the
//   real-world cost near the old Phase 37 `1 (director) + 4 + 3` budget while making
//   every dino a faithful, independently-deciding mind.

/** Max participant dinos in one group conversation. */
export const MAX_GROUP_DINOS = 4;
/** Round 1 + up to 2 bounded follow-up rounds. */
export const MAX_ROUNDS = 3;
/** Anti-monologue: max answers any single dino may produce in a user turn. */
export const MAX_ANSWERS_PER_DINO = 2;
/** Hard generation ceiling across all dinos in a user turn. */
export const MAX_TOTAL_ANSWERS = 8;

/** The full set of valid speech intents (matches the `SpeechIntent` union). */
const ALL_INTENTS: readonly SpeechIntent[] = [
  'answer_user',
  'agree_with_agent',
  'disagree_with_agent',
  'build_on_agent',
  'correct_agent',
  'ask_agent',
  'admit_uncertainty',
  'stay_silent',
];

/** Clamp a number to 0..1; non-finite input degrades to a sane default. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.6;
  return Math.min(1, Math.max(0, n));
}

// --- buildDecisionPrompt (D-03) ----------------------------------------------

/** The pure prompt text(s) for one dino's autonomous decision call. */
export interface DecisionPrompt {
  system: string;
  human: string;
}

/**
 * Build the system + human prompt instructing ONE dino, fully in its own
 * persona, to choose answer / react / silent and (for answer) its own stance.
 * Pure: returns strings only (no `SystemMessage`/`HumanMessage` objects) so it
 * stays testable. `attributedThreadText` is the already-formatted speaker-labelled
 * thread (user message + this round's earlier turns). `hasPriorDinoThisRound`
 * tells the dino whether anyone has already spoken this round (so it can react /
 * reply or, if it would only echo, stay silent).
 */
export function buildDecisionPrompt(
  profile: AgentProfile,
  attributedThreadText: string,
  hasPriorDinoThisRound: boolean,
): DecisionPrompt {
  const system = [
    `You ARE ${profile.name}, a ${profile.species} in a group chat. Stay fully in character.`,
    `Personality: ${profile.personality}`,
    `Speaking style: ${profile.speakingStyle}`,
    `Strong areas: [${profile.expertiseAreas.join(', ')}]. Weak areas: [${profile.weakAreas.join(', ')}].`,
    `Debate style: ${profile.debateStyle}. Baseline confidence: ${profile.confidence}.`,
    '',
    'Decide what YOU do this turn. Choose EXACTLY ONE action:',
    '- "answer": you have something real to add — a substantive reply.',
    '- "react": you have nothing to add in words but want to acknowledge a specific message with a single emoji.',
    '- "silent": you would only echo what was already said, or it is not your lane.',
    '',
    'Rules:',
    '- Pick "answer" only when you genuinely add something; otherwise prefer "react" or "silent".',
    '- For "react" you MUST give a single emoji and the message you are reacting to.',
    '- If you "answer", also pick YOUR OWN stance from this set and (when responding to a',
    `  specific dino) the message you reply to: ${ALL_INTENTS.join(', ')}.`,
    '- Use answer_user when answering the user directly; use a targeted stance',
    '  (agree/disagree/build/correct/ask) only in response to a specific prior dino.',
    "- If the topic is in your weak areas, prefer admit_uncertainty over bluffing.",
    '',
    'Return ONLY a JSON object (no prose, no code fences) of this exact shape:',
    '{ "action": "answer"|"react"|"silent", "intent"?: <one of the stances>,',
    '  "emoji"?: string, "replyToMessageId"?: string, "replyToAgentId"?: string,',
    '  "confidence"?: number 0..1 }',
  ].join('\n');

  const human = [
    attributedThreadText,
    '',
    hasPriorDinoThisRound
      ? 'At least one dino has already spoken this round — you may react or reply to them.'
      : 'No dino has spoken yet this round.',
  ].join('\n');

  return { system, human };
}

// --- parseDecision (D-04) ----------------------------------------------------

/** Tolerantly parse possibly-fenced model JSON; never throws. */
function tolerantJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw.replace(/```(?:json)?/gi, '').trim());
  } catch {
    return undefined;
  }
}

function isSpeechIntent(value: unknown): value is SpeechIntent {
  return typeof value === 'string' && ALL_INTENTS.includes(value as SpeechIntent);
}

/**
 * Parse a model's raw output into a validated `DinoDecision`. Strips code fences
 * (mirroring `GroupAgentsService.parseJson`), then validates and clamps:
 *  - unknown/empty `action` → `silent`;
 *  - on `answer`, unknown/missing `intent` → `answer_user`;
 *  - on `react`, a missing/empty `emoji` downgrades the action to `silent`;
 *  - `confidence` clamped to 0..1.
 * On ANY parse failure returns `{ action: 'silent', confidence: 0 }`. Never throws
 * and never returns an invalid shape, so hostile/broken output only causes silence.
 */
export function parseDecision(raw: string): DinoDecision {
  const parsed = tolerantJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { action: 'silent', confidence: 0 };
  }
  const obj = parsed as Record<string, unknown>;

  const rawAction = obj['action'];
  const action: DinoDecision['action'] =
    rawAction === 'answer' || rawAction === 'react' || rawAction === 'silent'
      ? rawAction
      : 'silent';

  const confidence =
    typeof obj['confidence'] === 'number' ? clamp01(obj['confidence']) : undefined;

  const replyToMessageId =
    typeof obj['replyToMessageId'] === 'string' ? obj['replyToMessageId'] : undefined;
  const replyToAgentId =
    typeof obj['replyToAgentId'] === 'string' ? obj['replyToAgentId'] : undefined;

  if (action === 'react') {
    const emoji = typeof obj['emoji'] === 'string' ? obj['emoji'].trim() : '';
    if (!emoji) {
      // A react with no emoji is meaningless — downgrade to silent.
      return { action: 'silent', confidence };
    }
    return { action: 'react', emoji, replyToMessageId, replyToAgentId, confidence };
  }

  if (action === 'answer') {
    const intent: SpeechIntent = isSpeechIntent(obj['intent']) ? obj['intent'] : 'answer_user';
    return { action: 'answer', intent, replyToMessageId, replyToAgentId, confidence };
  }

  return { action: 'silent', confidence };
}

// --- heuristicDecision (D-05) ------------------------------------------------

/**
 * Deterministic fallback decision driven by the profile's interaction biases
 * (modeled on the Phase 37 `heuristicIntent`). Used by the engine (Plan 02) when
 * the dino's own decision call throws/aborts. Always returns a valid
 * `DinoDecision`: a talkative / challenging dino answers (with a bias-derived
 * stance); a reticent dino reacts (only when there is something to react to) or
 * stays silent. Never throws.
 */
export function heuristicDecision(
  profile: AgentProfile,
  hasPriorDinoThisRound: boolean,
): DinoDecision {
  const b = profile.interactionBiases;
  const confidence = clamp01(profile.confidence);

  // Talkative dinos volunteer an answer with a bias-derived stance.
  if (b.talkativeness >= 0.6 || profile.confidence >= 0.75) {
    let intent: SpeechIntent = 'answer_user';
    if (hasPriorDinoThisRound) {
      if (b.likesToChallenge >= 0.6) intent = 'disagree_with_agent';
      else if (b.likesToSupport >= 0.6) intent = 'build_on_agent';
    }
    return { action: 'answer', intent, confidence };
  }

  // A challenging dino still answers even when not very talkative.
  if (b.likesToChallenge >= 0.6) {
    return {
      action: 'answer',
      intent: hasPriorDinoThisRound ? 'disagree_with_agent' : 'answer_user',
      confidence,
    };
  }

  // Otherwise: react if there's a prior turn to acknowledge, else stay silent.
  if (hasPriorDinoThisRound) {
    return { action: 'react', emoji: '👍', confidence };
  }
  return { action: 'silent', confidence };
}

// --- Round/cost predicates (D-06) --------------------------------------------

/** Per-user-turn answer bookkeeping for the engine's round loop. */
export interface RoundCounters {
  /** dinoId → answers it has produced this user turn. */
  perDinoAnswers: Record<string, number>;
  /** Total answers produced across all dinos this user turn. */
  totalAnswers: number;
}

/** A fresh, zeroed counter record for one user turn. */
export function initRoundCounters(): RoundCounters {
  return { perDinoAnswers: {}, totalAnswers: 0 };
}

/** True when this dino has hit its anti-monologue answer cap. */
export function dinoAtAnswerCap(counters: RoundCounters, dinoId: string): boolean {
  return (counters.perDinoAnswers[dinoId] ?? 0) >= MAX_ANSWERS_PER_DINO;
}

/** True when the hard total-answer ceiling for the turn has been reached. */
export function atTotalAnswerCap(counters: RoundCounters): boolean {
  return counters.totalAnswers >= MAX_TOTAL_ANSWERS;
}

/** Record a produced answer into the counters. */
export function recordAnswer(counters: RoundCounters, dinoId: string): void {
  counters.perDinoAnswers[dinoId] = (counters.perDinoAnswers[dinoId] ?? 0) + 1;
  counters.totalAnswers += 1;
}

/**
 * Round-termination predicate. Stop running further rounds when the just-finished
 * round produced ZERO answers (the conversation has nothing more to add) OR the
 * round cap is reached. `roundIndex` is the 0-based index of the round that just
 * completed; `answersThisRound` is how many answers it produced.
 */
export function shouldStopRounds(roundIndex: number, answersThisRound: number): boolean {
  return answersThisRound === 0 || roundIndex + 1 >= MAX_ROUNDS;
}
