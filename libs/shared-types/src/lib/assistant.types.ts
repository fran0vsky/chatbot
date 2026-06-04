/**
 * Voice Dino Assistant (Phase 29).
 *
 * The assistant turns a spoken command into ONE of three outcomes: a whitelisted
 * app action, a clarifying question, or a refusal. The set of actions it may
 * choose is the Phase 27 action catalogue — it can never invent an action
 * (AST-03). The frontend re-validates any returned action through
 * `dispatchCatalogued` before dispatching, so this contract is advisory, not trusted.
 */

/** A past conversation the assistant may switch to (AST-04). */
export interface AssistantSessionRef {
  id: string;
  title: string;
}

/** A dino the assistant may switch to. */
export interface AssistantDinoRef {
  id: string;
  name: string;
}

export interface AssistantInterpretRequest {
  /** The raw speech-to-text transcript of the user's command. */
  transcript: string;
  /** Existing chats, so the assistant can resolve "my chat about X" → a sessionId. */
  sessions: AssistantSessionRef[];
  /** Available dinos, so "talk to Rexford" → a dinoId. */
  dinos: AssistantDinoRef[];
  /** Current top-level view, for context. */
  currentView?: string;
}

/**
 * The assistant's decision. `say` is spoken aloud (TTS). For `action`, the
 * frontend dispatches `name(params)` through the catalogue safety gate.
 */
export type AssistantDecision =
  | { kind: 'action'; name: string; params: Record<string, unknown>; say: string }
  | { kind: 'clarify'; say: string }
  | { kind: 'refuse'; say: string };

export interface AssistantInterpretResponse {
  decision: AssistantDecision;
}
