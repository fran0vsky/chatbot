/**
 * Context-window sizes and token-estimation helpers for the client-side
 * context-usage ring (Phase 32 / CTX-03).
 *
 * ALL values are deliberately approximate (D-08). The per-model window sizes
 * are taken from OpenRouter provider docs and rounded for simplicity — the ring
 * is advisory (warn-only, D-09/D-10), not a hard enforcement mechanism.
 * The token estimate uses a char/4 heuristic and a flat IMAGE_TOKEN_COST,
 * both documented as approximations.
 */

/**
 * Known model → context-window token budget. Each value is the nominal context
 * window for that model (approximate — see D-08). Covers the current dino
 * registry plus the paid fallback model.
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Dino registry models (all ~128k context)
  'meta-llama/llama-3.3-70b-instruct:free': 128000,
  'openai/gpt-oss-20b:free': 128000,
  'z-ai/glm-4.5-air:free': 128000,
  'nvidia/nemotron-3-nano-30b-a3b:free': 128000,
  'nvidia/nemotron-nano-12b-v2-vl:free': 128000,
  // Artist dino model (image-gen; ring is optional there)
  'google/gemini-2.5-flash-image': 1048576,
  // Paid fallback model
  'gpt-4o-mini': 128000,
  'openai/gpt-4o-mini': 128000,
};

/**
 * Conservative fallback context-window budget used for any model not in
 * `MODEL_CONTEXT_WINDOWS`. Set to 8000 tokens — deliberately low so the ring
 * warns early for unknown models rather than masking a potential overflow (D-07).
 */
export const DEFAULT_CONTEXT_WINDOW = 8000;

/**
 * Return the known context-window size for `modelId`, or `DEFAULT_CONTEXT_WINDOW`
 * for any model not in the map. Never throws.
 */
export function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}

/**
 * Approximate the number of tokens in `text` using the char/4 heuristic.
 * Deliberately approximate (D-08) — good enough for a usage ring estimate.
 */
export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Flat token cost per retained image in the history context.
 * Deliberately approximate (D-08) — actual cost varies by model and image size,
 * but 1000 tokens is a reasonable conservative estimate for a 1024px JPEG.
 */
export const IMAGE_TOKEN_COST = 1000;
