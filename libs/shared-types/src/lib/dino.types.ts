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
