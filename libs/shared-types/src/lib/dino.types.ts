import { ChatHistoryItem } from './chat.types.js';

export type DinoId = string;

/**
 * Per-dino voice character. Drives SpeechSynthesisUtterance properties
 * via the SsmlHint mapping in the frontend (VOX-02).
 */
export interface VoiceProfile {
  /**
   * Speech rate.
   * Range: 0.1–10. Default: 1.0.
   */
  rate?: number;
  /**
   * Speech pitch.
   * Range: 0–2. Default: 1.0.
   */
  pitch?: number;
  /**
   * Preferred system-voice name or URI (e.g. "Google UK English Male").
   * When absent or not installed, falls back to the system default voice.
   */
  preferredVoice?: string;
}

/** Full dino definition — backend-only (contains the system prompt). */
export interface Dino {
  id: DinoId;
  /** Display name, e.g. "Rexford" */
  name: string;
  /** Dinosaur species, used for the mascot, e.g. "Tyrannosaurus" */
  species: string;
  /** One-line persona tagline for cards */
  persona: string;
  /** Longer description shown on the Explore page */
  blurb: string;
  /** What this dino is good at, e.g. "Fast factual answers" */
  specialty: string;
  /** Fixed OpenRouter model id */
  model: string;
  /** System prompt: personality + response style + workflow */
  systemPrompt: string;
  /** Names of tools this dino may call (must exist in tools/index.ts) */
  toolNames: string[];
  /**
   * When true, this dino generates images instead of running the text agent loop.
   * Its `model` must be an image-output model; the backend uses a dedicated
   * image-generation path and emits a `StreamImageEvent` (IMG-01/02).
   */
  imageGen?: boolean;
  /** Optional brand accent (hex) for UI theming of the dino */
  accent?: string;
  /** Optional voice character for TTS read-aloud (VOX-01/02). */
  voiceProfile?: VoiceProfile;
  /** Optional uploaded avatar URL (custom dinos). Built-ins use the mascot pipeline. */
  avatarUrl?: string;
}

/** Frontend-safe projection — omits the raw system prompt. */
export type DinoSummary = Omit<Dino, 'systemPrompt'>;

/** A user-authored skill taught to a dino (Phase 22). */
export interface DinoSkill {
  id: string;
  title: string;
  instruction: string;
  /** Optional activation trigger. Empty/absent = always apply (CMP-05). */
  whenToActivate?: string;
}

/** Everything a dino has learned about a user: taught skills + auto-extracted memories. */
export interface LearnedItems {
  skills: DinoSkill[];
  memories: { id: string; content: string }[];
}

// --- AI Memory Creator contracts (Phase 34) ---
// The creator generates suggestions from the conversation, synthesizes a chosen
// suggestion or free text into the 3-field skill shape, and saves with server-side
// create-vs-update reconciliation. All operations run on the active dino's own model
// (resolved server-side via dinoId) with the same paid fallback as the agent loop.

/** The 3-field skill shape the creator form produces (maps 1:1 onto DinoSkill). */
export interface SynthesizedSkill {
  title: string;
  whenToActivate?: string;
  instruction: string;
}

/** Request to derive things-worth-remembering from the current conversation. */
export interface SuggestSkillsRequest {
  userId: string;
  dinoId: string;
  history: ChatHistoryItem[];
}

/** ≥3 short, distinct suggestions derived from the conversation (SC#1). */
export interface SuggestSkillsResponse {
  suggestions: string[];
}

/** Request to turn a chosen suggestion OR free natural text into the 3-field form. */
export interface SynthesizeSkillRequest {
  userId: string;
  dinoId: string;
  input: string;
}

/** Request to persist a created skill with server-side create-vs-update reconciliation. */
export interface SaveCreatedSkillRequest {
  userId: string;
  dinoId: string;
  title: string;
  whenToActivate?: string;
  instruction: string;
}

/** The persisted skill plus the server-decided action (never surfaced as a toggle). */
export interface SaveCreatedSkillResponse {
  skill: DinoSkill;
  action: 'created' | 'updated';
}

// --- Custom Dino Creator contracts (Phase 42) ---
// A custom dino is the same shape as a built-in — model + system prompt + tool subset —
// persisted per anonymous user, selectable in the picker, and resolvable in the chat loop.
// The system prompt and toolset are resolved server-side; the client never sends them directly.

/**
 * A curated OpenRouter model entry selectable when creating a custom dino.
 * Only the allowed free/cheap models are exposed via GET /api/models.
 */
export interface CuratedModel {
  id: string;
  label: string;
}

/**
 * Full persisted shape of a user-authored dino (returned after create/update).
 * `systemPrompt` is included in the server-to-server shape but NEVER included
 * in the public projection (`toCustomDinoSummary`).
 */
export interface CustomDino {
  /** Public id: `custom:<uuid>` — cannot collide with built-in registry ids. */
  id: string;
  userId: string;
  name: string;
  species?: string;
  avatarUrl?: string;
  blurb?: string;
  persona?: string;
  systemPrompt: string;
  model: string;
  toolNames: string[];
  accent?: string;
  createdAt: string;
  updatedAt: string;
}

/** Request body for POST /api/custom-dinos. */
export interface CreateCustomDinoRequest {
  userId: string;
  name: string;
  species?: string;
  avatarUrl?: string;
  blurb?: string;
  persona?: string;
  systemPrompt: string;
  model: string;
  toolNames: string[];
  accent?: string;
}

/** Request body for PUT /api/custom-dinos/:id. All editable fields; userId is NOT editable. */
export interface UpdateCustomDinoRequest {
  name?: string;
  species?: string;
  avatarUrl?: string;
  blurb?: string;
  persona?: string;
  systemPrompt?: string;
  model?: string;
  toolNames?: string[];
  accent?: string;
}
