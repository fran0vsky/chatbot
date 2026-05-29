export type DinoId = string;

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
  /** Optional brand accent (hex) for UI theming of the dino */
  accent?: string;
}

/** Frontend-safe projection — omits the raw system prompt. */
export type DinoSummary = Omit<Dino, 'systemPrompt'>;
