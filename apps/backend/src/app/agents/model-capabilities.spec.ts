import { getModelCapabilities } from './model-capabilities';

describe('getModelCapabilities', () => {
  it('returns reasoning=true for deepseek-v4-flash free', () => {
    expect(getModelCapabilities('deepseek/deepseek-v4-flash:free').reasoning).toBe(true);
  });

  it('returns reasoning=true for paid deepseek-v4-flash', () => {
    expect(getModelCapabilities('deepseek/deepseek-v4-flash').reasoning).toBe(true);
  });

  it('returns reasoning=true for nemotron reasoning model', () => {
    expect(getModelCapabilities('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free').reasoning).toBe(true);
  });

  it('returns reasoning=false for non-reasoning model', () => {
    expect(getModelCapabilities('meta-llama/llama-3.3-70b-instruct:free').reasoning).toBe(false);
  });

  it('returns reasoning=false for unknown model', () => {
    expect(getModelCapabilities('completely/unknown-model').reasoning).toBe(false);
  });
});
