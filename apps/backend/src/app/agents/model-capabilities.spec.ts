import { describe, it, expect } from 'vitest';
import { getModelCapabilities } from './model-capabilities';

describe('getModelCapabilities', () => {
  // Reasoning is intentionally disabled across the board (see model-capabilities.ts):
  // the modelKwargs.reasoning path crashes @langchain/openrouter on free models.
  // These registered models therefore report reasoning=false until the library
  // handles the new response shape.
  it('returns reasoning=false for deepseek-v4-flash free (reasoning disabled)', () => {
    expect(getModelCapabilities('deepseek/deepseek-v4-flash:free').reasoning).toBe(false);
  });

  it('returns reasoning=false for paid deepseek-v4-flash (reasoning disabled)', () => {
    expect(getModelCapabilities('deepseek/deepseek-v4-flash').reasoning).toBe(false);
  });

  it('returns reasoning=false for nemotron reasoning model (reasoning disabled)', () => {
    expect(
      getModelCapabilities('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free').reasoning,
    ).toBe(false);
  });

  it('returns reasoning=false for non-reasoning model', () => {
    expect(getModelCapabilities('meta-llama/llama-3.3-70b-instruct:free').reasoning).toBe(false);
  });

  it('returns reasoning=false for unknown model', () => {
    expect(getModelCapabilities('completely/unknown-model').reasoning).toBe(false);
  });
});
