// --- Multi-agent social conversation contracts (Phase 37) ---
// These upgrade the group chat from a static answer/react/silent plan into a
// turn-by-turn discussion where dinos have intent before speaking and reply to
// each other. The backend engine owns AgentProfile + TopicAnalysis (never sent
// to the client); SpeechIntent + INTENT_LABELS are shared so the UI can label
// each message's social role.

/**
 * What a dino intends to do when it takes a turn. Supersedes the old
 * `answer | react | silent` action union: `answer_user` ≈ answer,
 * `stay_silent` ≈ silent, and emoji reactions remain a separate free channel.
 */
export type SpeechIntent =
  | 'answer_user'
  | 'agree_with_agent'
  | 'disagree_with_agent'
  | 'build_on_agent'
  | 'correct_agent'
  | 'ask_agent'
  | 'admit_uncertainty'
  | 'stay_silent';

/** Intents that only make sense when aimed at a specific prior agent message. */
export const TARGETED_INTENTS: readonly SpeechIntent[] = [
  'agree_with_agent',
  'disagree_with_agent',
  'build_on_agent',
  'correct_agent',
  'ask_agent',
];

/** True when an intent must carry a target agent/message to be coherent. */
export function isTargetedIntent(intent: SpeechIntent): boolean {
  return TARGETED_INTENTS.includes(intent);
}

/**
 * Short third-person labels for the message-header intent chip. `stay_silent`
 * is omitted because a silent turn never produces a visible message.
 */
export const INTENT_LABELS: Record<Exclude<SpeechIntent, 'stay_silent'>, string> = {
  answer_user: 'answering',
  agree_with_agent: 'agrees',
  disagree_with_agent: 'pushes back',
  build_on_agent: 'builds on',
  correct_agent: 'corrects',
  ask_agent: 'asks',
  admit_uncertainty: 'unsure',
};

/** Resolve an intent to its chip label, or undefined when it has none. */
export function intentLabel(intent: SpeechIntent | undefined): string | undefined {
  if (!intent || intent === 'stay_silent') return undefined;
  return INTENT_LABELS[intent];
}

/** How a dino tends to engage in disagreement / discussion. */
export type DebateStyle =
  | 'aggressive'
  | 'diplomatic'
  | 'socratic'
  | 'supportive'
  | 'contrarian';

/** Per-dino social tendencies that bias speaker + intent selection. */
export interface InteractionBiases {
  /** dinoId → bias weight (+ likes engaging that dino, − avoids). Optional. */
  affinity?: Record<string, number>;
  /** 0..1 propensity to disagree / correct. */
  likesToChallenge: number;
  /** 0..1 propensity to agree / build on. */
  likesToSupport: number;
  /** 0..1 propensity to volunteer a turn at all. */
  talkativeness: number;
}

/**
 * The "social brain" layer that sits on top of a `Dino`. Backend-only — lives
 * beside the registry and is never projected to the client.
 */
export interface AgentProfile {
  dinoId: string;
  name: string;
  species: string;
  personality: string;
  speakingStyle: string;
  /** Normalized lowercase tags this dino is strong at, e.g. ['code','tech']. */
  expertiseAreas: string[];
  /** Tags where it should defer / hedge rather than bluff. */
  weakAreas: string[];
  debateStyle: DebateStyle;
  /** 0..1 baseline self-assurance. */
  confidence: number;
  interactionBiases: InteractionBiases;
}

/** Cheap one-call analysis of the user message that steers the whole turn. */
export interface TopicAnalysis {
  /** Distinct askable parts, e.g. ['fun','reliability','cost']. */
  subtopics: string[];
  /** Expertise tags the question demands (matched against AgentProfile tags). */
  requiredExpertise: string[];
  /** True when reasonable experts would legitimately disagree. */
  isContested: boolean;
  /** Roster dinoIds pre-ranked by expertise fit (best first). */
  bestSuitedDinoIds: string[];
}
