import { SpeechIntent } from './group-social.js';

// --- Conversational Group Chat contracts (Phase 35) ---
// A turn-based group conversation. On each user message a single cheap
// orchestrator call produces a structured plan deciding, per dino, whether to
// answer / emoji-react / stay silent (plus speaking order and inter-dino
// mentions). Only "answer" dinos then make full in-character calls; "react"
// and "silent" dinos cost no LLM call. These contracts are shared by the
// backend orchestrator engine and the frontend group client.

/**
 * @deprecated Phase 35 orchestrator-plan contract — superseded by the autonomous
 * per-dino `DinoDecision` (Group Engine v3, Phase 41). In v3 there is NO central
 * director assigning per-dino actions; every dino makes its own `DinoDecision` on
 * its own model. This type is retained ONLY because the engine still emits an
 * empty `plan` event (`GroupOrchestratorPlan` with `round1: []`, `round2: []`)
 * for SSE-contract stability — the frontend keys its slot-layout assumptions off
 * that event. Do not use for new decision logic; use `DinoDecision` instead.
 */
export interface DinoTurnDecision {
  dinoId: string;
  /** Exactly one action per dino per round (D-07). */
  action: 'answer' | 'react' | 'silent';
  /** Present only for `react` — a single emoji. */
  emoji?: string;
  /** The message this decision targets (for reactions / replies). */
  targetMessageId?: string;
  /** For a volunteered Round-2 reply: the dino being responded to (D-05). */
  respondingTo?: string;
  /** Speaking order within the round (ascending). */
  order: number;
}

/**
 * @deprecated Phase 35 orchestrator-plan contract — superseded by the autonomous
 * per-dino `DinoDecision` (Group Engine v3, Phase 41). The central director that
 * produced this plan is gone. Retained because the engine still emits an EMPTY
 * instance of this shape as the leading `plan` event so the SSE contract (and the
 * frontend's dynamic slot creation from `dino_token`) stays stable. The live
 * decision contract is `DinoDecision`.
 */
export interface GroupOrchestratorPlan {
  /** Dinos answering the user message. */
  round1: DinoTurnDecision[];
  /** Bounded inter-dino follow-up (clamped to MAX_INTER_DINO_REPLIES). */
  round2: DinoTurnDecision[];
}

/**
 * The autonomous per-dino decision output (Group Engine v3, Phase 41).
 *
 * Unlike the Phase 35 `DinoTurnDecision`/`GroupOrchestratorPlan` — where a single
 * central director pre-selected who speaks and how — in v3 EVERY participant dino
 * makes its OWN decision call on its OWN model, in full persona, choosing exactly
 * one action. The Phase 35 orchestrator-plan types are superseded for decision
 * making and kept only for the still-emitted (now empty) `plan` SSE event, which
 * preserves the frontend contract. This `DinoDecision` is the single output of
 * one dino's autonomous decision.
 */
export interface DinoDecision {
  /** The one action this dino chose this round. */
  action: 'answer' | 'react' | 'silent';
  /** The dino's own stance — present only when `action === 'answer'` (default `answer_user`). */
  intent?: SpeechIntent;
  /** A single emoji — present (and required) only when `action === 'react'`. */
  emoji?: string;
  /** The prior message this turn is responding to (enables the threaded reply stub). */
  replyToMessageId?: string;
  /** The prior dino this turn is addressed to. */
  replyToAgentId?: string;
  /** The dino's self-reported confidence, 0..1. */
  confidence?: number;
}

/** An emoji reaction by a dino, pinned to a target message (D-06). */
export interface GroupReaction {
  dinoId: string;
  emoji: string;
}

/** One attributed message in the interleaved group transcript (D-08/D-09). */
export interface GroupMessage {
  id: string;
  role: 'user' | 'dino';
  /** Present when `role === 'dino'`. */
  dinoId?: string;
  text: string;
  reactions?: GroupReaction[];
  createdAt: number;
  // --- Social metadata (Phase 37). All optional for back-compat with the old
  // static-plan transcripts and with `user` rows. ---
  /** The social role this dino message played (answer / agree / disagree / …). */
  intent?: SpeechIntent;
  /** The message this turn was a reply to (for the threaded reply stub). */
  replyToMessageId?: string;
  /** The dino this turn was addressed to. */
  replyToAgentId?: string;
  /** The speaker's self-reported confidence, 0..1. */
  confidence?: number;
}

/** Request body for POST /api/agents/group. */
export interface GroupChatRequest {
  message: string;
  /** Selected participant dino ids (server resolves model + prompt + tools). */
  participantDinoIds: string[];
  /** Anonymous per-device user id (scopes cross-thread memory per dino). */
  userId?: string;
  /** The interleaved attributed transcript so far (capped server-side). */
  history?: GroupMessage[];
}

/** Emitted first so the frontend can lay out ordered per-dino slots (D-03). */
export interface GroupPlanEvent {
  type: 'plan';
  plan: GroupOrchestratorPlan;
}

/** A streamed token from a specific answering dino. */
export interface GroupDinoTokenEvent {
  type: 'dino_token';
  dinoId: string;
  text: string;
}

/** A specific dino finished its answer. Carries a server-generated messageId. */
export interface GroupDinoDoneEvent {
  type: 'dino_done';
  dinoId: string;
  response: string;
  messageId: string;
  // --- Social metadata (Phase 37) — lets the UI label the message and draw the
  // reply stub. Optional so older clients ignore them gracefully. ---
  intent?: SpeechIntent;
  replyToMessageId?: string;
  replyToAgentId?: string;
  confidence?: number;
}

/** A dino reacted with a single emoji to a target message (no LLM call). */
export interface GroupReactionEvent {
  type: 'reaction';
  dinoId: string;
  emoji: string;
  targetMessageId?: string;
}

/** A specific answerer failed; the others still complete. */
export interface GroupDinoErrorEvent {
  type: 'dino_error';
  dinoId: string;
  message: string;
}

/** The whole group turn is complete. Always the final event. */
export interface GroupDoneEvent {
  type: 'group_done';
}

/** Multiplexed group SSE stream events. */
export type GroupStreamEvent =
  | GroupPlanEvent
  | GroupDinoTokenEvent
  | GroupDinoDoneEvent
  | GroupReactionEvent
  | GroupDinoErrorEvent
  | GroupDoneEvent;
